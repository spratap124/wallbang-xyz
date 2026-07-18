# Discord bot (optional)

This directory is reserved for the WallBang Discord bot container defined in
`docker-compose.prod.yml` under the `discord` profile.

The web stack starts without it. When the bot code is ready:

1. Add the bot `package.json` / entrypoint here
2. Set `DISCORD_BOT_TOKEN` in `.env`
3. Start with:

```bash
docker compose -f docker-compose.prod.yml --profile discord --env-file .env up -d
```
