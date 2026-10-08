import "server-only";

import { isGaMeasurementProtocolConfigured, sendGaMeasurementProtocolEvent } from "@/lib/analytics/ga-mp";
import { vipGaItem } from "@/lib/analytics/items";
import { getGameServerById } from "@/lib/servers/registry";
import type { PaymentDoc } from "@/types/payments";
import type { VipAccessType } from "@/types/vip";

function accessTypeOf(payment: PaymentDoc): VipAccessType {
  return payment.accessType ?? "INDIVIDUAL_SERVER";
}

async function itemFor(payment: PaymentDoc) {
  const serverId = payment.serverId ?? payment.serverIds[0] ?? null;
  let serverShortName: string | null = null;
  if (serverId) {
    const server = await getGameServerById(serverId, {
      includeDisabled: true,
    }).catch(() => null);
    serverShortName = server?.shortName || server?.name || null;
  }
  return vipGaItem({
    accessType: accessTypeOf(payment),
    bundleKind: payment.bundleKind,
    plan: payment.plan,
    amountPaise: payment.amount,
    serverId,
    serverShortName,
  });
}

/**
 * Sends the GA4 `purchase` event once per payment, from the server, after the
 * webhook confirms capture and VIP fulfillment. Idempotent via
 * `purchaseSentAt`; safe to call from both webhook events that can carry a
 * capture (`payment.captured` and `order.paid`).
 */
export async function trackPurchaseForPayment(
  payment: PaymentDoc,
): Promise<void> {
  try {
    if (!isGaMeasurementProtocolConfigured()) return;
    if (!payment.gaClientId) return;
    if (payment.purchaseSentAt) return;

    const item = await itemFor(payment);
    const sent = await sendGaMeasurementProtocolEvent({
      clientId: payment.gaClientId,
      name: "purchase",
      params: {
        transaction_id: payment.razorpayOrderId,
        value: Math.round(payment.amount) / 100,
        currency: payment.currency,
        payment_provider: payment.provider ?? "razorpay",
        vip_access_type: accessTypeOf(payment),
        vip_plan: payment.plan,
      },
      items: [item],
    });

    // Analytics is not a fulfillment dependency; only record success so a
    // later webhook re-delivery can retry a failed send.
    if (sent) {
      const { paymentsCollection } = await import("@/lib/payments/collections");
      const payments = await paymentsCollection();
      await payments.updateOne(
        { _id: payment._id, purchaseSentAt: { $eq: null } },
        { $set: { purchaseSentAt: new Date(), updatedAt: new Date() } },
      );
    }
  } catch (err) {
    console.warn("[analytics] purchase tracking failed", {
      razorpayOrderId: payment.razorpayOrderId,
      err: err instanceof Error ? err.message : err,
    });
  }
}

/** Mirrors `purchase` with a GA4 `refund` event once per payment. */
export async function trackRefundForPayment(payment: PaymentDoc): Promise<void> {
  try {
    if (!isGaMeasurementProtocolConfigured()) return;
    if (!payment.gaClientId) return;
    if (payment.refundSentAt) return;
    if (!payment.purchaseSentAt) return; // refunds without a tracked purchase are noise

    const item = await itemFor(payment);
    const sent = await sendGaMeasurementProtocolEvent({
      clientId: payment.gaClientId,
      name: "refund",
      params: {
        transaction_id: payment.razorpayOrderId,
        value: Math.round(payment.amount) / 100,
        currency: payment.currency,
      },
      items: [item],
    });

    if (sent) {
      const { paymentsCollection } = await import("@/lib/payments/collections");
      const payments = await paymentsCollection();
      await payments.updateOne(
        { _id: payment._id, refundSentAt: { $eq: null } },
        { $set: { refundSentAt: new Date(), updatedAt: new Date() } },
      );
    }
  } catch (err) {
    console.warn("[analytics] refund tracking failed", {
      razorpayOrderId: payment.razorpayOrderId,
      err: err instanceof Error ? err.message : err,
    });
  }
}
