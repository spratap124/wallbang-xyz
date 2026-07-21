# WallBang Discord bot

Handles **launch VIP offer** community onboarding:

1. **Welcome DM** — when someone joins the server, they get a DM with the 2-step offer (sign in with Steam + join Discord).
2. **#launch-giveaway announcements** — handled by the Next.js app via `DISCORD_GIVEAWAY_WEBHOOK_URL` when a player claims VIP on Steam login.

## Setup

### 1. Discord Developer Portal

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** → create a bot and copy the token → `DISCORD_BOT_TOKEN`.
3. **Privileged Gateway Intents** (required):
   - Server Members Intent
4. **OAuth2 → URL Generator** — scopes: `bot`. Permissions:
   - View Channels
   - Send Messages (for DMs)
5. Invite the bot to your WallBang server.

### 2. Discord server

1. Create `#launch-giveaway` (or use an existing channel) for VIP claim announcements.
2. **Channel Settings → Integrations → Webhooks** → create webhook → `DISCORD_GIVEAWAY_WEBHOOK_URL` (used by Next.js, not the bot).
3. Copy server (guild) ID → `DISCORD_GUILD_ID` (Developer Mode → right-click server → Copy ID).

### 3. Environment

Add to the repo root `.env` (see `.env.production.example`):

```env
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_GIVEAWAY_WEBHOOK_URL=...   # in root .env — posts to #launch-giveaway when VIP is claimed
GIVEAWAY_MAX_WINNERS=100
GIVEAWAY_VIP_MONTHS=3
```

### 4. Run locally

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... npm start
```

Run the Next.js app separately. VIP is granted on Steam login at `/offer`.

### 5. Production (Docker)

```bash
docker compose -f docker-compose.prod.yml --profile discord --env-file .env up -d
```

## Player flow

1. Visit [wallbang.xyz/offer](https://wallbang.xyz/offer) and **sign in with Steam** → VIP granted automatically (first 100 players, 3 months).
2. **Join the Discord server** → welcome DM with offer recap.
3. A message is posted in `#launch-giveaway` announcing each new VIP claim.

No Steam profile links or channel posting required.
