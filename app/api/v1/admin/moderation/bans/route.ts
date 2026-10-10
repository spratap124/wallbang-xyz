import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { createBan, isValidSteamId64, listBans } from "@/lib/moderation/service";
import { BAN_STATUSES } from "@/types/moderation";

const createSchema = z.object({
  steamId: z.string(),
  reason: z.string().trim().min(3).max(500),
  permanent: z.boolean().default(false),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .optional(),
  originServerId: z.string().trim().min(1).max(64).nullable().optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("moderation_access");
  if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const steamId = params.get("steamId")?.trim();
  const status = params.get("status");
  if (steamId && !isValidSteamId64(steamId)) return jsonError("Invalid SteamID64.", 400);
  if (status && !(BAN_STATUSES as readonly string[]).includes(status))
    return jsonError("Invalid ban status.", 400);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
  return jsonOk(
    await listBans({
      steamId,
      status: status as "active" | "revoked" | undefined,
      limit,
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success)
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  if (!isValidSteamId64(parsed.data.steamId)) return jsonError("Invalid SteamID64.", 400);
  const permission = parsed.data.permanent ? "issue_permanent_bans" : "issue_timed_bans";
  const auth = await requirePermission(permission);
  if ("response" in auth) return auth.response;
  try {
    const ban = await createBan({
      ...parsed.data,
      createdBy: auth.user.id,
      createdBySteamId: auth.user.steamId,
    });
    await recordAuditLog({
      adminId: auth.user.id,
      adminSteamId: auth.user.steamId,
      action: "CREATE_BAN",
      targetUserId: null,
      targetSteamId: ban.steamId,
      targetPersonaName: null,
      oldValue: null,
      newValue: { banId: ban._id, permanent: ban.permanent, expiresAt: ban.expiresAt },
      timestamp: new Date(),
    });
    return jsonOk(ban, 201);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to create ban.",
      400,
    );
  }
}
