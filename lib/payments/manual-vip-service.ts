import "server-only";

import { auditLogsCollection, ensurePermissionIndexes } from "@/lib/permissions/collections";
import { seedPermissionsCatalog } from "@/lib/permissions/seed";
import { ensurePaymentIndexes, vipHistoryCollection } from "@/lib/payments/collections";
import { ensureComplimentaryVipEntitlement } from "@/lib/payments/entitlements";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { validateManualPurchaseAmounts } from "@/lib/payments/manual-purchase";
import { withVipEntitlementTransaction } from "@/lib/payments/entitlement-transaction";
import {
  LAUNCH_GIVEAWAY_ENTITLEMENT_KEY,
  normalizeAdminEntitlementKeys,
} from "@/lib/payments/entitlements-logic";
import { getGameServers } from "@/lib/servers/registry";
import { refreshVipRolePresentation, synchronizeVipRole } from "@/lib/permissions/vip-role-service";
import { getUserPermissions, resolveGrantTarget } from "@/lib/permissions/service";
import type { GrantRoleInput } from "@/lib/permissions/service";
import type { AuditLogDoc } from "@/types/permissions";

const MANUAL_VIP_SOURCES = new Set([
  "MANUAL",
  "PURCHASE",
  "GIVEAWAY",
  "PROMOTION",
  "TOURNAMENT",
  "FOUNDING",
  "SYSTEM",
]);

