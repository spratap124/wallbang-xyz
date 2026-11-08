import "server-only";

import { getDb } from "@/lib/mongo";
import { overviewIstPeriod } from "@/lib/profile/overview-analytics";
import { ensurePaymentIndexes, paymentsCollection } from "@/lib/payments/collections";
import type { PaymentDoc } from "@/types/payments";
import type { AdminRevenueResponse } from "@/types/admin-revenue";
import type { FleetVipPurchase } from "@/types/profile";

const RECENT_PURCHASE_LIMIT = 50;

/** Load only the payment and purchaser data needed by the Revenue page. */
export async function getAdminRevenueAnalytics(
  now = new Date(),
): Promise<AdminRevenueResponse> {
  await ensurePaymentIndexes();

  const period = overviewIstPeriod("30d", undefined, undefined, now).current;
  const revenueEnd = now;
  const paymentsCollectionHandle = await paymentsCollection();
  const payments = await paymentsCollectionHandle
    .find(
      {
        $or: [
          { paidAt: { $gte: period.start, $lt: revenueEnd } },
          { refundedAt: { $gte: period.start, $lt: revenueEnd } },
          { createdAt: { $gte: period.start, $lt: revenueEnd } },
        ],
      },
      {
        projection: {
          userId: 1,
          steamId: 1,
          status: 1,
          amount: 1,
          durationDays: 1,
          plan: 1,
          bundleName: 1,
          accessType: 1,
          serverId: 1,
          paidAt: 1,
          refundedAt: 1,
          createdAt: 1,
        },
      },
    )
    .toArray();

  const captured = payments.filter(
    (payment) =>
      (payment.status === "captured" || payment.status === "refunded") &&
      payment.paidAt != null &&
      payment.paidAt >= period.start &&
      payment.paidAt < revenueEnd,
  );
  const refunds = payments.filter(
    (payment) =>
      payment.status === "refunded" &&
      payment.refundedAt != null &&
      payment.refundedAt >= period.start &&
      payment.refundedAt < revenueEnd,
  );

  const grossCapturedPaise = captured.reduce((sum, payment) => sum + payment.amount, 0);
  const refundsPaise = refunds.reduce((sum, payment) => sum + payment.amount, 0);
  const monthlyEquivalentPaise =
    captured.reduce(
      (sum, payment) => sum + (payment.amount * 30) / Math.max(1, payment.durationDays),
      0,
    ) -
    refunds.reduce(
      (sum, payment) => sum + (payment.amount * 30) / Math.max(1, payment.durationDays),
      0,
    );

  const payingCustomers = new Set(
    captured
      .filter((payment) => payment.status === "captured")
      .map((payment) => payment.userId),
  ).size;
  const checkoutPayments = payments.filter(
    (payment) => payment.createdAt >= period.start && payment.createdAt < revenueEnd,
  );
  const checkoutUsers = new Set(checkoutPayments.map((payment) => payment.userId)).size;
  const convertedUsers = new Set(
    checkoutPayments
      .filter((payment) => payment.status === "captured" && payment.paidAt != null)
      .map((payment) => payment.userId),
  ).size;
  const abandonedCheckouts = checkoutPayments.filter(
    (payment) =>
      payment.status === "created" &&
      now.getTime() - payment.createdAt.getTime() >= 30 * 60_000,
  ).length;

  const revenueByPlan = new Map<
    string,
    AdminRevenueResponse["revenueByPlan"][number]
  >();
  for (const payment of captured) {
    const accessType = payment.accessType ?? (payment.serverId ? "INDIVIDUAL_SERVER" : "ALL_RETAKES");
    const key = `${payment.plan}:${accessType}`;
    const row = revenueByPlan.get(key) ?? {
      plan: payment.plan,
      accessType,
      purchases: 0,
      grossPaise: 0,
      monthlyEquivalentPaise: 0,
    };
    row.purchases += 1;
    row.grossPaise += payment.amount;
    row.monthlyEquivalentPaise +=
      (payment.amount * 30) / Math.max(1, payment.durationDays);
    revenueByPlan.set(key, row);
  }
  for (const payment of refunds) {
    const accessType = payment.accessType ?? (payment.serverId ? "INDIVIDUAL_SERVER" : "ALL_RETAKES");
    const row = revenueByPlan.get(`${payment.plan}:${accessType}`);
    if (row) {
      row.monthlyEquivalentPaise -=
        (payment.amount * 30) / Math.max(1, payment.durationDays);
    }
  }

  const recent = captured
    .sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))
    .slice(0, RECENT_PURCHASE_LIMIT);
  const db = await getDb();
  const userIds = [...new Set(recent.map((payment) => payment.userId))];
  const users = userIds.length
    ? await db
        .collection<{ _id: string; personaName: string; avatarUrl: string }>("users")
        .find(
          { _id: { $in: userIds } },
          { projection: { _id: 1, personaName: 1, avatarUrl: 1 } },
        )
        .toArray()
    : [];
  const userById = new Map(users.map((user) => [user._id, user]));
  const recentPurchases: FleetVipPurchase[] = recent.map((payment: PaymentDoc) => {
    const user = userById.get(payment.userId);
    return {
      id: payment._id,
      playerName: user?.personaName ?? "Unknown player",
      avatarUrl: user?.avatarUrl ?? "",
      steamId: payment.steamId,
      plan: payment.plan,
      bundleName: payment.bundleName ?? null,
      accessType: payment.accessType ?? (payment.serverId ? "INDIVIDUAL_SERVER" : "ALL_RETAKES"),
      amountPaise: payment.amount,
      currency: "INR",
      status: payment.status === "refunded" ? "refunded" : "captured",
      paidAt: payment.paidAt!.toISOString(),
      durationDays: payment.durationDays,
    };
  });

  return {
    grossCapturedPaise,
    refundsPaise,
    netRevenuePaise: grossCapturedPaise - refundsPaise,
    monthlyEquivalentPaise,
    payingCustomers,
    successfulPurchases: captured.length,
    abandonedCheckouts,
    checkoutUsers,
    checkoutConversionPercent:
      checkoutUsers > 0 ? Math.round((convertedUsers / checkoutUsers) * 1000) / 10 : null,
    revenueByPlan: [...revenueByPlan.values()],
    recentPurchases,
  };
}
