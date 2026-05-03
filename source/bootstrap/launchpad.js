const Cluster = require("discord-hybrid-sharding");
const express = require("express");
const cors = require("cors");
const settings = require("../settings");
const Telemetry = require("../toolkit/telemetry");

function getStatusServerPort() {
  const candidates = [
    process.env.STATUS_SERVER_PORT,
    process.env.BOT_STATUS_PORT,
    process.env.PORT,
    process.env.SERVER_PORT
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 3001;
}

function getStatusServerHost() {
  return process.env.STATUS_SERVER_HOST || "0.0.0.0";
}

async function startLaunchpad() {
  const manager = new Cluster.ClusterManager(`${__dirname}/shard.js`, {
    totalShards: settings.Shards.totalShards,
    totalClusters: settings.Shards.totalClusters,
    shardsPerClusters: settings.Shards.shardsPerCluster,
    respawn: true,
    mode: "process",
    token: settings.Client.Token
  });

  let statusServerStarted = false;
  manager.on("clusterCreate", (cluster) => {
    Telemetry.log(`Cluster ${cluster.id} launched`, "shard");
    cluster.on("clientReady", () => {
      Telemetry.log(`Cluster ${cluster.id} is ready`, "shard");
    });
  });

  if (!statusServerStarted) {
    startStatusServer(manager);
    statusServerStarted = true;
  }

  await spawnWithRetry(manager);
}

async function spawnWithRetry(manager) {
  let attempt = 0;

  while (true) {
    try {
      await manager.spawn({ timeout: -1 });
      return;
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error;

      attempt += 1;
      const delayMs = Math.min(60_000, 5_000 * attempt);
      Telemetry.warn(
        `Discord launch request timed out (${error.code || error.name || "network"}). Retrying in ${Math.round(delayMs / 1000)}s.`
      );
      await sleep(delayMs);
    }
  }
}

function isTransientNetworkError(error) {
  const code = error?.code || error?.cause?.code;
  return [
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN"
  ].includes(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startStatusServer(manager) {
  const statusPort = getStatusServerPort();
  const statusHost = getStatusServerHost();
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(cors({ origin: "*" }));
  app.use((_request, response, next) => {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    next();
  });

  app.get("/", (_request, response) => {
    response.send("PogyClient is online.");
  });

  app.get("/stats", async (_request, response) => {
    try {
      const [guilds, _users, members] = await Promise.all([
        manager.fetchClientValues("guilds.cache.size"),
        manager.fetchClientValues("users.cache.size"),
        manager.broadcastEval((client) => client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0))
      ]);
      response.json({
        users: members.reduce((total, count) => total + count, 0),
        guilds: guilds.reduce((total, count) => total + count, 0)
      });
    } catch (_error) {
      response.status(200).json({ users: 0, guilds: 0 });
    }
  });

  app.get("/commands", async (_request, response) => {
    try {
      const catalog = await manager.broadcastEval((client) => client.commands.map((entry) => entry.Global));
      const firstClusterCatalog = catalog.find((entry) => Array.isArray(entry)) || [];
      response.json(firstClusterCatalog.filter((entry) => entry.category !== "Owners"));
    } catch (_error) {
      response.status(200).json([]);
    }
  });

  app.get("/guilds", async (_request, response) => {
    try {
      const clusterGuilds = await manager.broadcastEval((client) =>
        client.guilds.cache.map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          iconUrl: guild.iconURL({ size: 256 }),
          memberCount: guild.memberCount ?? null,
          onlineCount: null
        }))
      );

      response.json(clusterGuilds.flat());
    } catch (_error) {
      response.status(200).json([]);
    }
  });

  app.post("/guilds/:guildId/cache", async (request, response) => {
    const { guildId } = request.params;
    const { guild, antiNuke } = request.body || {};

    try {
      await manager.broadcastEval(
        (client, context) => {
          const path = require("node:path");
          const { syncNativeRules } = require(path.join(client.Location, "source", "toolkit", "helpers", "automod-manager.js"));

          if (context.guild) {
            client.cache.set(`${context.guildId}1`, context.guild);
            if (context.guild.automod && client.guilds.cache.has(context.guildId)) {
              const liveGuild = client.guilds.cache.get(context.guildId);
              syncNativeRules(
                liveGuild,
                context.guild.automod,
                "Zenith Dashboard"
              ).catch(() => {});
            }
          }

          if (context.antiNuke) {
            client.cache.set(context.guildId, context.antiNuke);
          }

          return true;
        },
        { context: { guildId, guild, antiNuke } }
      );

      response.json({ ok: true });
    } catch (error) {
      response.status(502).json({ ok: false, error: error.message });
    }
  });

  app.get("/guilds/:guildId/music", async (request, response) => {
    const { guildId } = request.params;

    try {
      const snapshots = await manager.broadcastEval(
        (client, context) => {
          if (!client.guilds.cache.has(context.guildId)) return null;
          return client.music?.getDashboardSnapshot(context.guildId) || null;
        },
        { context: { guildId } }
      );

      const snapshot = snapshots.find((entry) => entry && typeof entry === "object") || null;
      response.json({ music: snapshot });
    } catch (error) {
      response.status(200).json({ music: null, error: error.message });
    }
  });

  app.listen(statusPort, statusHost, () => {
    Telemetry.log(`Status server listening on ${statusHost}:${statusPort}`, "shard");
  });
}

module.exports = { startLaunchpad };
