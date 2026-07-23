# WallBang Discord bot

Handles **launch VIP offer** community onboarding:

1. **Welcome DM** — when someone joins the server, they get a DM with the claim steps (Steam + Discord link).
2. **Member-joined notify** — calls the Next.js API so VIP can unlock if Discord was already linked after Steam login.
3. **#launch-giveaway announcements** — handled by the Next.js app via `DISCORD_GIVEAWAY_WEBHOOK_URL` when VIP is claimed.

## Setup

### 1. Discord Developer Portal

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** → create a bot and copy the token → `DISCORD_BOT_TOKEN`.
3. **OAuth2** → copy Client ID / Client Secret → `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` (used by Next.js for Discord linking).
4. **OAuth2 → Redirects** → add `{SITE_URL}/api/auth/discord/callback`.
5. **Privileged Gateway Intents** (required):
   - Server Members Intent
6. **OAuth2 → URL Generator** — scopes: `bot`. Permissions:
   - View Channels
   - Send Messages (for DMs)
7. Invite the bot to your WallBang server.

### 2. Discord server

1. Create `#launch-giveaway` (or use an existing channel) for VIP claim announcements.
2. **Channel Settings → Integrations → Webhooks** → create webhook → `DISCORD_GIVEAWAY_WEBHOOK_URL` (used by Next.js, not the bot).
3. Copy server (guild) ID → `DISCORD_GUILD_ID` (Developer Mode → right-click server → Copy ID).

### 3. Environment

Add to the repo root `.env` (see `.env.production.example`):

```env
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GIVEAWAY_WEBHOOK_URL=...   # in root .env — posts to #launch-giveaway when VIP is claimed
PLUGIN_API_KEY=...                 # bot uses this to call /api/v1/discord/member-joined
GIVEAWAY_MAX_WINNERS=100
GIVEAWAY_VIP_MONTHS=3
```

### 4. Run locally

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... PLUGIN_API_KEY=... npm start
```

Run the Next.js app separately. VIP is granted only after Steam login **and** Discord membership verification at `/offers`.

### 5. Production (Docker)

```bash
docker compose -f docker-compose.prod.yml --profile discord --env-file .env up -d
```

On the VPS, Node.js is not installed on the host — run setup scripts via Docker:

```bash
cd /home/ubuntu/wallbang-xyz
sudo docker run --rm --network host --env-file .env \
  -v "$(pwd):/repo" -w /repo node:20-alpine \
  node scripts/discord-setup.mjs --pin-rules
```

The bot needs **Manage Messages** in `#launch-giveaway` to pin rules. If pin fails, the script still posts the message — pin it manually in Discord.

## Player flow

1. Visit [wallbang.xyz/offers](https://wallbang.xyz/offers) and **sign in with Steam**.
2. **Join the Discord server**, then **Link Discord & claim VIP** on the site.
3. VIP is granted only after both steps (first 100 players, 3 months). A message is posted in `#launch-giveaway`.
