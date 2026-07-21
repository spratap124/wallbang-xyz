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
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://wallbang.xyz",
};
