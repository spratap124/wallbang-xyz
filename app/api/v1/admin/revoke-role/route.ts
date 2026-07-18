import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { isRoleCode } from "@/lib/permissions/constants";
import { revokeRole } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

const bodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetSteamId: z.string().regex(/^\d{17}$/).optional(),
  roleCode: z.string().optional(),
  userRoleId: z.string().min(1).optional(),
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

  const { targetUserId, targetSteamId, roleCode, userRoleId } = parsed.data;

  if (!targetUserId && !targetSteamId) {
    return jsonError("targetUserId or targetSteamId is required.", 400);
  }

  if (!userRoleId && !roleCode) {
    return jsonError("roleCode or userRoleId is required.", 400);
  }

  if (roleCode && !isRoleCode(roleCode)) {
    return jsonError("Invalid roleCode.", 400);
  }

  try {
    const resolved = await revokeRole({
      targetUserId,
      targetSteamId,
      roleCode: roleCode && isRoleCode(roleCode) ? roleCode : undefined,
      userRoleId,
      revokedBy: { id: auth.user.id, steamId: auth.user.steamId },
    });
    return jsonOk(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revoke failed.";
    return jsonError(message, 400);
  }
}
