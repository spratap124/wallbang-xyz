import { z } from "zod";

import { announceLaunchGiveawayGrant } from "@/lib/discord/giveaway-announce";
import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { processDiscordMemberJoined } from "@/lib/permissions/service";

const bodySchema = z.object({
  discordUserId: z.string().min(1),
  discordUsername: z.string().min(1).optional(),
});

/**
 * Called by the Discord bot when a member joins the WallBang guild.
 * Grants VIP if this Discord account is already linked to a Steam user.
 * POST /api/v1/discord/member-joined
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const result = await processDiscordMemberJoined(parsed.data);
    if (!result) {
      return jsonOk({ matched: false, status: "not_linked" as const });
    }

    if (result.status === "granted") {
      void announceLaunchGiveawayGrant(result).catch((err) => {
        console.error("[member-joined] Discord announcement failed", err);
      });
    }

    return jsonOk({
      matched: true,
      status: result.status,
      steamId: result.steamId,
      personaName: result.personaName,
      position: result.position,
      expiresAt: result.expiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Member join processing failed.";
    return jsonError(message, 400);
  }
}
