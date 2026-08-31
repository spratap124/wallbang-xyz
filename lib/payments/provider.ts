import "server-only";

import { isPayuConfigured } from "@/lib/payments/payu";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import type { PaymentProvider } from "@/types/payments";

function configuredProvider(): PaymentProvider | null {
  const preferred = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();

  if (preferred === "payu" && isPayuConfigured()) return "payu";
  if (preferred === "razorpay" && isRazorpayConfigured()) return "razorpay";

  if (isPayuConfigured()) return "payu";
  if (isRazorpayConfigured()) return "razorpay";

  return null;
}

export function getActivePaymentProvider(): PaymentProvider | null {
  return configuredProvider();
}

export function isPaymentConfigured(): boolean {
  return configuredProvider() !== null;
}

export function isPayuActive(): boolean {
  return getActivePaymentProvider() === "payu";
}

export function isRazorpayActive(): boolean {
  return getActivePaymentProvider() === "razorpay";
}
