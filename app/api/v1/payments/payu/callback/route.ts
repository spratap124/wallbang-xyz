import { NextResponse } from "next/server";

import { isMongoConfigured } from "@/lib/mongo";
import {
  parsePayuAmountToPaise,
  verifyPayuResponseHash,
  type PayuResponseParams,
} from "@/lib/payments/payu";
import {
  fulfillCapturedPayment,
  markPaymentFailed,
} from "@/lib/payments/service";

export const dynamic = "force-dynamic";

function redirectToVip(outcome: "success" | "failure" | "invalid"): Response {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const path =
    outcome === "success"
      ? "/vip?paid=1"
      : outcome === "failure"
        ? "/vip?paid=0"
        : "/vip?paid=0&error=invalid";
  return NextResponse.redirect(`${base}${path}`, { status: 303 });
}

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

async function handleCallback(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return redirectToVip("invalid");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectToVip("invalid");
  }

  const params = parsePayuFormData(formData);
  if (!params.txnid || !params.hash) {
    return redirectToVip("invalid");
  }

  if (!verifyPayuResponseHash(params)) {
    console.error("[payments] invalid PayU callback hash", {
      txnid: params.txnid,
      status: params.status,
    });
    return redirectToVip("invalid");
  }

  if (params.status !== "success") {
    await markPaymentFailed({
      razorpayOrderId: params.txnid,
      razorpayPaymentId: params.mihpayid,
      reason: params.error_Message ?? "payment_failed",
    });
    return redirectToVip("failure");
  }

  const amountPaise = parsePayuAmountToPaise(params.amount);
  try {
    await fulfillCapturedPayment({
      razorpayOrderId: params.txnid,
      razorpayPaymentId: params.mihpayid ?? params.txnid,
      amount: Number.isFinite(amountPaise) ? amountPaise : undefined,
    });
    return redirectToVip("success");
  } catch (err) {
    console.error("[payments] PayU callback fulfillment failed", params.txnid, err);
    return redirectToVip("failure");
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleCallback(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleCallback(request);
}
