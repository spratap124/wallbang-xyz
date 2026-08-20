import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  revokeAllVipAccess,
  revokeVipEntitlement,
} from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

const bodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetSteamId: z.string().regex(/^\d{17}$/).optional(),
  /** Omit to revoke all VIP. Pass a server id or `all_retakes` for one entitlement. */
  entitlementKey: z.string().min(1).optional(),
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
    return jsonError("Invalid request body.", 400);
  }

  const { targetUserId, targetSteamId, entitlementKey } = parsed.data;
  if (!targetUserId && !targetSteamId) {
    return jsonError("targetUserId or targetSteamId is required.", 400);
  }

  const revokedBy = { id: auth.user.id, steamId: auth.user.steamId };

  try {
    if (entitlementKey) {
      const result = await revokeVipEntitlement({
        targetUserId,
        targetSteamId,
        entitlementKey,
        revokedBy,
      });
      return jsonOk({ scope: "entitlement" as const, ...result });
    }

    const result = await revokeAllVipAccess({
      targetUserId,
      targetSteamId,
      revokedBy,
    });
    return jsonOk({ scope: "all" as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revoke VIP failed.";
    return jsonError(message, 400);
  }
}
