import "server-only";

import { quoteVipOrder } from "@/config/vip-plans";
import type { VipAccessType, VipPlanId } from "@/types/vip";
import { findUserById } from "@/lib/auth/users";
import {
  ensurePaymentIndexes,
  payuWebhookEventsCollection,
  paymentsCollection,
  razorpayWebhookEventsCollection,
  vipHistoryCollection,
} from "@/lib/payments/collections";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import {
  entitlementKeyFromPurchase,
  entitlementKeyFromRecord,
  computeEntitlementExpiry,
} from "@/lib/payments/entitlements-logic";
import { loadEffectiveVipHistory } from "@/lib/payments/effective-vip-history";
import { withVipEntitlementTransaction } from "@/lib/payments/entitlement-transaction";
import { computeVipExtension } from "@/lib/payments/expiry";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { resolveVipPrice } from "@/lib/payments/promotions";
import {
  trackPurchaseForPayment,
  trackRefundForPayment,
} from "@/lib/payments/analytics";
import {
  getUserPermissions,
} from "@/lib/permissions/service";
import {
  ensureVipRoleServiceReady,
  refreshVipRolePresentation,
  synchronizeVipRole,
} from "@/lib/permissions/vip-role-service";
import { rateLimit } from "@/lib/rate-limit";
import { getGameServers } from "@/lib/servers/registry";
import { checkoutProductDescription } from "@/content/business";
import type {
  PaymentDoc,
  PaymentStatus,
  VipAccessStatus,
  VipHistoryDoc,
} from "@/types/payments";

const REUSE_ORDER_MS = 30 * 60 * 1000;

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === 11000,
  );
}

async function ready(): Promise<void> {
  await ensurePaymentIndexes();
}

export async function getVipAccessStatus(
  userId: string,
): Promise<VipAccessStatus> {
  const resolved = await getUserPermissions({ userId });
  if (!resolved) {
    return { isVip: false, lifetime: false, expiresAt: null, source: null };
  }

  const founding = resolved.activeAssignments.find(
    (a) => a.roleCode === "FOUNDING_MEMBER",
  );
  const vip = resolved.activeAssignments.find((a) => a.roleCode === "VIP");
  const assignment = founding ?? vip;

  if (!assignment) {
    return { isVip: false, lifetime: false, expiresAt: null, source: null };
  }

  const lifetime = assignment.expiresAt === null;
  return {
    isVip: true,
    lifetime,
    expiresAt: assignment.expiresAt,
    source: assignment.source,
  };
}

export type CreateVipOrderResult = {
  orderId: string;
  amount: number;
  currency: "INR";
  plan: VipPlanId;
  accessType: VipAccessType;
  bundleId: string;
  serverId: string | null;
  keyId: string;
  description: string;
  reused: boolean;
  originalAmount: number;
  discountAmount: number;
  promotionId: string | null;
  promotionName: string | null;
  promotionEndsAt: string | null;
};

