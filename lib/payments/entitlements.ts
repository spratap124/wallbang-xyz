import "server-only";

import {
  buildEntitlementsFromHistory,
  buildSummary,
  COMPLIMENTARY_LIFETIME_DURATION_DAYS,
  COMPLIMENTARY_VIP_SERVER_ID,
  computeEntitlementExpiry,
  durationDaysToCoverUntil,
  isAllRetakesRecord,
  pickComplimentaryVipPlan,
  serverIdsFromRecord,
  type VipMembershipServer,
} from "@/lib/payments/entitlements-logic";
import {
  ensurePaymentIndexes,
  vipHistoryCollection,
} from "@/lib/payments/collections";
import { durationDaysToMs } from "@/lib/payments/expiry";
import { getVipAccessStatus } from "@/lib/payments/service";
import type { VipHistoryDoc } from "@/types/payments";
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
 * Ensure giveaway / admin VIP has a `vip_history` row for the complimentary
 * server (default `retake-1-mumbai`). Game-server `?serverId=` scoping reads
 * this collection — the global VIP role alone is not enough.
 *
 * Does not stack on top of an already-covering individual entitlement.
 * Purchases write their own history and should not call this.
 */
export async function ensureComplimentaryVipEntitlement(input: {
  userId: string;
  steamId: string;
  expiresAt: Date | null;
  paymentId: string;
  serverId?: string;
  now?: Date;
}): Promise<"inserted" | "skipped"> {
  await ensurePaymentIndexes();

  const now = input.now ?? new Date();
  const serverId = (input.serverId ?? COMPLIMENTARY_VIP_SERVER_ID).trim();
  if (!serverId || !input.paymentId.trim()) return "skipped";

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
  const history = await col.find({ userId: input.userId }).toArray();
  const currentExpiry = computeEntitlementExpiry(
    history.filter((record) => serverIdsFromRecord(record).includes(serverId)),
  );
  const durationDays = durationDaysToCoverUntil({
    currentExpiry,
    coversUntil,
    now,
  });
  if (!durationDays) return "skipped";

  const doc: VipHistoryDoc = {
    _id: crypto.randomUUID(),
    userId: input.userId,
    steamId: input.steamId,
    bundleId: serverId,
    bundleKind: "server",
    accessType: "INDIVIDUAL_SERVER",
    serverId,
    serverIds: [serverId],
    plan: pickComplimentaryVipPlan(durationDays),
    amount: 0,
    durationDays,
    startDate: now,
    endDate: coversUntil,
    paymentId: input.paymentId,
    createdAt: now,
  };

  try {
    await col.insertOne(doc);
    return "inserted";
  } catch (err) {
    if (isDuplicateKeyError(err)) return "skipped";
    throw err;
  }
}

export type { VipMembershipServer };
export {
  buildEntitlementsFromHistory,
  COMPLIMENTARY_VIP_SERVER_ID,
  computeEntitlementExpiry,
  entitlementKeyFromPurchase,
  entitlementKeyFromRecord,
  furthestEntitlementExpiry,
  hasActiveVipEntitlementForServer,
  isAllRetakesRecord,
  serverIdsFromRecord,
} from "@/lib/payments/entitlements-logic";

export async function getUserVipMembership(input: {
  userId: string;
  eligibleServers: VipMembershipServer[];
}): Promise<VipMembershipView> {
  const [status, historyCol] = await Promise.all([
    getVipAccessStatus(input.userId),
    vipHistoryCollection(),
  ]);

  const history = await historyCol
    .find({ userId: input.userId })
    .sort({ createdAt: 1 })
    .toArray();

  const now = new Date();
  const entitlements = buildEntitlementsFromHistory({
    history,
    lifetime: status.lifetime,
    overallExpiresAt: status.expiresAt,
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
    summary,
  };
}
