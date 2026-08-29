import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  PaymentDoc,
  PayuWebhookEventDoc,
  RazorpayWebhookEventDoc,
  VipHistoryDoc,
} from "@/types/payments";

const PAYMENTS = "payments";
const VIP_HISTORY = "vip_history";
const RAZORPAY_WEBHOOK_EVENTS = "razorpay_webhook_events";
const PAYU_WEBHOOK_EVENTS = "payu_webhook_events";

let indexesReady: Promise<void> | null = null;

export async function paymentsCollection(): Promise<Collection<PaymentDoc>> {
  const db = await getDb();
  return db.collection<PaymentDoc>(PAYMENTS);
}

export async function vipHistoryCollection(): Promise<Collection<VipHistoryDoc>> {
  const db = await getDb();
  return db.collection<VipHistoryDoc>(VIP_HISTORY);
}

export async function razorpayWebhookEventsCollection(): Promise<
  Collection<RazorpayWebhookEventDoc>
> {
  const db = await getDb();
  return db.collection<RazorpayWebhookEventDoc>(RAZORPAY_WEBHOOK_EVENTS);
}

export async function payuWebhookEventsCollection(): Promise<
  Collection<PayuWebhookEventDoc>
> {
  const db = await getDb();
  return db.collection<PayuWebhookEventDoc>(PAYU_WEBHOOK_EVENTS);
}

export async function ensurePaymentIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [payments, history, razorpayEvents, payuEvents] = await Promise.all([
        paymentsCollection(),
        vipHistoryCollection(),
        razorpayWebhookEventsCollection(),
        payuWebhookEventsCollection(),
      ]);

      await Promise.all([
        payments.createIndex({ razorpayOrderId: 1 }, { unique: true }),
        payments.createIndex(
          { razorpayPaymentId: 1 },
          {
            unique: true,
            partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
          },
        ),
        payments.createIndex({ userId: 1, createdAt: -1 }),
        payments.createIndex({ userId: 1, plan: 1, status: 1, createdAt: -1 }),
        payments.createIndex({
          userId: 1,
          bundleId: 1,
          plan: 1,
          status: 1,
          createdAt: -1,
        }),
        payments.createIndex({ provider: 1, userId: 1, createdAt: -1 }),
        payments.createIndex(
          { invoiceNumber: 1 },
          {
            unique: true,
            partialFilterExpression: { invoiceNumber: { $type: "string" } },
          },
        ),
        history.createIndex({ userId: 1, createdAt: -1 }),
        history.createIndex({ paymentId: 1 }, { unique: true }),
        razorpayEvents.createIndex({ eventId: 1 }, { unique: true }),
        payuEvents.createIndex({ eventId: 1 }, { unique: true }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
