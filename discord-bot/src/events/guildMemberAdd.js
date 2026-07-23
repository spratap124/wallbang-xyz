function buildWelcomeMessage(siteUrl, offerUrl) {
  return [
    "**Welcome to WallBang!**",
    "",
    "We're giving **3 months of VIP** to the first **100 players**.",
    "",
    "**How to claim (both steps required):**",
    "1. Sign in with Steam at the offer page",
    "2. Join this Discord, then **Link Discord & claim VIP** on the site",
    "",
    `Claim here: **${offerUrl}**`,
    "",
    "VIP perks include a reserved server slot, in-game chat tag, colored chat, and more.",
    "",
    "See you on the servers!",
  ].join("\n");
}

export function registerGuildMemberAdd(client, config) {
  client.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== config.guildId) return;
    if (member.user.bot) return;

    const offerUrl = `${config.siteUrl}/offers`;
    const message = buildWelcomeMessage(config.siteUrl, offerUrl);

    try {
      await member.send(message);
      console.log(
        `[welcome] Sent launch offer DM to ${member.user.tag} (${member.id})`,
      );
    } catch (err) {
      console.warn(
        `[welcome] Could not DM ${member.user.tag} (${member.id}) — DMs may be closed`,
        err,
      );
    }

    if (!config.pluginApiKey) {
      console.warn(
        "[welcome] PLUGIN_API_KEY not set — skipping VIP grant on join",
      );
      return;
    }

    try {
      const response = await fetch(
        `${config.siteUrl}/api/v1/discord/member-joined`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.pluginApiKey,
          },
          body: JSON.stringify({
            discordUserId: member.id,
            discordUsername: member.user.globalName || member.user.username,
          }),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        console.warn(
          `[welcome] member-joined API failed (${response.status})`,
          json,
        );
        return;
      }
      console.log(
        `[welcome] member-joined for ${member.user.tag}:`,
        json?.data ?? json,
      );
    } catch (err) {
      console.warn("[welcome] member-joined request failed", err);
    }
  });
}

export function registerReadyLog(client, config) {
  client.once("ready", () => {
    console.log(`[bot] Logged in as ${client.user.tag}`);
    console.log(
      `[bot] Launch VIP: Steam login + Discord membership required at ${config.siteUrl}/offers`,
    );
  });
}
