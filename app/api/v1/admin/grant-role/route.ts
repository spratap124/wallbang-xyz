import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { isRoleCode, isRoleSource } from "@/lib/permissions/constants";
import { grantRole } from "@/lib/permissions/service";
import { normalizeAdminEntitlementKeys } from "@/lib/payments/entitlements-logic";
import { validateManualPurchaseAmounts } from "@/lib/payments/manual-purchase";
import { isMongoConfigured } from "@/lib/mongo";
import { getGameServers } from "@/lib/servers/registry";
import { ROLE_CODES, ROLE_SOURCES } from "@/types/permissions";

const bodySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  targetSteamId: z.string().regex(/^\d{17}$/).optional(),
  roleCode: z.string(),
  source: z.string().default("MANUAL"),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
  entitlementKeys: z.array(z.string().min(1)).max(50).optional(),
  purchaseAmountPaise: z.number().int().positive().optional(),
  entitlementAmounts: z.array(z.object({ entitlementKey: z.string().min(1), amountPaise: z.number().int().positive() })).max(50).optional(),
  requestId: z.string().uuid().optional(),
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

  const {
    targetUserId,
    targetSteamId,
    roleCode,
    source,
    expiresAt,
    entitlementKeys,
    purchaseAmountPaise,
    entitlementAmounts,
    requestId,
  } = parsed.data;

  if (!targetUserId && !targetSteamId) {
    return jsonError("targetUserId or targetSteamId is required.", 400);
  }

  if (!isRoleCode(roleCode) || !(ROLE_CODES as readonly string[]).includes(roleCode)) {
    return jsonError("Invalid roleCode.", 400);
  }

  if (!isRoleSource(source) || !(ROLE_SOURCES as readonly string[]).includes(source)) {
    return jsonError("Invalid source.", 400);
  }
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return jsonError("Expiry must be in the future.", 400);
  }

  let vipEntitlementKeys: string[] | undefined;
  if (roleCode === "VIP") {
    if (!entitlementKeys || entitlementKeys.length === 0) {
      return jsonError(
        "Select at least one server, or All servers.",
        400,
      );
    }
    const [servers, bundles] = await Promise.all([
      getGameServers({ includeDisabled: true }),
      import("@/lib/payments/bundles").then(({ listVipBundleDocs }) => listVipBundleDocs()),
    ]);
    const normalized = normalizeAdminEntitlementKeys(
      entitlementKeys,
      [...servers.map((server) => server.id), ...bundles.filter((bundle) => bundle.enabled).map((bundle) => bundle.id)],
    );
    if (normalized.unknown.length > 0) {
      return jsonError(
        `Unknown server id(s): ${normalized.unknown.join(", ")}.`,
        400,
      );
    }
    vipEntitlementKeys = normalized.keys;
    if (source === "PURCHASE") {
      const bundleIds = new Set(bundles.filter((bundle) => bundle.enabled).map((bundle) => bundle.id));
      try {
        validateManualPurchaseAmounts({
          keys: vipEntitlementKeys,
          serverIds: servers.map((server) => server.id),
          bundleIds: [...bundleIds],
          amounts: entitlementAmounts,
          bundleAmountPaise: bundleIds.size && vipEntitlementKeys.some((key) => bundleIds.has(key)) ? purchaseAmountPaise : undefined,
          legacyAmountPaise: purchaseAmountPaise,
        });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Invalid purchase amounts.", 400);
      }
    }
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
      entitlementKeys: vipEntitlementKeys,
      purchaseAmountPaise,
      entitlementAmounts: entitlementAmounts?.map((entry) => ({ key: entry.entitlementKey, amountPaise: entry.amountPaise })),
      requestId,
    });
    return jsonOk(resolved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grant failed.";
    return jsonError(message, 400);
  }
}
