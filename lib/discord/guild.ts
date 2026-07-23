import "server-only";

import {
  getDiscordBotToken,
  getDiscordGuildId,
} from "@/lib/discord/config";

/**
 * Check whether a Discord user is a member of the WallBang guild.
 * Uses the bot token (Server Members intent / guild member endpoint).
 */
export async function isDiscordGuildMember(
  discordUserId: string,
): Promise<boolean> {
  const token = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  if (!token || !guildId || !discordUserId) return false;

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    },
  );

  if (response.status === 200) return true;
  if (response.status === 404) return false;

  const body = await response.text().catch(() => "");
  console.error(
    `[discord] guild member check failed (${response.status}): ${body.slice(0, 200)}`,
  );
  return false;
}
