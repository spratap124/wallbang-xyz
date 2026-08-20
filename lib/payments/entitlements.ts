import "server-only";

import {
  buildEntitlementsFromHistory,
  buildSummary,
  computeEntitlementExpiry,
  isAllRetakesRecord,
  serverIdsFromRecord,
  type VipMembershipServer,
} from "@/lib/payments/entitlements-logic";
import { vipHistoryCollection } from "@/lib/payments/collections";
import { getVipAccessStatus } from "@/lib/payments/service";
import type { VipMembershipView } from "@/types/vip";

export type { VipMembershipServer };
export {
  buildEntitlementsFromHistory,
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
