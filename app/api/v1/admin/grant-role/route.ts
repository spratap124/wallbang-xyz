import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { isRoleCode, isRoleSource } from "@/lib/permissions/constants";
import { grantRole } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { ROLE_CODES, ROLE_SOURCES } from "@/types/permissions";

const bodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetSteamId: z.string().regex(/^\d{17}$/).optional(),
  roleCode: z.string(),
  source: z.string().default("MANUAL"),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
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
    return jsonError("Invalid request body.", 400, parsed.error.flatten()
      .fieldErrors as Record<string, string[]>);
  }

  const { targetUserId, targetSteamId, roleCode, source, expiresAt } =
    parsed.data;

  if (!targetUserId && !targetSteamId) {
    return jsonError("targetUserId or targetSteamId is required.", 400);
  }

  if (!isRoleCode(roleCode) || !(ROLE_CODES as readonly string[]).includes(roleCode)) {
    return jsonError("Invalid roleCode.", 400);
  }

  if (!isRoleSource(source) || !(ROLE_SOURCES as readonly string[]).includes(source)) {
    return jsonError("Invalid source.", 400);
  }

  try {
    const resolved = await grantRole({
      targetUserId,
      targetSteamId,
      roleCode,
      source,
      grantedBy: { id: auth.user.id, steamId: auth.user.steamId },
      expiresAt:
        expiresAt === undefined
          ? null
          : expiresAt === null
            ? null
            : new Date(expiresAt),
    });
    return jsonOk(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grant failed.";
    return jsonError(message, 400);
  }
}