export async function createVipOrder(input: {
  userId: string;
  steamId: string;
  personaName: string;
  accessType: VipAccessType;
  planId: string;
  serverId: string | null;
  /** Required when accessType is BUNDLE. */
  bundleId?: string | null;
  email: string;
  phone: string;
  /** Attribution context from the checkout page (GA4 client id). */
  gaClientId?: string | null;
  /** GA4 session id at checkout, so the server purchase joins that session. */
  gaSessionId?: string | null;
}): Promise<CreateVipOrderResult> {
  await ready();

  if (!isRazorpayConfigured()) {
    throw new Error("VIP purchases are not configured yet.");
  }

  const servers = await getGameServers();
  const shopServers = servers.map((server) => ({
    id: server.id,
    name: server.name,
    shortName: server.shortName || server.name,
    mode: server.mode,
    city: server.city,
    region: server.region,
    map: server.map,
    maxPlayers: server.maxPlayersOverride ?? server.maxPlayers,
    pingMs: server.pingMs,
    status: server.status,
    vipPricingByPlan: server.vipPricingByPlan ?? undefined,
  }));

  const bundles = (await listVipBundleDocs()).map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    serverIds: bundle.serverIds,
    pricingByPlan: bundle.pricingByPlan,
    enabled: bundle.enabled,
  }));

  const quote = quoteVipOrder({
    accessType: input.accessType,
    serverId: input.serverId,
    bundleId: input.bundleId ?? null,
    planId: input.planId,
    servers: shopServers,
    bundles,
  });

  const promotionTargetType = quote.accessType === "BUNDLE" ? "bundle" : "server";
  const promotionTargetId = quote.accessType === "BUNDLE" ? quote.bundleId : quote.serverId!;
  const price = await resolveVipPrice({
    targetType: promotionTargetType,
    targetId: promotionTargetId,
    plan: quote.durationId,
    basePrice: quote.amountPaise,
  });
  const originalAmount = price.basePrice;
  const chargedAmount = price.finalPrice;
  const discountAmount = originalAmount - chargedAmount;

  const limited = rateLimit(`vip-order:${input.userId}`, 8, 60_000);
  if (!limited.ok) {
    throw new Error("Too many payment attempts. Try again shortly.");
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  if (!keyId) {
    throw new Error("VIP purchases are not configured yet.");
  }

  const bundleId = quote.bundleId;
  const bundleKind = quote.bundleKind;
  const bundleName = bundleId
    ? (bundles.find((bundle) => bundle.id === bundleId)?.name ?? null)
    : null;
  const serverId = quote.serverId;
  const serverIds = quote.serverIds;
  const checkoutDescription = checkoutProductDescription({
    durationDays: quote.durationDays,
    accessType: quote.accessType,
  });

  const payments = await paymentsCollection();
  const reuseAfter = new Date(Date.now() - REUSE_ORDER_MS);
  const existing = await payments.findOne({
    userId: input.userId,
    provider: "razorpay",
    plan: quote.durationId,
    accessType: quote.accessType,
    bundleId,
    serverId,
    serverIds,
    status: "created",
    razorpayPaymentId: null,
    createdAt: { $gt: reuseAfter },
  });

  if (existing) {
    await payments.updateOne(
      { _id: existing._id },
      {
        $set: {
          email: input.email,
          phone: input.phone,
          gaClientId: input.gaClientId ?? null,
          gaSessionId: input.gaSessionId ?? null,
          updatedAt: new Date(),
        },
      },
    );
    return {
      orderId: existing.razorpayOrderId,
      amount: existing.amount,
      currency: "INR",
      plan: quote.durationId,
      accessType: quote.accessType,
      bundleId,
      serverId: existing.serverId,
      keyId,
      description: checkoutDescription,
      reused: true,
      originalAmount: existing.originalAmount ?? existing.amount,
      discountAmount: existing.discountAmount ?? 0,
      promotionId: existing.promotionId ?? null,
      promotionName: existing.promotionName ?? null,
      promotionEndsAt: existing.promotionEndsAt?.toISOString() ?? null,
    };
  }

  const receipt = `wb_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const order = await createRazorpayOrder({
    amountPaise: chargedAmount,
    receipt,
    notes: {
      user_id: input.userId,
      steam_id: input.steamId,
      plan: quote.durationId,
      bundle: bundleId,
      access_type: quote.accessType,
      ...(serverId ? { server_id: serverId } : {}),
    },
    idempotencyKey: `${input.userId}:${bundleId}:${quote.durationId}:${receipt}`,
  });

  const now = new Date();
  const doc: PaymentDoc = {
    _id: crypto.randomUUID(),
    userId: input.userId,
    steamId: input.steamId,
    provider: "razorpay",
    razorpayOrderId: order.id,
    razorpayPaymentId: null,
    email: input.email,
    phone: input.phone,
    gaClientId: input.gaClientId ?? null,
    gaSessionId: input.gaSessionId ?? null,
    bundleId,
    bundleKind,
    bundleName,
    accessType: quote.accessType,
    serverId,
    serverIds,
    plan: quote.durationId,
    durationDays: quote.durationDays,
    amount: chargedAmount,
    originalAmount,
    discountAmount,
    promotionId: price.promotion?.id ?? null,
    promotionName: price.promotion?.name ?? null,
    promotionTargetType,
    promotionTargetId,
    promotionEndsAt: price.promotion?.endsAt ?? null,
    currency: "INR",
    status: "created",
    paidAt: null,
    refundedAt: null,
    fulfilledAt: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await payments.insertOne(doc);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const raced = await payments.findOne({ razorpayOrderId: order.id });
    if (!raced) throw err;
    return {
      orderId: raced.razorpayOrderId,
      amount: raced.amount,
      currency: "INR",
      plan: quote.durationId,
      accessType: quote.accessType,
      bundleId,
      serverId: raced.serverId,
      keyId,
      description: checkoutDescription,
      reused: true,
      originalAmount: raced.originalAmount ?? raced.amount,
      discountAmount: raced.discountAmount ?? 0,
      promotionId: raced.promotionId ?? null,
      promotionName: raced.promotionName ?? null,
      promotionEndsAt: raced.promotionEndsAt?.toISOString() ?? null,
    };
  }

  return {
    orderId: order.id,
    amount: chargedAmount,
    currency: "INR",
    plan: quote.durationId,
    accessType: quote.accessType,
    bundleId,
    serverId,
    keyId,
    description: checkoutDescription,
    reused: false,
    originalAmount,
    discountAmount,
    promotionId: price.promotion?.id ?? null,
    promotionName: price.promotion?.name ?? null,
    promotionEndsAt: price.promotion?.endsAt.toISOString() ?? null,
  };
}

export type FulfillPaymentResult = {
  alreadyFulfilled: boolean;
  paymentId: string;
  expiresAt: Date | null;
  lifetime: boolean;
};

export async function fulfillOnlineVipPurchase(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount?: number;
}): Promise<FulfillPaymentResult | null> {
  if (!Number.isSafeInteger(input.amount) || input.amount! <= 0) {
    throw new Error("A valid captured payment amount is required.");
  }
  await ready();
  await ensureVipRoleServiceReady();
  const payments = await paymentsCollection();
  const now = new Date();

  const claimed = await payments.findOneAndUpdate(
    {
      razorpayOrderId: input.razorpayOrderId,
      fulfilledAt: null,
      status: { $in: ["created", "authorized", "failed", "captured", "disputed"] },
      razorpayPaymentId: { $in: [null, input.razorpayPaymentId] },
    },
    [
      {
        $set: {
        razorpayPaymentId: input.razorpayPaymentId,
        status: {
          $cond: [
            { $eq: ["$status", "disputed"] },
            "disputed",
            "captured" satisfies PaymentStatus,
          ],
        },
        paidAt: { $ifNull: ["$paidAt", now] },
        failureReason: null,
        updatedAt: now,
        },
      },
    ],
    { returnDocument: "after" },
  );

  if (!claimed) {
    const existing = await payments.findOne({
      razorpayOrderId: input.razorpayOrderId,
    });
    if (!existing) {
      console.warn("[payments] captured payment for unknown order", {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
      });
      return null;
    }
    if (input.amount !== existing.amount) {
      throw new Error("Captured payment amount does not match the order.");
    }
    if (existing.fulfilledAt) {
      const status = await getVipAccessStatus(existing.userId);
      // Duplicate webhook re-delivery: retry idempotent post-fulfillment work.
      await refreshVipRolePresentation({
        userId: existing.userId,
        steamId: existing.steamId,
        source: "PURCHASE",
      });
      try {
        const { ensurePaymentInvoice } = await import("@/lib/payments/payu-invoice");
        await ensurePaymentInvoice(existing._id);
      } catch (err) {
        console.error("[payments] invoice generation failed", existing._id, err);
      }
      await trackPurchaseForPayment(existing);
      return {
        alreadyFulfilled: true,
        paymentId: existing._id,
        expiresAt: status.expiresAt,
        lifetime: status.lifetime,
      };
    }
    if (existing.status === "refunded") return null;
    if (existing.razorpayPaymentId && existing.razorpayPaymentId !== input.razorpayPaymentId) {
      throw new Error("Payment order is already linked to a different provider payment.");
    }
    // Another invocation may be processing it. Continue through the idempotent
    // entitlement transaction so failures and interrupted workers are recoverable.
    throw new Error("Captured payment is pending fulfillment retry.");
  }

  if (
    typeof input.amount === "number" &&
    input.amount !== claimed.amount
  ) {
    console.error("[payments] amount mismatch; refusing VIP grant", {
      orderId: claimed.razorpayOrderId,
      expected: claimed.amount,
      actual: input.amount,
    });
    await payments.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "failed",
          fulfilledAt: null,
          failureReason: "amount_mismatch",
          updatedAt: new Date(),
        },
      },
    );
    return null;
  }

  const user = await findUserById(claimed.userId);
  if (!user) {
    throw new Error(`Payment user ${claimed.userId} not found.`);
  }

  const purchasedAt = claimed.paidAt ?? now;
  const history = await vipHistoryCollection();
  const accessType =
    claimed.accessType ??
    (claimed.serverId || (claimed.serverIds?.length ?? 0) > 0
      ? "INDIVIDUAL_SERVER"
      : claimed.bundleKind === "all" ||
          claimed.bundleId === "all" ||
          claimed.bundleId === "all_retakes"
        ? "ALL_RETAKES"
        : undefined);
  const bundleId =
    claimed.bundleId ?? claimed.serverId ?? "all_retakes";
  const bundleKind =
    claimed.bundleKind ??
    (claimed.serverId || claimed.accessType === "INDIVIDUAL_SERVER"
      ? "server"
      : "all");
  const serverId = claimed.serverId ?? null;
  const serverIds = claimed.serverIds ?? [];

  const purchaseKey = entitlementKeyFromPurchase({
    accessType,
    serverId,
    serverIds,
    bundleId,
    bundleKind,
  });
  const historyDoc: VipHistoryDoc = {
    _id: crypto.randomUUID(),
    userId: claimed.userId,
    steamId: claimed.steamId,
    bundleId,
    bundleKind,
    bundleName: claimed.bundleName ?? null,
    accessType,
    serverId,
    serverIds,
    plan: claimed.plan,
    amount: claimed.amount,
    originalAmount: claimed.originalAmount ?? claimed.amount,
    discountAmount: claimed.discountAmount ?? 0,
    promotionId: claimed.promotionId ?? null,
    promotionName: claimed.promotionName ?? null,
    promotionTargetType: claimed.promotionTargetType ?? null,
    promotionTargetId: claimed.promotionTargetId ?? null,
    promotionEndsAt: claimed.promotionEndsAt ?? null,
    durationDays: claimed.durationDays,
    startDate: purchasedAt,
    endDate: purchasedAt,
    paymentId: claimed._id,
    calculationVersion: 2,
    createdAt: purchasedAt,
  };

  const completion = await withVipEntitlementTransaction({
    userId: claimed.userId,
    run: async ({ session }) => {
      const existingEntitlement = await history.findOne(
        { paymentId: claimed._id },
        { session },
      );
      let persistedEntitlement = existingEntitlement;
      if (existingEntitlement) {
        if (
          existingEntitlement.userId !== claimed.userId ||
          existingEntitlement.amount !== claimed.amount ||
          existingEntitlement.bundleId !== bundleId ||
          existingEntitlement.accessType !== accessType ||
          existingEntitlement.serverId !== serverId ||
          JSON.stringify([...(existingEntitlement.serverIds ?? [])].sort()) !==
            JSON.stringify([...serverIds].sort())
        ) {
          throw new Error(`Payment ${claimed._id} has conflicting entitlement history.`);
        }
      } else {
        const priorHistory = await loadEffectiveVipHistory(claimed.userId, session);
        const priorForKey = purchaseKey
          ? priorHistory.filter((record) => entitlementKeyFromRecord(record) === purchaseKey)
          : [];
        const priorExpiry = computeEntitlementExpiry(priorForKey);
        const extension = computeVipExtension({
          currentExpiresAt: priorExpiry,
          now: purchasedAt,
          durationDays: claimed.durationDays,
        });
        persistedEntitlement = {
          ...historyDoc,
          startDate: extension.startDate,
          endDate: extension.endDate,
        };
        await history.insertOne(persistedEntitlement, { session });
      }

      const vipRole = await synchronizeVipRole({
        userId: claimed.userId,
        steamId: claimed.steamId,
        personaName: user.personaName,
        source: "PURCHASE",
        grantedBy: null,
        mode: "extend",
        session,
      });
      if (!persistedEntitlement) {
        throw new Error(`Payment ${claimed._id} entitlement was not persisted.`);
      }
      const currentPayment = await payments.findOne({ _id: claimed._id }, { session });
      if (!currentPayment || !["captured", "disputed"].includes(currentPayment.status)) {
        throw new Error(`Payment ${claimed._id} is no longer eligible for fulfillment.`);
      }
      const completedAt = new Date();
      if (!currentPayment.fulfilledAt) {
        const completionUpdate = await payments.updateOne(
          { _id: claimed._id, fulfilledAt: null, status: { $in: ["captured", "disputed"] } },
          {
            $set: {
              fulfilledAt: completedAt,
              failureReason: null,
              updatedAt: completedAt,
            },
          },
          { session },
        );
        if (!completionUpdate.matchedCount) {
          throw new Error(`Payment ${claimed._id} changed before fulfillment completed.`);
        }
      }
      return { entitlement: persistedEntitlement, role: vipRole };
    },
  });

  await refreshVipRolePresentation({
    userId: claimed.userId,
    steamId: claimed.steamId,
    source: "PURCHASE",
  });

  console.info("[payments] VIP granted", {
    userId: claimed.userId,
    steamId: claimed.steamId,
    plan: claimed.plan,
    bundleId: claimed.bundleId,
    entitlementKey: purchaseKey,
    amount: claimed.amount,
    razorpayOrderId: claimed.razorpayOrderId,
    razorpayPaymentId: claimed.razorpayPaymentId,
    startDate: completion.entitlement.startDate.toISOString(),
    endDate: completion.entitlement.endDate.toISOString(),
    vipCoversUntil: completion.role.expiresAt?.toISOString() ?? null,
    lifetime: completion.role.lifetime,
  });

  try {
    const { ensurePaymentInvoice } = await import("@/lib/payments/payu-invoice");
    await ensurePaymentInvoice(claimed._id);
  } catch (err) {
    console.error("[payments] invoice generation failed", claimed._id, err);
  }

  await trackPurchaseForPayment(claimed);

  return {
    alreadyFulfilled: false,
    paymentId: claimed._id,
    expiresAt: completion.role.lifetime ? null : (completion.role.expiresAt ?? completion.entitlement.endDate),
    lifetime: completion.role.lifetime,
  };
}

/** Backwards-compatible name for existing online provider adapters. */
export async function fulfillCapturedPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount?: number;
}): Promise<FulfillPaymentResult | null> {
  return fulfillOnlineVipPurchase(input);
}

export async function markPaymentFailed(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  reason?: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  await payments.updateOne(
    {
      razorpayOrderId: input.razorpayOrderId,
      status: { $nin: ["captured", "refunded"] },
    },
    {
      $set: {
        ...(input.razorpayPaymentId
          ? { razorpayPaymentId: input.razorpayPaymentId }
          : {}),
        status: "failed" satisfies PaymentStatus,
        failureReason: input.reason ?? "payment_failed",
        updatedAt: new Date(),
      },
    },
  );
}

export async function markPaymentRefunded(input: {
  razorpayPaymentId: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  const now = new Date();
  const existing = await payments.findOne({ razorpayPaymentId: input.razorpayPaymentId });
  if (!existing) return;
  const user = await findUserById(existing.userId);
  if (!user) throw new Error(`Payment user ${existing.userId} not found.`);

  let payment = existing;
  if (existing.status !== "refunded") {
    const refund = await withVipEntitlementTransaction({
      userId: existing.userId,
      run: async ({ session }) => {
        const updated = await payments.updateOne(
          { _id: existing._id, status: { $in: ["captured", "disputed"] } },
          {
            $set: {
              status: "refunded" satisfies PaymentStatus,
              refundedAt: now,
              updatedAt: now,
            },
          },
          { session },
        );
        if (!updated.matchedCount) {
          const latest = await payments.findOne({ _id: existing._id }, { session });
          if (!latest || latest.status !== "refunded") return null;
        }
        const history = await vipHistoryCollection();
        await history.updateOne(
          { paymentId: existing._id, userId: existing.userId },
          { $set: { status: "REVOKED" } },
          { session },
        );
        const role = await synchronizeVipRole({
          userId: user._id,
          steamId: user.steamId,
          personaName: user.personaName,
          source: "PURCHASE",
          grantedBy: null,
          mode: "reconcile",
          session,
        });
        const latest = await payments.findOne({ _id: existing._id }, { session });
        return latest ? { payment: latest, role } : null;
      },
    });
    if (!refund) return;
    payment = refund.payment;
  }

  await refreshVipRolePresentation({ userId: user._id, steamId: user.steamId });

  console.info("[payments] VIP refund applied", {
    userId: payment.userId,
    razorpayPaymentId: payment.razorpayPaymentId,
    durationDays: payment.durationDays,
  });

  await trackRefundForPayment(payment);
}

export async function markPaymentDisputed(input: {
  razorpayPaymentId: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  await payments.updateOne(
    { razorpayPaymentId: input.razorpayPaymentId, status: "captured" },
    {
      $set: {
        status: "disputed" satisfies PaymentStatus,
        updatedAt: new Date(),
      },
    },
  );
}

export type PayuOrderStatusView = {
  status: PaymentStatus;
  paymentId: string;
  fulfilled: boolean;
  invoiceNumber: string | null;
};

/** Read the payment row the webhook updates. Does not capture or fail the payment. */
export async function getPaymentOrderStatusForUser(input: {
  userId: string;
  orderId: string;
}): Promise<PayuOrderStatusView | null> {
  await ready();
  const payments = await paymentsCollection();
  const payment = await payments.findOne({
    razorpayOrderId: input.orderId,
    userId: input.userId,
  });
  if (!payment) return null;

  return {
    status: payment.status,
    paymentId: payment._id,
    fulfilled: payment.fulfilledAt !== null,
    invoiceNumber: payment.invoiceNumber ?? null,
  };
}

export async function getPayuOrderStatusForUser(input: {
  userId: string;
  txnid: string;
}): Promise<PayuOrderStatusView | null> {
  await ready();
  const payments = await paymentsCollection();
  const payment = await payments.findOne({
    razorpayOrderId: input.txnid,
    userId: input.userId,
    provider: "payu",
  });
  if (!payment) return null;

  return {
    status: payment.status,
    paymentId: payment._id,
    fulfilled: payment.fulfilledAt !== null,
    invoiceNumber: payment.invoiceNumber ?? null,
  };
}

export async function recordPayuWebhookEventId(
  eventId: string,
  event: string,
): Promise<boolean> {
  await ready();
  const events = await payuWebhookEventsCollection();
  try {
    await events.insertOne({
      _id: crypto.randomUUID(),
      eventId,
      event,
      processedAt: new Date(),
    });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

export async function recordWebhookEventId(eventId: string, event: string): Promise<boolean> {
  await ready();
  const events = await razorpayWebhookEventsCollection();
  try {
    await events.insertOne({
      _id: crypto.randomUUID(),
      eventId,
      event,
      processedAt: new Date(),
    });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}
