import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import {
  deleteVipBundle,
  getVipBundleDoc,
  updateVipBundle,
} from "@/lib/payments/bundles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const pricingSchema = z.object({
  "1_month": z.number().int().positive().max(10_000_000),
  "3_months": z.number().int().positive().max(10_000_000),
  "6_months": z.number().int().positive().max(10_000_000),
  "1_year": z.number().int().positive().max(10_000_000),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  serverIds: z.array(z.string().trim().min(1)).min(1).max(50).optional(),
  pricingByPlan: pricingSchema.optional(),
  enabled: z.boolean().optional(),
  featured: z.boolean().optional(),
});

/** Update a VIP bundle. */
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
  const before = await getVipBundleDoc(id);
  if (!before) return jsonError("Bundle not found.", 404);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const bundle = await updateVipBundle(id, parsed.data);
    if (!bundle) return jsonError("Bundle not found.", 404);

    await recordAuditLog({
      adminId: auth.user.id,
      adminSteamId: auth.user.steamId,
      action: "UPDATE_BUNDLE",
      targetUserId: null,
      targetSteamId: null,
      targetPersonaName: null,
      oldValue: {
        name: before.name,
        serverIds: before.serverIds,
        pricingByPlan: before.pricingByPlan,
        enabled: before.enabled,
        featured: before.featured,
      },
      newValue: {
        name: bundle.name,
        serverIds: bundle.serverIds,
        pricingByPlan: bundle.pricingByPlan,
        enabled: bundle.enabled,
        featured: bundle.featured,
      },
      timestamp: new Date(),
    });
    return jsonOk(bundle);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to update bundle.",
      400,
    );
  }
}

/**
 * Delete a VIP bundle. Existing entitlements are unaffected: purchases snapshot
 * their servers on the payment/history documents.
 */
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
  const before = await getVipBundleDoc(id);
  if (!before) return jsonError("Bundle not found.", 404);

  const deleted = await deleteVipBundle(id);
  if (!deleted) return jsonError("Bundle not found.", 404);

  await recordAuditLog({
    adminId: auth.user.id,
    adminSteamId: auth.user.steamId,
    action: "DELETE_BUNDLE",
    targetUserId: null,
    targetSteamId: null,
    targetPersonaName: null,
    oldValue: {
      bundleId: before.id,
      name: before.name,
      serverIds: before.serverIds,
      pricingByPlan: before.pricingByPlan,
    },
    newValue: null,
    timestamp: new Date(),
  });

  return jsonOk({ deleted: true, id });
}
