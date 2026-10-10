import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { revokeBan } from "@/lib/moderation/service";

const schema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("revoke_bans");
  if ("response" in auth) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  const { id } = await context.params;
  const ban = await revokeBan({
    banId: id,
    revokedBy: auth.user.id,
    reason: parsed.data.reason,
  });
  if (!ban) return jsonError("Active ban not found.", 404);
  await recordAuditLog({
    adminId: auth.user.id,
    adminSteamId: auth.user.steamId,
    action: "REVOKE_BAN",
    targetUserId: null,
    targetSteamId: ban.steamId,
    targetPersonaName: null,
    oldValue: { banId: ban._id },
    newValue: { status: ban.status, revokeReason: ban.revokeReason },
    timestamp: new Date(),
  });
  return jsonOk({
    ...ban,
    startsAt: ban.startsAt.toISOString(),
    expiresAt: ban.expiresAt?.toISOString() ?? null,
    revokedAt: ban.revokedAt?.toISOString() ?? null,
    createdAt: ban.createdAt.toISOString(),
    updatedAt: ban.updatedAt.toISOString(),
  });
}
