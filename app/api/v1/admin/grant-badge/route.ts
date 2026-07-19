import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { isMongoConfigured } from "@/lib/mongo";
import { grantPlayerBadge, isValidSteamId64 } from "@/lib/profile";
import { BADGE_TYPES } from "@/types/profile";
import { findUserBySteamId } from "@/lib/auth/users";

const bodySchema = z.object({
  steamId: z.string().regex(/^\d{17}$/),
  badgeType: z.enum(BADGE_TYPES),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
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

  if (!isValidSteamId64(parsed.data.steamId)) {
    return jsonError("Invalid SteamID64.", 400);
  }

  const user = await findUserBySteamId(parsed.data.steamId);
  if (!user) {
    return jsonError("User not found.", 404);
  }

  const badge = await grantPlayerBadge({
    steamId: parsed.data.steamId,
    badgeType: parsed.data.badgeType,
    grantedBy: auth.user.id,
    metadata: parsed.data.metadata ?? null,
  });

  return jsonOk({
    type: badge.badgeType,
    grantedAt: badge.grantedAt.toISOString(),
    steamId: badge.steamId,
  });
}
