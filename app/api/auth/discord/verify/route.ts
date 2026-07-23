import { getSession } from "@/lib/auth/session";
import { isDiscordLinkConfigured } from "@/lib/discord/config";
import { announceLaunchGiveawayGrant } from "@/lib/discord/giveaway-announce";
import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
} from "@/lib/permissions/authz";
import { processLaunchGiveaway } from "@/lib/permissions/service";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Re-check Discord guild membership for a Steam user who already linked Discord.
 * POST /api/auth/discord/verify
 */
export async function POST(request: Request): Promise<Response> {
  if (!isDiscordLinkConfigured()) {
    return jsonError("Discord linking is not configured.", 503);
  }
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`discord-verify:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return jsonError("Too many verification attempts. Try again shortly.", 429);
  }

  try {
    const result = await processLaunchGiveaway({ steamId: session.steamId });
    if (result.status === "granted") {
      void announceLaunchGiveawayGrant(result).catch((err) => {
        console.error("[discord/verify] Discord announcement failed", err);
      });
    }
    return jsonOk({
      status: result.status,
      position: result.position,
      expiresAt: result.expiresAt?.toISOString() ?? null,
      discordUsername: result.discordUsername ?? null,
    });
  } catch (err) {
    console.error("[discord/verify]", err);
    return jsonError(
      err instanceof Error ? err.message : "Verification failed.",
      400,
    );
  }
}
