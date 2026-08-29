import { NextResponse } from "next/server";

import { isMongoConfigured } from "@/lib/mongo";
import {
  parsePayuAmountToPaise,
  verifyPayuResponseHash,
  isPayuConfigured,
  type PayuResponseParams,
} from "@/lib/payments/payu";
import {
  fulfillCapturedPayment,
  markPaymentFailed,
  markPaymentRefunded,
  recordPayuWebhookEventId,
} from "@/lib/payments/service";

export const dynamic = "force-dynamic";

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parsePayuFormData(formData: FormData): PayuResponseParams {
  return {
    key: formValue(formData, "key"),
    txnid: formValue(formData, "txnid"),
    amount: formValue(formData, "amount"),
    productinfo: formValue(formData, "productinfo"),
    firstname: formValue(formData, "firstname"),
    email: formValue(formData, "email"),
    status: formValue(formData, "status"),
    hash: formValue(formData, "hash"),
    mihpayid: formValue(formData, "mihpayid") || undefined,
    udf1: formValue(formData, "udf1") || undefined,
    udf2: formValue(formData, "udf2") || undefined,
    udf3: formValue(formData, "udf3") || undefined,
    udf4: formValue(formData, "udf4") || undefined,
    udf5: formValue(formData, "udf5") || undefined,
    additionalCharges: formValue(formData, "additionalCharges") || undefined,
    error_Message: formValue(formData, "error_Message") || undefined,
  };
}

type PayuRefundPayload = {
  action?: string;
  status?: string;
  mihpayid?: string;
  merchantTxnId?: string;
  request_id?: string;
  token?: string;
};

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured() || !isPayuConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const rawBody = await request.text();
    let payload: PayuRefundPayload;
    try {
      payload = JSON.parse(rawBody) as PayuRefundPayload;
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const eventId =
      payload.request_id?.trim() ||
      payload.token?.trim() ||
      `${payload.mihpayid ?? "unknown"}:${payload.action ?? "unknown"}:${payload.status ?? "unknown"}`;

    try {
      if (payload.action === "refund" && payload.status === "success") {
        const paymentId = payload.mihpayid?.trim();
        if (paymentId) {
          await markPaymentRefunded({ razorpayPaymentId: paymentId });
        }
      }
    } catch (err) {
      console.error("[payments] PayU refund webhook failed", err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    await recordPayuWebhookEventId(eventId, payload.action ?? "refund");
    return NextResponse.json({ ok: true });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const params = parsePayuFormData(formData);
  if (!params.txnid || !params.hash) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyPayuResponseHash(params)) {
    console.error("[payments] invalid PayU webhook hash", {
      txnid: params.txnid,
      status: params.status,
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventId = `${params.txnid}:${params.mihpayid ?? "none"}:${params.status}`;

  try {
    if (params.status === "success") {
      const amountPaise = parsePayuAmountToPaise(params.amount);
      await fulfillCapturedPayment({
        razorpayOrderId: params.txnid,
        razorpayPaymentId: params.mihpayid ?? params.txnid,
        amount: Number.isFinite(amountPaise) ? amountPaise : undefined,
      });
    } else if (params.status === "failure") {
      await markPaymentFailed({
        razorpayOrderId: params.txnid,
        razorpayPaymentId: params.mihpayid,
        reason: params.error_Message ?? "payment_failed",
      });
    }
  } catch (err) {
    console.error("[payments] PayU webhook handler failed", params.txnid, err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  await recordPayuWebhookEventId(eventId, params.status);
  return NextResponse.json({ ok: true });
}
