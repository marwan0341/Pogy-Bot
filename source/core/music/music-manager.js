const { Kazagumo } = require("kazagumo");
const { Connectors } = require("shoukaku");
const { MessageFlags } = require("discord.js");
const { buildNoticePanel } = require("../../toolkit/helpers/cv2");

class MusicManager {
  constructor(client) {
    this.client = client;
    this.kazagumo = null;
    this.initialized = false;
    this.dashboardState = new Map();
  }

  get enabled() {
    return Array.isArray(this.client.config.Lavalink?.Nodes) && this.client.config.Lavalink.Nodes.length > 0;
  }

  async init() {
    if (this.initialized || !this.enabled) {
      return this.kazagumo;
    }

    const nodes = this.client.config.Lavalink.Nodes.filter(
      (node) => node?.name && node?.url && node?.auth
    );
    if (!nodes.length) {
      this.client.logger.warn("Music system skipped: no valid Lavalink nodes configured.");
      return null;
    }

    this.kazagumo = new Kazagumo(
      {
        defaultSearchEngine: this.client.config.Lavalink.DefaultSearchEngine || "youtube",
        send: (guildId, payload) => {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) guild.shard.send(payload);
        },
      },
      new Connectors.DiscordJS(this.client),
      nodes,
      {
        resume: Boolean(this.client.config.Lavalink.Resume),
        resumeTimeout: Number(this.client.config.Lavalink.ResumeTimeout || 60),
        reconnectTries: 3,
        reconnectInterval: 5,
        restTimeout: 60,
        moveOnDisconnect: false,
        voiceConnectionTimeout: 15,
      }
    );

    this.bindEvents();

    if (typeof this.client.isReady === "function" && this.client.isReady()) {
      this.kazagumo.shoukaku.connector.ready(nodes);
    }

    if (!this.kazagumo.shoukaku.id && this.client.user?.id) {
      this.kazagumo.shoukaku.id = this.client.user.id;
      for (const node of this.kazagumo.shoukaku.nodes.values()) {
        node.connect().catch((error) => {
          this.client.logger.log(
            `Lavalink ${node.name} connect failed: ${error?.message || error}`,
            "lavalinkError"
          );
        });
      }
    }

