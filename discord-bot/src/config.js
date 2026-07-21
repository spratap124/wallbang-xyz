function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  token: required("DISCORD_BOT_TOKEN"),
  guildId: required("DISCORD_GUILD_ID"),
  giveawayChannelId: required("DISCORD_GIVEAWAY_CHANNEL_ID"),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://wallbang.xyz",
  apiUrl: process.env.WALLBANG_API_URL?.trim() || "http://nextjs:3000",
  apiKey: required("PLUGIN_API_KEY"),
  maxWinners: Number.parseInt(process.env.GIVEAWAY_MAX_WINNERS ?? "100", 10),
};