/** Admin-authorized VIP purchase, complimentary grant, or giveaway workflow. */
export async function grantManualVip(
  input: GrantRoleInput,
): Promise<NonNullable<Awaited<ReturnType<typeof getUserPermissions>>>> {
  if (input.roleCode !== "VIP") throw new Error("Manual VIP service only grants VIP.");
  if (!MANUAL_VIP_SOURCES.has(input.source)) throw new Error("Invalid manual VIP source.");
  if (!input.entitlementKeys?.length) {
    throw new Error("Select one or more explicit VIP servers or bundles.");
  }

  await Promise.all([ensurePaymentIndexes(), ensurePermissionIndexes(), seedPermissionsCatalog()]);
  const target = await resolveGrantTarget(input);
  if (!target) throw new Error("User not found.");

  const [servers, allBundles] = await Promise.all([
    getGameServers({ includeDisabled: true }),
    listVipBundleDocs(),
  ]);
  const enabledBundles = allBundles.filter((bundle) => bundle.enabled);
  const normalized = normalizeAdminEntitlementKeys(
    input.entitlementKeys,
    [
      ...servers.map((server) => server.id),
      ...enabledBundles.map((bundle) => bundle.id),
    ],
  );
  if (normalized.unknown.length) {
    throw new Error(`Unknown VIP entitlement key(s): ${normalized.unknown.join(", ")}.`);
  }
  if (
    normalized.keys.includes(LAUNCH_GIVEAWAY_ENTITLEMENT_KEY) &&
    !enabledBundles.some((bundle) => bundle.id === LAUNCH_GIVEAWAY_ENTITLEMENT_KEY && bundle.serverIds.length > 0)
  ) {
    throw new Error("The launch giveaway bundle is not configured with valid servers.");
  }
  if (!normalized.keys.length) throw new Error("Select at least one VIP entitlement.");

  const amountByKey = input.source === "PURCHASE"
    ? validateManualPurchaseAmounts({
        keys: normalized.keys,
        serverIds: servers.map((server) => server.id),
        bundleIds: enabledBundles.map((bundle) => bundle.id),
        amounts: input.entitlementAmounts?.map(({ key, amountPaise }) => ({
          entitlementKey: key,
          amountPaise,
        })),
        bundleAmountPaise: enabledBundles.some((bundle) => normalized.keys.includes(bundle.id))
          ? input.purchaseAmountPaise
          : undefined,
        legacyAmountPaise: input.purchaseAmountPaise,
      })
    : new Map<string, number>();

  const grantId = input.requestId ?? crypto.randomUUID();
  const now = new Date();
  const roleExpiry = input.expiresAt ?? null;
  const history = await vipHistoryCollection();

  await withVipEntitlementTransaction({
    userId: target._id,
    run: async ({ session }) => {
      const audit = await auditLogsCollection();
      const auditId = `manual-vip:${target._id}:${grantId}`;
      const priorRequest = await audit.findOne({ _id: auditId }, { session });
      if (priorRequest) {
        const previous = priorRequest.newValue as Record<string, unknown> | null;
        const sameKeys = JSON.stringify(previous?.entitlementKeys ?? []) === JSON.stringify(normalized.keys);
        const sameAmounts = JSON.stringify(previous?.purchaseAmounts ?? []) === JSON.stringify(
          [...amountByKey.entries()].map(([key, amountPaise]) => ({ key, amountPaise })),
        );
        const previousExpiry = previous?.requestedExpiresAt instanceof Date
          ? previous.requestedExpiresAt.getTime()
          : previous?.requestedExpiresAt === null
            ? null
            : undefined;
        const sameExpiry = previousExpiry === roleExpiry?.getTime() || (previousExpiry === null && roleExpiry === null);
        if (
          previous?.source !== input.source ||
          priorRequest.adminId !== (input.grantedBy?.id ?? null) ||
          !sameKeys ||
          !sameAmounts ||
          !sameExpiry
        ) {
          throw new Error("Manual grant request ID was already used with different grant details.");
        }
        return;
      }

      let createdEntitlement = false;
      for (const key of normalized.keys) {
        const bundle = enabledBundles.find((item) => item.id === key);
        const paymentPrefix = input.source === "PURCHASE" ? "offline-purchase" : "complimentary";
        const paymentId = `${paymentPrefix}:${target._id}:${grantId}:${key}`;
        const result = await ensureComplimentaryVipEntitlement({
          userId: target._id,
          steamId: target.steamId,
          expiresAt: roleExpiry,
          paymentId,
          grantId,
          entitlementKey: key,
          serverIds: bundle?.serverIds,
          bundleName: bundle?.name,
          source: input.source,
          amountPaise: amountByKey.get(key),
          dedupeGiveaway: input.source === "GIVEAWAY",
          now,
          session,
        });
        if (result === "inserted") createdEntitlement = true;
        if (result === "skipped") {
          const existing = await history.findOne({ paymentId }, { session });
          if (existing && existing.userId !== target._id) {
            throw new Error("Manual grant request ID is already assigned to another player.");
          }
          if (!existing && input.source !== "GIVEAWAY") {
            throw new Error("This selection adds no VIP entitlement coverage; choose a later expiry.");
          }
        }
      }

      const role = await synchronizeVipRole({
        userId: target._id,
        steamId: target.steamId,
        personaName: target.personaName,
        source: input.source,
        grantedBy: input.grantedBy,
        mode: "extend",
        grantLifetime: roleExpiry === null,
        session,
      });

      // A previously covered giveaway is a no-op, not a new grant without a
      // corresponding entitlement record.
      if (!createdEntitlement) return;

      const auditLog: AuditLogDoc = {
        _id: auditId,
        adminId: input.grantedBy?.id ?? null,
        adminSteamId: input.grantedBy?.steamId ?? null,
        action: "GRANT_ROLE",
        targetUserId: target._id,
        targetSteamId: target.steamId,
        targetPersonaName: target.personaName,
        oldValue: null,
        newValue: {
          roleCode: "VIP",
          source: input.source,
          grantId,
          entitlementKeys: normalized.keys,
          requestedExpiresAt: roleExpiry,
          ...(input.source === "PURCHASE"
            ? { purchaseAmounts: [...amountByKey.entries()].map(([key, amountPaise]) => ({ key, amountPaise })) }
            : {}),
          expiresAt: role.expiresAt,
          lifetime: role.lifetime,
        },
        timestamp: now,
      };
      await audit.insertOne(auditLog, { session });
    },
  });

  await refreshVipRolePresentation({
    userId: target._id,
    steamId: target.steamId,
    source: input.source,
  });
  const resolved = await getUserPermissions({ userId: target._id });
  if (!resolved) throw new Error("VIP grant was saved, but permissions could not be refreshed.");
  return resolved;
}