    this.initialized = true;
    return this.kazagumo;
  }

  bindEvents() {
    this.kazagumo.shoukaku.on("ready", (name) => {
      this.client.logger.log(`Lavalink ${name} connected`, "lavalink");
    });

    this.kazagumo.shoukaku.on("error", (name, error) => {
      this.client.logger.log(`Lavalink ${name} error: ${error?.message || error}`, "lavalinkError");
    });

    this.kazagumo.shoukaku.on("close", (name, code, reason) => {
      this.client.logger.warn(`Lavalink ${name} closed (${code}) ${reason || "No reason"}`);
    });

    this.kazagumo.on("playerStart", (player, track) => {
      this.capturePlayerState(player, track, { event: "start" });
      void this.client.dashboardTelemetry?.music(
        player.guildId,
        `Started playing ${track?.title || "a track"}`,
        {
          action: "start",
          track: this.serializeTrack(track),
          queueSize: player.queue?.size || 0,
          volume: player.volume ?? 80,
          paused: Boolean(player.paused),
          loop: player.loop || "none"
        }
      );
      this.sendPlayerNotice(player, [
        `# ${this.client.config.Client.emoji.fun} Now Playing`,
        `**${track.title}**`,
        `${track.author || "Unknown Artist"}`,
        `${track.uri ? `[Open Track](${track.uri})` : "No track URL"}`,
      ]);
    });

    this.kazagumo.on("playerEmpty", async (player) => {
      this.capturePlayerState(player, null, { event: "ended", endedAt: Date.now() });
      void this.client.dashboardTelemetry?.music(
        player.guildId,
        "Playback queue finished",
        {
          action: "queue_end",
          queueSize: 0,
          endedAt: new Date().toISOString()
        }
      );
      await this.sendPlayerNotice(player, [
        `# ${this.client.config.Client.emoji.cross} Queue Ended`,
        "The queue is empty.",
      ]);
    });

    this.kazagumo.on("playerClosed", async (player) => {
      this.capturePlayerState(player, null, { event: "closed", endedAt: Date.now() });
      void this.client.dashboardTelemetry?.music(
        player.guildId,
        "Music player connection closed",
        {
          action: "closed",
          queueSize: player.queue?.size || 0,
          endedAt: new Date().toISOString()
        },
        "warning"
      );
      await this.sendPlayerNotice(player, [
        `# ${this.client.config.Client.emoji.cross} Player Closed`,
        "The voice connection was closed and the player was cleaned up.",
      ]);
    });
  }

  async sendPlayerNotice(player, lines) {
    const channel = player.textId ? this.client.channels.cache.get(player.textId) : null;
    if (!channel?.send) return;
    const emoji = this.client.config.Client.emoji;
    await channel.send({
      components: [
        buildNoticePanel({
          title: `${emoji.guide || emoji.fun || emoji.utility} Music Update`,
          lines,
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    }).catch(() => {});
  }

  ensureReady() {
    return Boolean(this.kazagumo);
  }

  getNodes() {
    return this.kazagumo ? [...this.kazagumo.shoukaku.nodes.values()] : [];
  }

  getConnectedNodes() {
    return this.getNodes().filter((node) => node.state === 1);
  }

  hasConnectedNode() {
    return this.getConnectedNodes().length > 0;
  }

  async waitForNode(timeout = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      if (this.hasConnectedNode()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return this.hasConnectedNode();
  }

  async ensureAvailable() {
    await this.init();
    if (!this.kazagumo) {
      throw new Error("Music is not configured. Add a working Lavalink node in settings.");
    }

    if (this.hasConnectedNode()) {
      return true;
    }

    await this.waitForNode();
    if (this.hasConnectedNode()) {
      return true;
    }

    const configured = this.client.config.Lavalink?.Nodes?.[0];
    const hint = configured?.url ? `Configured node: ${configured.url}` : "No Lavalink nodes are configured.";
    throw new Error(`No Lavalink node is online right now. ${hint}`);
  }

  getPlayer(guildId) {
    return this.kazagumo?.players?.get(guildId) || null;
  }

  inferArtwork(track) {
    if (!track) return null;
    if (track.thumbnail) return track.thumbnail;
    if (track.artworkUrl) return track.artworkUrl;
    if (track.uri && typeof track.uri === "string") {
      try {
        const url = new URL(track.uri);
        if (url.hostname.includes("youtube.com")) {
          const videoId = url.searchParams.get("v");
          if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }

        if (url.hostname === "youtu.be") {
          const videoId = url.pathname.replace(/^\/+/, "");
          if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  serializeTrack(track) {
    if (!track) return null;
    return {
      title: track.title || "Unknown Track",
      author: track.author || "Unknown Artist",
      length: Number(track.length || 0),
      uri: track.uri || null,
      identifier: track.identifier || null,
      requester: track.requester
        ? {
            id: track.requester.id || null,
            username: track.requester.username || track.requester.tag || "Unknown User"
          }
        : null,
      thumbnail: this.inferArtwork(track)
    };
  }

  getPlayerPosition(player, existing = {}) {
    const rawPosition = Number(player?.position);
    if (Number.isFinite(rawPosition) && rawPosition >= 0) {
      return rawPosition;
    }

    if (Number.isFinite(existing.position) && existing.position >= 0) {
      return existing.position;
    }

    return 0;
  }

  capturePlayerState(player, track = player?.queue?.current || null, extra = {}) {
    if (!player?.guildId) return null;
    const now = Date.now();
    const currentTrack = this.serializeTrack(track);
    const existing = this.dashboardState.get(player.guildId) || {};
    const position = extra.position ?? this.getPlayerPosition(player, existing);
    const startedAt = extra.startedAt
      || (extra.event === "start" ? now - position : existing.startedAt || (position > 0 ? now - position : null))
      || null;

    const snapshot = {
      guildId: player.guildId,
      active: Boolean(currentTrack),
      status: extra.event === "ended" ? "idle" : extra.event === "closed" ? "closed" : player.paused ? "paused" : currentTrack ? "playing" : "idle",
      startedAt,
      endedAt: extra.endedAt || null,
      updatedAt: now,
      position,
      positionUpdatedAt: now,
      volume: Number(player.volume || 0),
      paused: Boolean(player.paused),
      loop: player.loop || "none",
      queueSize: Number(player.queue?.size || 0),
      upcoming: player.queue?.map?.((queuedTrack, index) => ({
        ...this.serializeTrack(queuedTrack),
        position: index + 1
      }))?.slice?.(0, 5) || [],
      currentTrack
    };

    this.dashboardState.set(player.guildId, snapshot);
    return snapshot;
  }

  getDashboardSnapshot(guildId) {
    const player = this.getPlayer(guildId);
    if (player?.queue?.current) {
      return this.capturePlayerState(player);
    }
    return this.dashboardState.get(guildId) || null;
  }

  async createPlayer({ guild, member, textId }) {
    await this.ensureAvailable();

    const current = this.getPlayer(guild.id);
    if (current) {
      current.setTextChannel(textId);
      return current;
    }

    return this.kazagumo.createPlayer({
      guildId: guild.id,
      voiceId: member.voice.channelId,
      textId,
      shardId: guild.shardId,
      deaf: true,
      volume: 80,
    });
  }

  async search(query, requester) {
    await this.ensureAvailable();
    return this.kazagumo.search(query, { requester });
  }

  async destroy(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) return false;
    this.capturePlayerState(player, null, { event: "closed", endedAt: Date.now() });
    await player.destroy().catch((error) => {
      if (!String(error?.message || error).includes("already destroyed")) {
        throw error;
      }
    });
    return true;
  }

  formatDuration(ms) {
    if (!ms || ms <= 0) return "Live";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  queuePages(player, pageSize = 10) {
    const entries = player.queue.map((track, index) => {
      return `\`${index + 1}.\` **${track.title}**\n${track.author || "Unknown Artist"}  ${this.client.config.Client.emoji.dot}  \`${this.formatDuration(track.length)}\``;
    });

    if (!entries.length) return ["No upcoming tracks."];

    const pages = [];
    for (let index = 0; index < entries.length; index += pageSize) {
      pages.push(entries.slice(index, index + pageSize).join("\n\n"));
    }
    return pages;
  }

  formatVolume(value) {
    return `${Math.max(0, Math.round(Number(value) || 0))}%`;
  }

  summarizeTrack(track) {
    if (!track) {
      return ["Nothing is playing right now."];
    }

    return [
      `**${track.title}**`,
      `${track.author || "Unknown Artist"}  ${this.client.config.Client.emoji.dot}  \`${this.formatDuration(track.length)}\``,
      track.uri ? `[Open Track](${track.uri})` : null,
    ].filter(Boolean);
  }

  buildNowPlayingLines(player) {
    const track = player?.queue?.current;
    if (!track) {
      return ["Nothing is playing right now."];
    }

    return [
      ...this.summarizeTrack(track),
      `Volume: **${this.formatVolume(player.volume)}**`,
      `Loop: **${player.loop || "none"}**`,
      `Queue: **${player.queue.totalSize || 1}** track(s)`,
      player.paused ? "Status: **Paused**" : "Status: **Playing**",
    ];
  }

  async fetchLyrics(track) {
    const artist = encodeURIComponent((track.author || "").split(",")[0].replace(/\s*-\s*topic$/i, "").trim());
    const title = encodeURIComponent((track.title || "").split("(")[0].trim());
    if (!artist || !title) return null;

    const response = await this.client.fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`).catch(() => null);
    if (!response?.ok) return null;
    const body = await response.json().catch(() => null);
    return body?.lyrics || null;
  }

  async handleVoiceStateUpdate(oldState, newState) {
    if (!this.kazagumo) return;
    const guild = newState.guild || oldState.guild;
    const player = this.getPlayer(guild.id);
    if (!player) return;

    const me = guild.members.me || guild.members.cache.get(this.client.user.id);
    const botChannelId = me?.voice?.channelId;
    if (!botChannelId) {
      await this.destroy(guild.id);
      return;
    }

    const voiceChannel = guild.channels.cache.get(botChannelId);
    const nonBots = voiceChannel?.members?.filter((member) => !member.user.bot) || [];
    if (nonBots.size === 0) {
      // Stay in voice channel even when empty
      return;
    }
  }
}

module.exports = MusicManager;
