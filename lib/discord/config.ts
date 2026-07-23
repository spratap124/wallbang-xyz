import "server-only";

import { getSiteUrl } from "@/lib/auth/config";

export function getDiscordBotToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN?.trim() || null;
}

export function getDiscordGuildId(): string | null {
  return process.env.DISCORD_GUILD_ID?.trim() || null;
}

export function getDiscordClientId(): string | null {
  return process.env.DISCORD_CLIENT_ID?.trim() || null;
}

export function getDiscordClientSecret(): string | null {
  return process.env.DISCORD_CLIENT_SECRET?.trim() || null;
}

/** True when Discord OAuth linking + guild checks can run. */
export function isDiscordLinkConfigured(): boolean {
  return Boolean(
    getDiscordClientId() &&
      getDiscordClientSecret() &&
      getDiscordBotToken() &&
      getDiscordGuildId(),
  );
}

export function getDiscordOAuthRedirectUri(): string {
  return `${getSiteUrl()}/api/auth/discord/callback`;
}
