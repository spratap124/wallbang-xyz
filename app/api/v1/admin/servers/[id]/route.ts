import { z } from "zod";

import { serverAuditSnapshot } from "@/lib/admin/audit";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import {
  disableGameServer,
  getGameServerById,
  updateGameServer,
} from "@/lib/servers/registry";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  shortName: z.string().trim().min(1).max(64).optional(),
  mode: z.string().trim().min(1).max(64).optional(),
  map: z.string().trim().min(1).max(64).optional(),
  region: z.string().trim().min(1).max(128).optional(),
  city: z.string().trim().min(1).max(64).optional(),
  host: z.string().trim().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tickRate: z.number().int().min(64).max(128).optional(),
  maxPlayers: z.number().int().min(1).max(128).optional(),
  maxPlayersOverride: z.number().int().min(1).max(128).nullable().optional(),
  pingUrl: z.string().trim().max(512).nullable().optional(),
  status: z.enum(["live", "offline", "maintenance"]).optional(),
  featured: z.boolean().optional(),
  enabled: z.boolean().optional(),
  vipPricingByPlanInr: z
    .object({
      "1_month": z.number().positive().optional(),
      "3_months": z.number().positive().optional(),
      "6_months": z.number().positive().optional(),
      "1_year": z.number().positive().optional(),
    })
    .optional(),
});

function toPaiseMap(
  inr: {
    "1_month"?: number;
    "3_months"?: number;
    "6_months"?: number;
    "1_year"?: number;
  } | undefined,
): { "1_month"?: number; "3_months"?: number; "6_months"?: number; "1_year"?: number } {
  if (!inr) return {};
  return {
    "1_month":
      inr["1_month"] !== undefined ? Math.round(inr["1_month"] * 100) : undefined,
    "3_months":
      inr["3_months"] !== undefined ? Math.round(inr["3_months"] * 100) : undefined,
    "6_months":
      inr["6_months"] !== undefined ? Math.round(inr["6_months"] * 100) : undefined,
    "1_year":
      inr["1_year"] !== undefined ? Math.round(inr["1_year"] * 100) : undefined,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) return jsonError("Missing server id.", 400);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const before = await getGameServerById(id, { includeDisabled: true });
  if (!before) return jsonError("Server not found.", 404);

  const updated = await updateGameServer(id, {
    ...parsed.data,
    vipPricingByPlan: toPaiseMap(parsed.data.vipPricingByPlanInr),
  });
  if (!updated) return jsonError("Server not found.", 404);

  await recordAuditLog({
    adminId: auth.user.id,
    adminSteamId: auth.user.steamId,
    action: "UPDATE_SERVER",
    targetUserId: null,
    targetSteamId: null,
    targetPersonaName: null,
    targetServerId: updated.id,
    targetServerName: updated.name,
    oldValue: serverAuditSnapshot(before),
    newValue: serverAuditSnapshot(updated),
    timestamp: new Date(),
  });

  return jsonOk(updated);
}

/** Soft-disable (hide from public list). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) return jsonError("Missing server id.", 400);

  const before = await getGameServerById(id, { includeDisabled: true });
  if (!before) return jsonError("Server not found.", 404);

  const updated = await disableGameServer(id);
  if (!updated) return jsonError("Server not found.", 404);

  await recordAuditLog({
    adminId: auth.user.id,
    adminSteamId: auth.user.steamId,
    action: "DISABLE_SERVER",
    targetUserId: null,
    targetSteamId: null,
    targetPersonaName: null,
    targetServerId: updated.id,
    targetServerName: updated.name,
    oldValue: serverAuditSnapshot(before),
    newValue: serverAuditSnapshot(updated),
    timestamp: new Date(),
  });

  return jsonOk(updated);
}
