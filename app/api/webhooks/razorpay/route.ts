import { NextResponse } from "next/server";

import { isMongoConfigured } from "@/lib/mongo";
import {
  isRazorpayWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  fulfillCapturedPayment,
  markPaymentDisputed,
  markPaymentFailed,
  markPaymentRefunded,
  recordWebhookEventId,
} from "@/lib/payments/service";

export const dynamic = "force-dynamic";

type RazorpayEntity = {
  id?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
  error_description?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    refund?: { entity?: RazorpayEntity };
    dispute?: { entity?: RazorpayEntity };
  };
};

function entity(
  payload: RazorpayWebhookPayload,
  key: "payment" | "refund" | "dispute",
): RazorpayEntity | undefined {
  return payload.payload?.[key]?.entity;
}

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured() || !isRazorpayWebhookConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[payments] invalid Razorpay webhook signature");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = payload.event ?? "unknown";
  const eventId = request.headers.get("x-razorpay-event-id");

  try {
    if (event === "payment.captured" || event === "order.paid") {
      const payment = entity(payload, "payment");
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (orderId && paymentId) {
        await fulfillCapturedPayment({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          amount: payment?.amount,
        });
      }
    } else if (event === "payment.failed") {
      const payment = entity(payload, "payment");
      if (payment?.order_id) {
        await markPaymentFailed({
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          reason: payment.error_description ?? "payment_failed",
        });
      }
    } else if (event === "refund.processed") {
      const refund = entity(payload, "refund");
      const paymentId = refund?.payment_id;
      if (paymentId) {
        await markPaymentRefunded({ razorpayPaymentId: paymentId });
      }
    } else if (event === "dispute.created" || event === "dispute.lost") {
      const dispute = entity(payload, "dispute");
      const paymentId = dispute?.payment_id;
      if (paymentId) {
        await markPaymentDisputed({ razorpayPaymentId: paymentId });
        if (event === "dispute.lost") {
          await markPaymentRefunded({ razorpayPaymentId: paymentId });
        }
      }
    }
  } catch (err) {
    console.error("[payments] webhook handler failed", event, err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (eventId) {
    await recordWebhookEventId(eventId, event);
  }

  return NextResponse.json({ ok: true });
}
