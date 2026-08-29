import "server-only";

import {
  buildPayuRequestHashSequence,
  buildPayuResponseHashSequence,
  hashPayuRequest,
  hashPayuResponse,
  verifyPayuResponseHashValue,
} from "@/lib/payments/payu-hash";

const TEST_PAYMENT_URL = "https://test.payu.in/_payment";
const PROD_PAYMENT_URL = "https://secure.payu.in/_payment";

export type PayuCheckoutParams = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
};

export type PayuResponseParams = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  hash: string;
  mihpayid?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  additionalCharges?: string;
  error_Message?: string;
};

function merchantKey(): string | null {
  return process.env.PAYU_MERCHANT_KEY?.trim() || null;
}

function merchantSalt(): string | null {
  return process.env.PAYU_MERCHANT_SALT?.trim() || null;
}

function isProduction(): boolean {
  return process.env.PAYU_ENV?.trim().toLowerCase() === "production";
}

export function isPayuConfigured(): boolean {
  return Boolean(merchantKey() && merchantSalt());
}

export function getPayuMerchantKey(): string | null {
  return merchantKey();
}

export function getPayuPaymentUrl(): string {
  return isProduction() ? PROD_PAYMENT_URL : TEST_PAYMENT_URL;
}

export function formatPayuAmount(amountPaise: number): string {
  return (amountPaise / 100).toFixed(2);
}

export function parsePayuAmountToPaise(amount: string): number {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100);
}

export function generatePayuRequestHash(input: {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): string {
  const key = merchantKey();
  const salt = merchantSalt();
  if (!key || !salt) {
    throw new Error("PayU is not configured.");
  }

  return hashPayuRequest({
    key,
    salt,
    ...input,
  });
}

export function verifyPayuResponseHash(params: PayuResponseParams): boolean {
  const salt = merchantSalt();
  if (!salt || !params.hash) return false;

  return verifyPayuResponseHashValue({
    key: params.key,
    salt,
    txnid: params.txnid,
    amount: params.amount,
    productinfo: params.productinfo,
    firstname: params.firstname,
    email: params.email,
    status: params.status,
    udf1: params.udf1,
    udf2: params.udf2,
    udf3: params.udf3,
    udf4: params.udf4,
    udf5: params.udf5,
    additionalCharges: params.additionalCharges,
    hash: params.hash,
  });
}

export function buildPayuCheckoutParams(input: {
  txnid: string;
  amountPaise: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): PayuCheckoutParams {
  const key = merchantKey();
  if (!key) {
    throw new Error("PayU is not configured.");
  }

  const amount = formatPayuAmount(input.amountPaise);
  const hash = generatePayuRequestHash({
    txnid: input.txnid,
    amount,
    productinfo: input.productinfo,
    firstname: input.firstname,
    email: input.email,
    udf1: input.udf1,
    udf2: input.udf2,
    udf3: input.udf3,
    udf4: input.udf4,
    udf5: input.udf5,
  });

  return {
    key,
    txnid: input.txnid,
    amount,
    productinfo: input.productinfo,
    firstname: input.firstname,
    email: input.email,
    phone: input.phone,
    surl: input.surl,
    furl: input.furl,
    hash,
    udf1: input.udf1,
    udf2: input.udf2,
    udf3: input.udf3,
    udf4: input.udf4,
    udf5: input.udf5,
  };
}

export function generatePayuTxnId(): string {
  return `wb_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

export {
  buildPayuRequestHashSequence,
  buildPayuResponseHashSequence,
  hashPayuRequest,
  hashPayuResponse,
};
