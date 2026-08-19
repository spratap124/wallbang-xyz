import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  notes: Record<string, string>;
};

function keyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}

function keySecret(): string | null {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || null;
}

function webhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(keyId() && keySecret());
}

export function getRazorpayKeyId(): string | null {
  return keyId();
}

export function isRazorpayWebhookConfigured(): boolean {
  return Boolean(webhookSecret());
}

function basicAuthHeader(): string {
  const id = keyId();
  const secret = keySecret();
  if (!id || !secret) {
    throw new Error("Razorpay is not configured.");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function signaturesMatch(expectedHex: string, actual: string): boolean {
  const expected = Buffer.from(expectedHex);
  const received = Buffer.from(actual);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = webhookSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signaturesMatch(expected, signature);
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = keySecret();
  if (!secret) return false;
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signaturesMatch(expected, input.signature);
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
  idempotencyKey: string;
}): Promise<RazorpayOrder> {
  const response = await fetch(ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
  });

  const body = (await response.json()) as RazorpayOrder & { error?: { description?: string } };
  if (!response.ok) {
    throw new Error(body.error?.description ?? "Unable to create Razorpay order.");
  }
  return body;
}
