import { ChannelType } from "discord.js";

function buildWelcomeMessage(siteUrl, giveawayChannelId) {
  return [
    "**Welcome to WallBang!**",
    "",
    "We're giving **VIP access** to the first **100 players** who complete both steps:",
    "",
    `1. Sign in with Steam at **${siteUrl}**`,
    `2. Post your Steam profile link in <#${giveawayChannelId}>`,
    "",
    "Use your numeric profile URL, for example:",
    "`https://steamcommunity.com/profiles/76561198000000000`",
    "",
    "VIP perks include a reserved server slot, in-game chat tag, and more.",
    "",
    "Good luck — see you on the servers!",
  ].join("\n");
}

export function registerGuildMemberAdd(client, config) {
  client.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== config.guildId) return;
    if (member.user.bot) return;

    const message = buildWelcomeMessage(config.siteUrl, config.giveawayChannelId);

    try {
      await member.send(message);
      console.log(
        `[welcome] Sent launch giveaway DM to ${member.user.tag} (${member.id})`,
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
  client.once("ready", async () => {
    console.log(`[bot] Logged in as ${client.user.tag}`);

    try {
      const channel = await client.channels.fetch(config.giveawayChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(
          `[bot] Giveaway channel ${config.giveawayChannelId} is missing or not a text channel`,
        );
        return;
      }
      console.log(`[bot] Watching giveaway channel #${channel.name}`);
    } catch (err) {
      console.error("[bot] Failed to resolve giveaway channel", err);
    }
  });
}
