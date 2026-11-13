import "server-only";

import { paymentsCollection, vipHistoryCollection } from "@/lib/payments/collections";
import type { PaymentDoc, VipHistoryDoc } from "@/types/payments";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOWS = [7, 14, 30] as const;

export type GiveawayConversionAnalytics = {
  generatedAt: string;
  expiring: { days: 7 | 30; recipients: number }[];
  conversions: {
    days: (typeof WINDOWS)[number];
    eligibleRecipients: number;
    convertedRecipients: number;
    conversionPercent: number | null;
    netRevenuePaise: number;
  }[];
};

type GiveawayGrant = Pick<VipHistoryDoc, "userId" | "endDate">;

/**
 * Measures conversion from a player's original complimentary giveaway expiry.
 * The VIP role row is mutable as purchases extend access, so the durable
 * complimentary vip_history row is the source of truth for the cohort.
 */
export async function getGiveawayConversionAnalytics(
  now = new Date(),
): Promise<GiveawayConversionAnalytics> {
  const history = await vipHistoryCollection();
  const giveawayGrants = await history
    .find(
      {
        source: "GIVEAWAY",
        paymentId: { $regex: "^complimentary:" },
        status: { $ne: "SUPERSEDED" },
        endDate: { $type: "date" },
      },
      { projection: { userId: 1, endDate: 1, createdAt: 1 } },
    )
    .sort({ createdAt: 1 })
    .toArray();

  // A recipient consumes at most one launch giveaway slot. Deduplicate legacy
  // duplicate history by keeping the first grant for each WallBang account.
  const grantsByUser = new Map<string, GiveawayGrant>();
  for (const grant of giveawayGrants) {
    if (!grantsByUser.has(grant.userId)) {
      grantsByUser.set(grant.userId, { userId: grant.userId, endDate: grant.endDate });
    }
  }
  const grants = [...grantsByUser.values()];
  const userIds = grants.map((grant) => grant.userId);

  const expiring = ([7, 30] as const).map((days) => ({
    days,
    recipients: grants.filter(
      (grant) =>
        grant.endDate.getTime() > now.getTime() &&
        grant.endDate.getTime() <= now.getTime() + days * DAY_MS,
    ).length,
  }));

  if (!userIds.length) {
    return {
      generatedAt: now.toISOString(),
      expiring,
      conversions: WINDOWS.map((days) => ({
        days,
        eligibleRecipients: 0,
        convertedRecipients: 0,
        conversionPercent: null,
        netRevenuePaise: 0,
      })),
    };
  }

  const firstExpiry = grants.reduce(
    (earliest, grant) => Math.min(earliest, grant.endDate.getTime()),
    Number.POSITIVE_INFINITY,
  );
  const [payments, offlinePurchases] = await Promise.all([
    (await paymentsCollection())
      .find(
        {
          userId: { $in: userIds },
          status: { $in: ["captured", "refunded"] },
          paidAt: { $gte: new Date(firstExpiry), $lte: now },
        },
        { projection: { userId: 1, amount: 1, status: 1, paidAt: 1 } },
      )
      .toArray(),
    history
      .find(
        {
          userId: { $in: userIds },
          source: "PURCHASE",
          paymentId: { $regex: "^offline-purchase:" },
          status: { $ne: "SUPERSEDED" },
          startDate: { $gte: new Date(firstExpiry), $lte: now },
        },
        { projection: { userId: 1, amount: 1, startDate: 1 } },
      )
      .toArray(),
  ]);

  const purchasesByUser = new Map<string, Array<{ at: Date; amount: number; refunded: boolean }>>();
  const addPurchase = (userId: string, purchase: { at: Date; amount: number; refunded: boolean }) => {
    const rows = purchasesByUser.get(userId) ?? [];
    rows.push(purchase);
    purchasesByUser.set(userId, rows);
  };
  for (const payment of payments as PaymentDoc[]) {
    if (payment.paidAt) {
      addPurchase(payment.userId, {
        at: payment.paidAt,
        amount: payment.amount,
        refunded: payment.status === "refunded",
      });
    }
  }
  for (const purchase of offlinePurchases) {
    addPurchase(purchase.userId, {
      at: purchase.startDate,
      amount: purchase.amount,
      refunded: false,
    });
  }

  const conversions = WINDOWS.map((days) => {
    const matured = grants.filter(
      (grant) => grant.endDate.getTime() + days * DAY_MS <= now.getTime(),
    );
    let convertedRecipients = 0;
    let netRevenuePaise = 0;
    for (const grant of matured) {
      const expiry = grant.endDate.getTime();
      const windowEnd = expiry + days * DAY_MS;
      const purchasesInWindow = (purchasesByUser.get(grant.userId) ?? []).filter(
        (purchase) => purchase.at.getTime() > expiry && purchase.at.getTime() <= windowEnd,
      );
      if (purchasesInWindow.length) convertedRecipients += 1;
      netRevenuePaise += purchasesInWindow.reduce(
        (sum, purchase) => sum + (purchase.refunded ? 0 : purchase.amount),
        0,
      );
    }
    return {
      days,
      eligibleRecipients: matured.length,
      convertedRecipients,
      conversionPercent:
        matured.length > 0 ? (convertedRecipients / matured.length) * 100 : null,
      netRevenuePaise,
    };
  });

  return { generatedAt: now.toISOString(), expiring, conversions };
}
