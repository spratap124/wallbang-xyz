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
  pluginApiKey: process.env.PLUGIN_API_KEY?.trim() || "",
  vipRoleId: process.env.DISCORD_VIP_ROLE_ID?.trim() || "",
  topTenRoleId: process.env.DISCORD_TOP10_ROLE_ID?.trim() || "",
  roleSyncIntervalMs: Math.max(
    60_000,
    Number.parseInt(process.env.DISCORD_ROLE_SYNC_INTERVAL_MS || "300000", 10) || 300_000,
  ),
};
