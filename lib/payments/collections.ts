import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  PaymentDoc,
  RazorpayWebhookEventDoc,
  VipHistoryDoc,
} from "@/types/payments";

const PAYMENTS = "payments";
const VIP_HISTORY = "vip_history";
const WEBHOOK_EVENTS = "razorpay_webhook_events";

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
  return db.collection<RazorpayWebhookEventDoc>(WEBHOOK_EVENTS);
}

export async function ensurePaymentIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [payments, history, events] = await Promise.all([
        paymentsCollection(),
        vipHistoryCollection(),
        razorpayWebhookEventsCollection(),
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
        history.createIndex({ userId: 1, createdAt: -1 }),
        history.createIndex({ paymentId: 1 }, { unique: true }),
        events.createIndex({ eventId: 1 }, { unique: true }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
