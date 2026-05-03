import { getConfig } from "../server/config.js";
import {
  assertGuildAccess,
  getGuildCommandsSnapshot,
  getGuildConfiguration,
  getGuildMusic,
  getGuildOverview,
  listDashboardGuilds,
  updateAntiNukeConfiguration,
  updateGuildConfiguration
} from "../server/dashboard-data.js";
import { fetchDiscordToken, fetchDiscordUser, fetchUserGuilds } from "../server/discord.js";
import { assertRateLimit } from "../server/rate-limit.js";
import { consumeOauthState, createOauthState, createSession, destroySession, getSession } from "../server/session.js";
import { antiNukePatchSchema, guildPatchSchema } from "../server/validators.js";

function getPublicUrl(request) {
  const envUrl =
    process.env.DASHBOARD_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL;

  if (envUrl) {
    return envUrl;
  }

  const forwardedProto = request.headers["x-forwarded-proto"] || "https";
  const forwardedHost = request.headers["x-forwarded-host"] || request.headers.host;
  return `${forwardedProto}://${forwardedHost}`;
}

function json(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function redirect(response, location) {
  response.writeHead(302, { location });
  response.end();
}

function sanitizeCallbackUrl(rawValue, publicUrl) {
  if (!rawValue) return `${publicUrl}/`;

  try {
    const url = new URL(rawValue, publicUrl);
    const publicOrigin = new URL(publicUrl).origin;
    return url.origin === publicOrigin ? url.toString() : `${publicUrl}/`;
  } catch {
    return `${publicUrl}/`;
  }
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function getSessionOrReject(request, response, config) {
  const session = getSession(request, config.nextAuthSecret);
  if (!session?.user) {
    json(response, 401, { error: "Unauthorized" });
    return null;
  }
  return session;
}

function formatSessionUser(user) {
  return {
    id: user.id,
    username: user.username || user.global_name || "Discord User",
    avatar: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : "https://cdn.discordapp.com/embed/avatars/0.png"
  };
}

async function handleApi(request, response) {
  const publicUrl = getPublicUrl(request);
  const callbackPath = "/api/auth/callback/discord";
  const callbackUrl = new URL(callbackPath, publicUrl).toString();
  const isSecureCookie = publicUrl.startsWith("https://");
  const config = getConfig();
  const requestUrl = new URL(request.url || "/", publicUrl);
  const { pathname } = requestUrl;

  if (pathname === "/api/auth/signin/discord") {
    const callback = sanitizeCallbackUrl(requestUrl.searchParams.get("callbackUrl"), publicUrl);
    redirect(response, `/api/discord-login?callbackUrl=${encodeURIComponent(callback)}`);
    return true;
  }

  if (pathname === "/api/discord-login") {
    const callback = sanitizeCallbackUrl(requestUrl.searchParams.get("callbackUrl"), publicUrl);
    const state = createOauthState(response, callback, {
      secret: config.nextAuthSecret,
      secure: isSecureCookie
    });

    const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", config.discordClientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("scope", "identify guilds");
    authorizeUrl.searchParams.set("state", state);
    redirect(response, authorizeUrl.toString());
    return true;
  }

  if (pathname === callbackPath) {
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const callback = consumeOauthState(request, response, state, {
      secret: config.nextAuthSecret,
      secure: isSecureCookie
    });

    if (!code || !callback) {
      redirect(response, "/login");
      return true;
    }

    try {
      const token = await fetchDiscordToken(code, callbackUrl);
      const [discordUser, guilds] = await Promise.all([
        fetchDiscordUser(token.access_token),
        fetchUserGuilds(token.access_token)
      ]);

      createSession(response, {
        accessToken: token.access_token,
        user: {
          ...formatSessionUser(discordUser),
          guilds: guilds.map((guild) => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner: guild.owner,
            permissions: guild.permissions
          }))
        }
      }, {
        secret: config.nextAuthSecret,
        secure: isSecureCookie
      });

      redirect(response, callback);
    } catch (error) {
      console.error("[vercel-dashboard] Discord login failed:", error);
      redirect(response, "/login");
    }

    return true;
  }

  if (pathname === "/api/auth/signout") {
    destroySession(request, response, {
      secret: config.nextAuthSecret,
      secure: isSecureCookie
    });
    redirect(response, sanitizeCallbackUrl(requestUrl.searchParams.get("callbackUrl") || "/login", publicUrl));
    return true;
  }

  if (pathname === "/api/guilds" && request.method === "GET") {
    const session = getSessionOrReject(request, response, config);
    if (!session) return true;

    try {
      assertRateLimit(`guilds:${session.user.id}`, 30, 60_000);
      const guilds = await listDashboardGuilds(session);
      json(response, 200, {
        guilds,
        user: {
          id: session.user.id,
          username: session.user.username,
          avatar: session.user.avatar
        }
      });
    } catch (error) {
      json(response, error.statusCode || 500, { error: error.message || "Failed to load guilds." });
    }
    return true;
  }

  const guildMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/(overview|config|commands|music)$/);
  if (guildMatch) {
    const [, guildId, section] = guildMatch;
    const session = getSessionOrReject(request, response, config);
    if (!session) return true;

    try {
      const limitKey = `${section}:${session.user.id}:${guildId}`;
      const limits = {
        overview: [60, 60_000],
        config: [request.method === "PATCH" ? 20 : 60, 60_000],
        commands: [40, 60_000],
        music: [90, 60_000]
      };
      const [limit, windowMs] = limits[section];
      assertRateLimit(limitKey, limit, windowMs);

      const accessGuild = await assertGuildAccess(session, guildId);
      if (!accessGuild) {
        json(response, 403, { error: "Forbidden" });
        return true;
      }

      if (section === "overview" && request.method === "GET") {
        json(response, 200, await getGuildOverview(guildId));
        return true;
      }

      if (section === "commands" && request.method === "GET") {
        const { guild } = await getGuildConfiguration(guildId);
        json(response, 200, getGuildCommandsSnapshot(guild));
        return true;
      }

      if (section === "config" && request.method === "GET") {
        json(response, 200, await getGuildConfiguration(guildId));
        return true;
      }

      if (section === "music" && request.method === "GET") {
        json(response, 200, await getGuildMusic(guildId));
        return true;
      }

      if (section === "config" && request.method === "PATCH") {
        const body = await readJsonBody(request);
        const guildPatch = guildPatchSchema.safeParse(body.guild ?? {});
        const antiNukePatch = antiNukePatchSchema.safeParse(body.antiNuke ?? {});

        if (!guildPatch.success || !antiNukePatch.success) {
          json(response, 400, { error: "Invalid configuration payload." });
          return true;
        }

        const [updatedGuild, antiNuke] = await Promise.all([
          updateGuildConfiguration(guildId, guildPatch.data),
          updateAntiNukeConfiguration(guildId, antiNukePatch.data)
        ]);

        json(response, 200, { guild: updatedGuild, antiNuke });
        return true;
      }

      json(response, 405, { error: "Method not allowed" });
    } catch (error) {
      json(response, error.statusCode || 500, { error: error.message || "Dashboard API failed." });
    }
    return true;
  }

  return false;
}

export default async function handler(request, response) {
  try {
    const handled = await handleApi(request, response);
    if (!handled) {
      json(response, 404, { error: "Not found" });
    }
  } catch (error) {
    console.error("[vercel-dashboard] Request failed:", error);
    if (!response.headersSent) {
      json(response, 500, { error: "Internal server error" });
    } else {
      response.end();
    }
  }
}
