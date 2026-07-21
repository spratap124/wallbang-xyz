import { ChannelType } from "discord.js";

import { submitGiveawayEntry } from "../lib/api.js";
import { extractSteamIdFromText } from "../lib/steam.js";

function buildInvalidLinkReply(siteUrl) {
  return [
    "That message doesn't include a valid Steam profile link.",
    "",
    `1. Sign in with Steam at ${siteUrl}`,
    "2. Post your numeric profile URL here, for example:",
    "`https://steamcommunity.com/profiles/76561198000000000`",
    "",
    "Custom `/id/` links are not accepted — open your profile in Steam and copy the `/profiles/` URL.",
  ].join("\n");
}

function formatExpiry(isoDate) {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function buildSuccessReply(data) {
  const expiry = formatExpiry(data.expiresAt);

  if (data.alreadyGranted) {
    return [
      `You're already in the giveaway as **${data.personaName}** (entry **#${data.position}** of ${data.maxWinners}).`,
      "",
      `Your VIP is active until **${expiry}**.`,
      "",
      "Connect to our CS2 servers to use your reserved slot and VIP chat tag.",
    ].join("\n");
  }

  return [
    `**You're in!** VIP granted to **${data.personaName}** (entry **#${data.position}** of ${data.maxWinners}).`,
    "",
    `Your VIP lasts **3 months** and expires on **${expiry}**.`,
    "",
    "Connect to our CS2 servers to use your reserved slot and VIP chat tag.",
  ].join("\n");
}

export function registerMessageCreate(client, config) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.type !== ChannelType.GuildText) return;
    if (message.channel.id !== config.giveawayChannelId) return;

    const steamId = extractSteamIdFromText(message.content);
    if (!steamId) {
      if (message.content.includes("steamcommunity.com")) {
        await message.reply(buildInvalidLinkReply(config.siteUrl));
      }
      return;
    }

    const result = await submitGiveawayEntry({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      steamId,
      discordUserId: message.author.id,
      discordUsername: message.author.tag,
    });

    if (!result.ok) {
      await message.reply(result.error);
      return;
    }

    await message.react("✅");
    await message.reply(buildSuccessReply(result.data));
    console.log(
      `[giveaway] Granted VIP to ${result.data.personaName} (${steamId}) via ${message.author.tag}`,
    );
  });
}
