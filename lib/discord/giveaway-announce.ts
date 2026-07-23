import "server-only";

import { siteConfig } from "@/config/site";
import type { LaunchGiveawayResult } from "@/lib/permissions/service";

function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function buildAnnouncementMessage(result: LaunchGiveawayResult): string {
  const expiry = result.expiresAt ? formatExpiry(result.expiresAt) : "3 months";

  return [
    `🎉 **${result.personaName}** just claimed **VIP** as part of the WallBang launch offer!`,
    "",
    `Entry **#${result.position}** of **${result.maxWinners}** · VIP active until **${expiry}**`,
    "",
    `Want in? Sign in with Steam, join Discord, then claim at ${siteConfig.url}/offers — first 100 players get 3 months free.`,
  ].join("\n");
}

/** Posts a launch-giveaway grant to #launch-giveaway via webhook (best-effort). */
export async function announceLaunchGiveawayGrant(
  result: LaunchGiveawayResult,
): Promise<void> {
  if (result.status !== "granted") return;

  const webhookUrl = process.env.DISCORD_GIVEAWAY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn(
      "[giveaway] DISCORD_GIVEAWAY_WEBHOOK_URL not set — skipping Discord announcement",
    );
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: buildAnnouncementMessage(result),
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Discord webhook failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }
}
