# WallBang Discord bot

Handles the **launch VIP giveaway**:

1. **Welcome DM** — when someone joins the server, they get a DM explaining the offer.
2. **#launch-giveaway** — when they post a Steam profile link, the bot verifies they signed in on [wallbang.xyz](https://wallbang.xyz) and grants VIP to the first 100 eligible entries.

## Setup

### 1. Discord Developer Portal

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** → create a bot and copy the token → `DISCORD_BOT_TOKEN`.
3. **Privileged Gateway Intents** (required):
   - Server Members Intent
   - Message Content Intent
4. **OAuth2 → URL Generator** — scopes: `bot`. Permissions:
   - View Channels
   - Send Messages
   - Read Message History
   - Add Reactions
5. Invite the bot to your WallBang server.

### 2. Discord server

1. Create `#launch-giveaway` (or use an existing channel).
2. Copy IDs (Developer Mode → right-click → Copy ID):
   - Server (guild) ID → `DISCORD_GUILD_ID`
   - `#launch-giveaway` channel ID → `DISCORD_GIVEAWAY_CHANNEL_ID`

### 3. Environment

Add to the repo root `.env` (see `.env.production.example`):

```env
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_GIVEAWAY_CHANNEL_ID=...
PLUGIN_API_KEY=...          # same key the CS2 plugins use
GIVEAWAY_MAX_WINNERS=100
# REDIS_PASSWORD=...          # only if using --profile redis
```

### 4. Run locally

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... DISCORD_GIVEAWAY_CHANNEL_ID=... \
  PLUGIN_API_KEY=... WALLBANG_API_URL=http://localhost:3000 npm start
```

Run the Next.js app separately so `/api/v1/discord/giveaway-entry` is available.

### 5. Production (Docker)

```bash
docker compose -f docker-compose.prod.yml --profile discord --env-file .env up -d
```

The bot calls `http://nextjs:3000` inside the Compose network.

## Player flow

1. Join the Discord server → receive welcome DM with instructions.
2. Sign in with Steam at wallbang.xyz.
3. Post numeric Steam profile URL in `#launch-giveaway`, e.g.  
   `https://steamcommunity.com/profiles/76561198000000000`
4. Bot validates login, grants VIP (source: `GIVEAWAY`), and replies with entry number.

Custom `/id/` vanity URLs are not accepted — players must use the `/profiles/` link from Steam.
