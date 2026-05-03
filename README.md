# Pogy Bot

Pogy Bot is a full Discord bot platform with a live web dashboard, moderation tools, anti-nuke protection, automod controls, music playback, command management, and guild configuration flows.

## Owner

- GitHub: [devrock07](https://github.com/devrock07)

## Highlights

- Discord bot with moderation, utility, music, fun, and management systems
- Zenith dashboard for guild configuration and live status views
- Shared config between bot commands and dashboard controls
- AutoMod, Anti-Nuke, logs, command center, docs, and music monitoring
- MongoDB-backed data storage
- Lavalink-based music system

## Showcase

![Dashboard Showcase 1](attach/Screenshot%202026-04-19%20151916.png)
![Dashboard Showcase 2](attach/Screenshot%202026-04-19%20151923.png)
![Dashboard Showcase 3](attach/Screenshot%202026-04-19%20151931.png)
![Dashboard Showcase 4](attach/Screenshot%202026-04-19%20151937.png)
![Dashboard Showcase 5](attach/Screenshot%202026-04-19%20151944.png)
![Dashboard Showcase 6](attach/Screenshot%202026-04-19%20151950.png)
![Dashboard Showcase 7](attach/Screenshot%202026-04-19%20151956.png)

## Project Structure

- `index.js` boots the main bot launcher
- `source/` contains the Discord bot code, commands, listeners, and shared settings
- `dashboard/` contains the Zenith dashboard client and server
- `scripts/run-services.js` starts bot and dashboard together
- `attach/` contains dashboard showcase screenshots for GitHub

## Tech Stack

- Node.js
- Discord.js
- Express / native Node HTTP
- MongoDB
- Lavalink
- React
- Vite

## Local Setup

1. Install dependencies:

```bash
npm install
npm --prefix dashboard install
```

2. Create your env file:

```bash
copy .env.example .env
```

3. Fill in your real values inside `.env`.

Required values:

- `DISCORD_TOKEN`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `MONGODB_URI`
- `LAVALINK_NODE_URL`
- `LAVALINK_NODE_AUTH`
- `NEXTAUTH_SECRET`

Recommended values:

- `DASHBOARD_PUBLIC_URL`
- `BOT_API_BASE_URL`
- `DASHBOARD_BOT_STATUS_URL`
- `SUPPORT_URL`
- `GUIDE_URL`

4. Start everything:

```bash
npm start
```

## Available Scripts

- `npm start` starts bot and dashboard in production mode
- `npm run dev` starts bot and dashboard in development mode
- `npm run start:bot` starts only the bot
- `npm run dev:bot` starts only the bot in watch mode
- `npm run start:dashboard` starts only the dashboard server
- `npm run dev:dashboard` starts only the dashboard frontend
- `npm run build:dashboard` builds the dashboard

## Environment Variables

Main Discord app values:

- `DISCORD_TOKEN` bot token
- `DISCORD_BOT_TOKEN` bot token for dashboard Discord API access
- `DISCORD_CLIENT_ID` application client ID
- `DISCORD_CLIENT_SECRET` application client secret

Database and bot services:

- `MONGODB_URI` MongoDB connection string
- `LAVALINK_NODE_NAME` Lavalink node label
- `LAVALINK_NODE_URL` Lavalink host and port
- `LAVALINK_NODE_AUTH` Lavalink password or auth token
- `LAVALINK_NODE_SECURE` `true` or `false`

Dashboard values:

- `DASHBOARD_PUBLIC_URL` public URL of the dashboard, for example `https://your-dashboard-domain.com`
- `BOT_API_BASE_URL` public URL of the bot status/config API, for example `https://your-bot-host.com:3001`
- `DASHBOARD_BOT_STATUS_URL` URL the dashboard uses to talk to the bot API
- `NEXTAUTH_SECRET` session signing secret

## How The Bot And Dashboard Connect

The project uses two running services:

1. The bot process
   This logs in to Discord, runs commands, listeners, AutoMod, Anti-Nuke, music, and exposes the bot status/config API on port `3001`.

2. The dashboard process
   This serves the Zenith web UI on port `3000`, handles Discord login, and reads/writes guild configuration.

For a production deployment, the dashboard needs to be able to reach the bot API through `BOT_API_BASE_URL` / `DASHBOARD_BOT_STATUS_URL`.

Example:

- Dashboard public site: `https://dashboard.example.com`
- Bot API public URL: `https://bot.example.com:3001`

Then your env would look like:

```env
DASHBOARD_PUBLIC_URL=https://dashboard.example.com
BOT_API_BASE_URL=https://bot.example.com:3001
DASHBOARD_BOT_STATUS_URL=https://bot.example.com:3001
```

## Discord Developer Portal Setup

Before deploying, configure your Discord application:

1. Open the Discord Developer Portal.
2. Select your application.
3. Copy the Application ID into `DISCORD_CLIENT_ID`.
4. Copy the Client Secret into `DISCORD_CLIENT_SECRET`.
5. Copy the bot token into `DISCORD_TOKEN` and `DISCORD_BOT_TOKEN`.
6. Add your dashboard callback URL in OAuth2 Redirects:

Local:

- `http://localhost:3000/api/auth/callback/discord`

Production example:

- `https://dashboard.example.com/api/auth/callback/discord`

## Production Split

This repo is now arranged to support the split you asked for:

- Dashboard on Vercel
- Bot on Pterodactyl

The dashboard frontend is built with Vite, and the dashboard auth/data endpoints are available through Vercel serverless routing in:

- [dashboard/api/[...route].js](dashboard/api/[...route].js)
- [dashboard/vercel.json](dashboard/vercel.json)

The bot stays as the long-running Discord process and keeps exposing the bot API on port `3001`.

## Dashboard On Vercel

### What Vercel Hosts

Vercel will host:

- the React dashboard frontend
- Discord login callback handling
- session handling
- guild/config API routes
- server-to-server calls from the dashboard API to MongoDB and the bot API

### Vercel Environment Variables

Add these environment variables in your Vercel project:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `MONGODB_URI`
- `NEXTAUTH_SECRET`
- `DASHBOARD_PUBLIC_URL`
- `BOT_API_BASE_URL`
- `DASHBOARD_BOT_STATUS_URL`

Recommended production values:

```env
DASHBOARD_PUBLIC_URL=https://your-dashboard.vercel.app
BOT_API_BASE_URL=https://bot-api.yourdomain.com
DASHBOARD_BOT_STATUS_URL=https://bot-api.yourdomain.com
```

### Vercel Deploy Steps

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Set the project root to `dashboard`.
4. Confirm these settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add all required environment variables.
6. Deploy.

### Discord OAuth Redirect For Vercel

In the Discord Developer Portal, add this redirect URL:

- `https://your-dashboard.vercel.app/api/auth/callback/discord`

If you connect a custom domain, also add:

- `https://dashboard.yourdomain.com/api/auth/callback/discord`

## Bot Hosting Setup

The bot should be deployed on a host that supports long-running Node processes.

Good choices:

- Pterodactyl
- Railway
- Render background service
- VPS
- PM2

### Bot Deployment Steps

1. Upload the repo to your host.
2. Install dependencies:

```bash
npm install
```

3. Set the required env vars:

- `DISCORD_TOKEN`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `MONGODB_URI`
- `LAVALINK_NODE_URL`
- `LAVALINK_NODE_AUTH`
- `PORT` if your panel or reverse proxy needs a custom dashboard/status port mapping

4. Start the bot:

```bash
npm run start:bot
```

5. Make sure the bot API is reachable from Vercel.

The dashboard must be able to reach these bot endpoints:

- `GET /guilds`
- `POST /guilds/:guildId/cache`
- `GET /guilds/:guildId/music`

### Pterodactyl Notes

For the split deployment to work cleanly:

- keep the bot running continuously on Pterodactyl
- expose the bot API publicly through a domain or reverse proxy
- point that public URL into:
  - `BOT_API_BASE_URL`
  - `DASHBOARD_BOT_STATUS_URL`

Example:

- Bot panel machine runs the process
- Nginx or a proxy exposes `https://bot-api.yourdomain.com`
- Vercel dashboard calls that URL from serverless functions

If your bot API is not publicly reachable, the dashboard can still load login and session pages, but live guild sync, music status, and config pushback to the bot will fail.

## Recommended Production Split

If you want the cleanest production setup:

- Host the dashboard on Vercel
- Host the bot on Pterodactyl
- Put the bot API behind a public domain such as `https://bot-api.yourdomain.com`
- Set `BOT_API_BASE_URL` to that bot API URL
- Set `DASHBOARD_BOT_STATUS_URL` to that same bot API URL
- Set `DASHBOARD_PUBLIC_URL` to the public Vercel dashboard URL
- Add the Vercel callback URL in the Discord Developer Portal

## Publish Checklist

Before pushing this repo to GitHub:

1. Make sure `.env` is not committed.
2. Keep only `.env.example` in Git.
3. Rotate any old secrets that were previously exposed.
4. Confirm your Discord OAuth redirect URL matches your real dashboard domain.
5. Confirm your dashboard can reach the bot API URL.
6. Confirm the Vercel project root is `dashboard`.

## Security Note

This repository is configured to read sensitive values from environment variables. Do not commit your `.env` file.

If a token, client secret, database URI, or webhook was ever exposed before cleanup, rotate it before making the repository public.

## License

This project is distributed under the license in [LICENSE](LICENSE).
