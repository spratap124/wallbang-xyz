import { NextResponse } from "next/server";

import {
  verifyPayuResponseHash,
  type PayuResponseParams,
} from "@/lib/payments/payu";

export const dynamic = "force-dynamic";

/** Browser return URL only — VIP fulfillment happens exclusively in the PayU webhook. */
function redirectToVip(
  outcome: "pending" | "failure" | "invalid",
  txnid?: string,
): Response {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const params = new URLSearchParams();
  if (outcome === "pending") {
    params.set("paid", "pending");
    if (txnid) params.set("txnid", txnid);
  } else if (outcome === "failure") {
    params.set("paid", "0");
  } else {
    params.set("paid", "0");
    params.set("error", "invalid");
  }
  return NextResponse.redirect(`${base}/vip?${params.toString()}`, {
    status: 303,
  });
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
    return redirectToVip("failure");
  }

  return redirectToVip("pending", params.txnid);
}

export async function POST(request: Request): Promise<Response> {
  return handleCallback(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleCallback(request);
}
