

const env = process.env;

module.exports = {
  Shards: {
    totalShards: env.TOTAL_SHARDS || "auto",
    shardsPerCluster: Number(env.SHARDS_PER_CLUSTER || 4),
    totalClusters: env.TOTAL_CLUSTERS || "auto",
  },
  Client: {
    Token: env.DISCORD_TOKEN || "",
    Prefix: env.BOT_PREFIX || "?",
    VanityGuardToken: env.VANITY_GUARD_TOKEN || "",
    botId: env.DISCORD_CLIENT_ID || "",
    botSecret: env.DISCORD_CLIENT_SECRET || "",
    TopGG: env.TOP_GG_TOKEN || "",
    DefaultPermissions: ["SendMessages", "EmbedLinks", "ReadMessageHistory"],
    DefaultUsersPermissions: ["SendMessages"],
    Owners: (env.BOT_OWNERS || "1434858158618054756,1252101579855630346")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    VanityGuard: env.VANITY_GUARD_URL || "",
    QuiteJsk: [""],
    OpenAIApi: env.OPENAI_API_KEY || "",
    LogsChannel: env.LOGS_CHANNEL_ID || "",

    Emojis: {
      Flags: {
        BugHunter1: "🐛",
        BugHunter2: "🐞",
        CertifiedModerator: "🛡️",
        Exployee: "👨‍💼",
        EarlySupporter: "💖",
        EarlyVerifiedBotDeveloper: "👨‍💻",
        HyperSquadBalance: "⚖️",
        HyperSquadBravery: "🦁",
        HyperSquadBrilliance: "🧠",
        HyperSquadEvent: "🏁",
        PartnerServerOwner: "🤝",
        VerifiedBot: "✅",
        SupportCommands: "✔️",
      },
    },

    PrimaryColor: "#2b2d31",
    ErrorColor: "#ff0000",
    SuccessColor: "#00ff4cff",

    emoji: {
      verify: "✅",
      automod: "🤖",
      antinuke: "🛡️",
      POGYCLIENTemo: "✨",
      invite: "📨",
      support: "🆘",
      welcome: "👋",
      moderation: "🔨",
      utility: "🛠️",
      fun: "🎉",
      image: "🖼️",
      giveaway: "🎁",
      tick: "✔️",
      cross: "❌",
      gear: "⚙️",
      seen: "👀",
      down: "⬇️",
      online: "🟢",
      idle: "🟡",
      dnd: "🔴",
      member: "👤",
      gift: "🎁",
      giveaway2: "🎁",
      loading: "⏳",
      developerEmoji: "👨‍💻",
      communitymanager: "🧑‍💼",
      ownerEmoji: "👑",
      adminEmoji: "🛡️",
      managerEmoji: "📋",
      moderatorEmoji: "🔨",
      staffEmoji: "🧑‍💼",
      supporterEmoji: "💖",
      bughunterEmoji: "🐛",
      specialonesEmoji: "⭐",
      add: "➕",
      info: "ℹ️",
      channel: "📺",
      Exclamation: "❗",
      emptybar: "░",
      barleft: "█",
      barmid: "█",
      barright: "█",
      emptybarend: "░",
      arrow: "➡️",
      dot: "•",
      join: "👋",
      leave: "👋",
      fake: "🚫",
      memberadd: "👤",
      star: "⭐",
      guide: "📘",
    },

    serverId: env.HOME_SERVER_ID || "",
    roleIds: {
      ownerRoleId: env.OWNER_ROLE_ID || "",
      communityManagerRoleId: env.COMMUNITY_MANAGER_ROLE_ID || "",
      adminRoleId: env.ADMIN_ROLE_ID || "",
      developerRoleId: env.DEVELOPER_ROLE_ID || "",
      managerRoleId: env.MANAGER_ROLE_ID || "",
      moderatorRoleId: env.MODERATOR_ROLE_ID || "",
      staffRoleId: env.STAFF_ROLE_ID || "",
      supporterRoleId: env.SUPPORTER_ROLE_ID || "",
      bughunterRoleId: env.BUGHUNTER_ROLE_ID || "",
      specialonesRoleId: env.SPECIAL_ONES_ROLE_ID || "",
    },
  },

  Database: {
    Uri: env.MONGODB_URI || "",
  },

  Lavalink: {
    DefaultSearchEngine: env.LAVALINK_SEARCH_ENGINE || "youtube",
    Resume: env.LAVALINK_RESUME ? env.LAVALINK_RESUME === "true" : true,
    ResumeTimeout: Number(env.LAVALINK_RESUME_TIMEOUT || 60),
    Nodes: [
      {
        name: env.LAVALINK_NODE_NAME || "main",
        url: env.LAVALINK_NODE_URL || "",
        auth: env.LAVALINK_NODE_AUTH || "",
        secure: env.LAVALINK_NODE_SECURE ? env.LAVALINK_NODE_SECURE === "true" : true,
      },
    ],
  },

  Webhook: {
    Url: env.WEBHOOK_URL || "",
  },

  Url: {
    InviteURL: env.INVITE_URL || "",
    SupportURL: env.SUPPORT_URL || "https://discord.gg/codexdev",
    GuideURL: env.GUIDE_URL || "https://codexdevs.in",
  },
};
