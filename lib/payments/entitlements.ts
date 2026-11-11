import "server-only";

import type { ClientSession } from "mongodb";

import {
  buildMembershipFromHistory,
  buildGrantedEntitlementRecord,
  buildSummary,
  COMPLIMENTARY_LIFETIME_DURATION_DAYS,
  ALL_RETAKES_ENTITLEMENT_KEY,
  LAUNCH_GIVEAWAY_ENTITLEMENT_KEY,
  computeEntitlementExpiry,
  buildServerAccess,
  durationDaysToCoverUntil,
  entitlementKeyFromRecord,
  isAllRetakesRecord,
  serverIdsFromRecord,
  type VipMembershipServer,
} from "@/lib/payments/entitlements-logic";
import {
  ensurePaymentIndexes,
  vipHistoryCollection,
} from "@/lib/payments/collections";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { durationDaysToMs } from "@/lib/payments/expiry";
import { getVipAccessStatus } from "@/lib/payments/service";
import { loadEffectiveVipHistory } from "@/lib/payments/effective-vip-history";
import type { VipMembershipView } from "@/types/vip";

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === 11000,
  );
}

/**
 * Persist one explicit manual/giveaway entitlement. This helper has no server
 * default and must only be called by the manual grant workflow. The online
 * purchase service writes payment-linked history through its own path.
 */
export async function ensureComplimentaryVipEntitlement(input: {
  userId: string;
  steamId: string;
  expiresAt: Date | null;
  paymentId: string;
  /** Original role assignment id; used to make giveaway sync idempotent. */
  grantId?: string;
  /** Giveaway records are one grant, even when legacy keys differ. */
  dedupeGiveaway?: boolean;
  /** Individual server id. Prefer `entitlementKey` when granting All Retakes. */
  serverId?: string;
  /** Server id or `all_retakes`. Defaults to the complimentary Mumbai server. */
  entitlementKey?: string;
  /** Snapshot of servers covered when the entitlement is a named bundle. */
  serverIds?: string[];
  bundleName?: string;
  /** Origin of an admin-created record, including offline purchases. */
  source?: string;
  amountPaise?: number;
  now?: Date;
  session?: ClientSession;
}): Promise<"inserted" | "skipped"> {
  await ensurePaymentIndexes();

  const now = input.now ?? new Date();
  const key = (input.entitlementKey ?? input.serverId ?? "").trim();
  if (!key) throw new Error("An explicit VIP entitlement key is required.");
  if (!input.paymentId.trim()) return "skipped";
  if (
    input.dedupeGiveaway &&
    key === ALL_RETAKES_ENTITLEMENT_KEY
  ) {
    throw new Error(
      `New giveaway entitlements must use ${LAUNCH_GIVEAWAY_ENTITLEMENT_KEY}.`,
    );
  }

  let coversUntil: Date;
  if (!input.expiresAt) {
    coversUntil = new Date(
      now.getTime() + durationDaysToMs(COMPLIMENTARY_LIFETIME_DURATION_DAYS),
    );
  } else if (input.expiresAt.getTime() <= now.getTime()) {
    return "skipped";
  } else {
    coversUntil = input.expiresAt;
  }

  const col = await vipHistoryCollection();
  const existingPayment = await col.findOne(
    { paymentId: input.paymentId },
    { session: input.session },
  );
  if (existingPayment) {
    if (existingPayment.userId !== input.userId) {
      throw new Error("Manual grant request ID is already assigned to another player.");
    }
    return "skipped";
  }
  if (input.dedupeGiveaway && input.grantId) {
    const escaped = input.grantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await col.findOne({
      userId: input.userId,
      paymentId: { $regex: `^complimentary:${escaped}(?::|$)` },
      status: { $ne: "SUPERSEDED" },
    }, { session: input.session });
    if (existing) return "skipped";
  }
  const history = await loadEffectiveVipHistory(input.userId, input.session);
  // Named bundles are keyed by their server snapshot, just like online
  // purchases; comparing a bundle ID directly would miss existing coverage.
  const coverageKey = entitlementKeyFromRecord(buildGrantedEntitlementRecord({
    id: "probe", userId: input.userId, steamId: input.steamId,
    entitlementKey: key, durationDays: 1, paymentId: "probe",
    currentExpiry: null, now, serverIds: input.serverIds,
  }));
  const currentExpiry = computeEntitlementExpiry(
    history.filter((record) => entitlementKeyFromRecord(record) === coverageKey),
  );
  const durationDays = durationDaysToCoverUntil({
    currentExpiry,
    coversUntil,
    now,
  });
  if (!durationDays) return "skipped";

  const doc = buildGrantedEntitlementRecord({
    id: crypto.randomUUID(),
    userId: input.userId,
    steamId: input.steamId,
    entitlementKey: key,
    durationDays,
    paymentId: input.paymentId,
    currentExpiry,
    now,
    serverIds: input.serverIds,
  });
  doc.source = input.source ?? (input.dedupeGiveaway ? "GIVEAWAY" : "ADMIN");
  if (input.bundleName) doc.bundleName = input.bundleName;
  if (input.amountPaise != null) doc.amount = input.amountPaise;
  doc.grantId = input.grantId ?? null;
  doc.calculationVersion = 2;
  doc.lifetimeGrant = input.expiresAt === null;
  doc.status = "ACTIVE";

  try {
    await col.insertOne(doc, { session: input.session });
    return "inserted";
  } catch (err) {
    if (isDuplicateKeyError(err)) return "skipped";
    throw err;
  }
}

