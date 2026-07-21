function buildWelcomeMessage(siteUrl, offerUrl) {
  return [
    "**Welcome to WallBang!**",
    "",
    "We're giving **3 months of VIP** to the first **100 players** who sign in with Steam.",
    "",
    "**How to claim (2 steps):**",
    `1. Sign in with Steam at **${siteUrl}/offer** — VIP is granted automatically`,
    "2. You're already here on Discord — welcome aboard!",
    "",
    `Full offer details: **${offerUrl}**`,
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

    const offerUrl = `${config.siteUrl}/offer`;
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
  });
}

export function registerReadyLog(client, config) {
  client.once("ready", () => {
    console.log(`[bot] Logged in as ${client.user.tag}`);
    console.log(
      `[bot] Launch VIP offer: sign in at ${config.siteUrl}/offer (announcements in #launch-giveaway via webhook)`,
    );
  });
}
