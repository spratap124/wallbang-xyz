#!/usr/bin/env node
/**
 * Discover Discord IDs for the WallBang bot and optionally ensure #launch-giveaway exists.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=... node scripts/discord-setup.mjs
 *   DISCORD_BOT_TOKEN=... node scripts/discord-setup.mjs --create-channel
 *   DISCORD_BOT_TOKEN=... node scripts/discord-setup.mjs --pin-rules
 */

const API = "https://discord.com/api/v10";
const CHANNEL_NAME = "launch-giveaway";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const createChannel = process.argv.includes("--create-channel");
const pinRules = process.argv.includes("--pin-rules");

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Discord API ${response.status}: ${data?.message ?? response.statusText}`,
    );
  }

  return data;
}

function rulesMessage(siteUrl) {
  return [
    "**Launch VIP Offer — first 100 players**",
    "",
    "1. Sign in with Steam at **" + siteUrl + "/offers** — VIP is granted automatically",
    "2. Join the WallBang Discord server",
    "",
    "No profile links or forms required. Each claim is announced in this channel.",
    "",
    "VIP perks: reserved slot, in-game chat tag, colored chat, and more.",
    "",
    "Launch VIP lasts **3 months** from the day you sign in.",
  ].join("\n");
}

async function main() {
  const bot = await api("/users/@me");
  console.log(`Bot: ${bot.username} (${bot.id})`);

  const guilds = await api("/users/@me/guilds");
  if (guilds.length === 0) {
    console.error("Bot is not in any servers. Invite it first.");
    process.exit(1);
  }

  let guild = guilds.find((g) => /wallbang/i.test(g.name)) ?? guilds[0];
  console.log(`Guild: ${guild.name} (${guild.id})`);

  let channels = await api(`/guilds/${guild.id}/channels`);
  let giveaway = channels.find(
    (c) => c.type === 0 && c.name === CHANNEL_NAME,
  );

  if (!giveaway && createChannel) {
    giveaway = await api(`/guilds/${guild.id}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: CHANNEL_NAME,
        type: 0,
        topic:
          "Launch VIP announcements — sign in at wallbang.xyz/offers to claim (first 100 get 3 months free).",
      }),
    });
    console.log(`Created #${CHANNEL_NAME} (${giveaway.id})`);
  } else if (!giveaway) {
    console.error(
      `#${CHANNEL_NAME} not found. Re-run with --create-channel to create it.`,
    );
    process.exit(1);
  } else {
    console.log(`Channel: #${giveaway.name} (${giveaway.id})`);
  }

  if (pinRules) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wallbang.xyz";
    const message = await api(`/channels/${giveaway.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: rulesMessage(siteUrl) }),
    });
    try {
      await api(`/channels/${giveaway.id}/pins/${message.id}`, {
        method: "PUT",
      });
      console.log("Pinned giveaway rules in #" + CHANNEL_NAME);
    } catch (err) {
      console.warn(
        `Posted rules in #${CHANNEL_NAME} but could not pin (bot needs Manage Messages): ${err.message}`,
      );
      console.warn(`Pin manually: https://discord.com/channels/${guild.id}/${giveaway.id}/${message.id}`);
    }
  }

  console.log("\nAdd these to .env on the VPS:\n");
  console.log(`DISCORD_BOT_TOKEN=${token}`);
  console.log(`DISCORD_GUILD_ID=${guild.id}`);
  console.log(
    "DISCORD_GIVEAWAY_WEBHOOK_URL=...  # create in #launch-giveaway → Integrations → Webhooks",
  );
  console.log("GIVEAWAY_MAX_WINNERS=100");
  console.log("GIVEAWAY_VIP_MONTHS=3");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