export type { VipMembershipServer };
export {
  ALL_RETAKES_ENTITLEMENT_KEY,
  buildEntitlementsFromHistory,
  buildMembershipFromHistory,
  bundleLabelFromRecord,
  isCustomBundleRecord,
  normalizeAdminEntitlementKeys,
  computeEntitlementExpiry,
  persistedEntitlementExpiry,
  entitlementKeyFromPurchase,
  entitlementKeyFromRecord,
  furthestEntitlementExpiry,
  furthestPersistedEntitlementExpiry,
  hasActiveVipEntitlementForServer,
  isAllRetakesRecord,
  serverIdsFromRecord,
} from "@/lib/payments/entitlements-logic";

export async function getUserVipMembership(input: {
  userId: string;
  eligibleServers: VipMembershipServer[];
}): Promise<VipMembershipView> {
  const [status, history, bundleDocs] = await Promise.all([
    getVipAccessStatus(input.userId),
    loadEffectiveVipHistory(input.userId),
    listVipBundleDocs().catch(() => []),
  ]);

  const bundleLabels: Record<string, string> = {};
  for (const bundle of bundleDocs) {
    bundleLabels[bundle.id] = bundle.name;
  }

  const now = new Date();
  const { entitlements, purchaseHistory } = buildMembershipFromHistory({
    history,
    lifetime: status.lifetime,
    overallExpiresAt: status.expiresAt,
    eligibleServers: input.eligibleServers,
    bundleLabels,
    now,
  });
  const serverAccess = buildServerAccess({
    history,
    eligibleServers: input.eligibleServers,
    now,
  });

  const hasActiveVip =
    status.lifetime || entitlements.some((item) => item.status === "active");

  const perEntitlementExpiries = entitlements
    .map((item) => (item.expiresAt ? new Date(item.expiresAt) : null))
    .filter((date): date is Date => Boolean(date));

  const latestEntitlementExpiry =
    perEntitlementExpiries.length > 0
      ? perEntitlementExpiries.sort((a, b) => b.getTime() - a.getTime())[0]!
      : null;

  const lastExpiredAt = !hasActiveVip
    ? (() => {
        const expiries: Date[] = [];
        const bundleExpiry = computeEntitlementExpiry(
          history.filter(isAllRetakesRecord),
        );
        if (bundleExpiry) expiries.push(bundleExpiry);

        const serverIds = new Set(
          history.flatMap((record) => serverIdsFromRecord(record)),
        );
        for (const serverId of serverIds) {
          const expiry = computeEntitlementExpiry(
            history.filter((item) =>
              serverIdsFromRecord(item).includes(serverId),
            ),
          );
          if (expiry) expiries.push(expiry);
        }

        const past = expiries.filter((date) => date.getTime() <= now.getTime());
        if (past.length > 0) {
          return past.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
        }
        return status.expiresAt && status.expiresAt <= now
          ? status.expiresAt
          : null;
      })()
    : null;

  const summary = hasActiveVip
    ? buildSummary(entitlements, status.lifetime)
    : null;

  return {
    hasActiveVip,
    lifetime: status.lifetime,
    overallExpiresAt:
      (latestEntitlementExpiry ?? status.expiresAt)?.toISOString() ?? null,
    lastExpiredAt: lastExpiredAt?.toISOString() ?? null,
    entitlements,
    serverAccess,
    purchaseHistory,
    summary,
  };
}
