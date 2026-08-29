import "server-only";

import { sha512Hex } from "@/lib/payments/payu-hash";
import { getPayuMerchantKey, isPayuConfigured } from "@/lib/payments/payu";

const TEST_POSTSERVICE_URL =
  "https://test.payu.in/merchant/postservice.php?form=2";
const PROD_POSTSERVICE_URL =
  "https://info.payu.in/merchant/postservice.php?form=2";

function merchantSalt(): string | null {
  return process.env.PAYU_MERCHANT_SALT?.trim() || null;
}

function isProduction(): boolean {
  return process.env.PAYU_ENV?.trim().toLowerCase() === "production";
}

export function getPayuPostserviceUrl(): string {
  return isProduction() ? PROD_POSTSERVICE_URL : TEST_POSTSERVICE_URL;
}

export function hashPayuPostservice(command: string, var1: string): string {
  const key = getPayuMerchantKey();
  const salt = merchantSalt();
  if (!key || !salt) {
    throw new Error("PayU is not configured.");
  }
  return sha512Hex(`${key}|${command}|${var1}|${salt}`);
}

export type PayuPostserviceResponse = {
  status?: string | number;
  msg?: string;
  transaction_id?: string;
  [key: string]: unknown;
};

export async function callPayuPostservice(input: {
  command: string;
  var1: string;
  fields?: Record<string, string | undefined>;
}): Promise<PayuPostserviceResponse> {
  if (!isPayuConfigured()) {
    throw new Error("PayU is not configured.");
  }

  const key = getPayuMerchantKey();
  if (!key) {
    throw new Error("PayU is not configured.");
  }

  const hash = hashPayuPostservice(input.command, input.var1);
  const body = new URLSearchParams();
  body.set("key", key);
  body.set("command", input.command);
  body.set("hash", hash);
  body.set("var1", input.var1);

  for (const [field, value] of Object.entries(input.fields ?? {})) {
    if (value) body.set(field, value);
  }

  const response = await fetch(getPayuPostserviceUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const raw = await response.text();
  try {
    return JSON.parse(raw) as PayuPostserviceResponse;
  } catch {
    return { status: "raw", msg: raw };
  }
}

/** Attach invoice number to a completed PayU transaction (stored in UDF6 when enabled). */
export async function syncPayuInvoiceNumber(input: {
  txnid: string;
  invoiceNumber: string;
}): Promise<boolean> {
  const result = await callPayuPostservice({
    command: "udf_update",
    var1: input.txnid,
    fields: {
      var7: input.invoiceNumber,
    },
  });

  const status = String(result.status ?? "").toLowerCase();
  if (status.includes("udf values updated") || status === "1") {
    return true;
  }

  console.warn("[payments] PayU invoice UDF sync failed", {
    txnid: input.txnid,
    invoiceNumber: input.invoiceNumber,
    status: result.status,
    msg: result.msg,
  });
  return false;
}
