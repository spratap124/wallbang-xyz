import "server-only";

import { quoteVipOrder } from "@/config/vip-plans";
import type { VipAccessType, VipPlanId } from "@/types/vip";
import {
  ensurePaymentIndexes,
  paymentsCollection,
} from "@/lib/payments/collections";
import {
  buildPayuCheckoutParams,
  generatePayuTxnId,
  getPayuPaymentUrl,
  isPayuConfigured,
  type PayuCheckoutParams,
} from "@/lib/payments/payu";
import { rateLimit } from "@/lib/rate-limit";
import { getGameServers } from "@/lib/servers/registry";
import type { PaymentDoc } from "@/types/payments";

const REUSE_ORDER_MS = 30 * 60 * 1000;

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === 11000,
  );
}

async function ready(): Promise<void> {
  await ensurePaymentIndexes();
}

export type CreatePayuVipOrderResult = {
  provider: "payu";
  action: string;
  params: PayuCheckoutParams;
  txnid: string;
  amount: number;
  currency: "INR";
  plan: VipPlanId;
  accessType: VipAccessType;
  bundleId: string;
  serverId: string | null;
  reused: boolean;
};

function siteBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  }
  return base;
}

export async function createPayuVipOrder(input: {
  userId: string;
  steamId: string;
  personaName: string;
  accessType: VipAccessType;
  planId: string;
  serverId: string | null;
  email: string;
  phone: string;
}): Promise<CreatePayuVipOrderResult> {
  await ready();

  if (!isPayuConfigured()) {
    throw new Error("VIP purchases are not configured yet.");
  }

  const servers = await getGameServers();
  const shopServers = servers.map((server) => ({
    id: server.id,
    name: server.name,
    shortName: server.shortName || server.name,
    mode: server.mode,
    city: server.city,
    region: server.region,
    map: server.map,
    maxPlayers: server.maxPlayersOverride ?? server.maxPlayers,
    pingMs: server.pingMs,
    status: server.status,
    vipPricingByPlan: server.vipPricingByPlan ?? undefined,
  }));

  const quote = quoteVipOrder({
    accessType: input.accessType,
    serverId: input.serverId,
    planId: input.planId,
    servers: shopServers,
  });

  const limited = rateLimit(`vip-order:${input.userId}`, 8, 60_000);
  if (!limited.ok) {
    throw new Error("Too many payment attempts. Try again shortly.");
  }

  const bundleId = quote.bundleId;
  const bundleKind = quote.bundleKind;
  const serverId = quote.serverId;
  const serverIds =
    quote.accessType === "INDIVIDUAL_SERVER" && serverId ? [serverId] : [];
  const checkoutDescription =
    quote.accessType === "ALL_RETAKES"
      ? `${quote.durationDays} days · All Retakes`
      : `${quote.durationDays} days · ${serverId ?? "server"}`;

  const callbackUrl = `${siteBaseUrl()}/api/v1/payments/payu/callback`;
  const payments = await paymentsCollection();
  const reuseAfter = new Date(Date.now() - REUSE_ORDER_MS);
  const existing = await payments.findOne({
    userId: input.userId,
    provider: "payu",
    plan: quote.durationId,
    accessType: quote.accessType,
    bundleId,
    status: "created",
    razorpayPaymentId: null,
    createdAt: { $gt: reuseAfter },
  });

  if (existing) {
    await payments.updateOne(
      { _id: existing._id },
      {
        $set: {
          email: input.email,
          phone: input.phone,
          updatedAt: new Date(),
        },
      },
    );

    const params = buildPayuCheckoutParams({
      txnid: existing.razorpayOrderId,
      amountPaise: existing.amount,
      productinfo: checkoutDescription,
      firstname: input.personaName.slice(0, 60) || "WallBang Player",
      email: input.email,
      phone: input.phone,
      surl: callbackUrl,
      furl: callbackUrl,
      udf1: input.userId,
      udf2: input.steamId,
      udf3: quote.durationId,
      udf4: bundleId,
      udf5: quote.accessType,
    });

    return {
      provider: "payu",
      action: getPayuPaymentUrl(),
      params,
      txnid: existing.razorpayOrderId,
      amount: existing.amount,
      currency: "INR",
      plan: quote.durationId,
      accessType: quote.accessType,
      bundleId,
      serverId: existing.serverId,
      reused: true,
    };
  }

  const txnid = generatePayuTxnId();
  const params = buildPayuCheckoutParams({
    txnid,
    amountPaise: quote.amountPaise,
    productinfo: checkoutDescription,
    firstname: input.personaName.slice(0, 60) || "WallBang Player",
    email: input.email,
    phone: input.phone,
    surl: callbackUrl,
    furl: callbackUrl,
    udf1: input.userId,
    udf2: input.steamId,
    udf3: quote.durationId,
    udf4: bundleId,
    udf5: quote.accessType,
  });

  const now = new Date();
  const doc: PaymentDoc = {
    _id: crypto.randomUUID(),
    userId: input.userId,
    steamId: input.steamId,
    provider: "payu",
    razorpayOrderId: txnid,
    razorpayPaymentId: null,
    email: input.email,
    phone: input.phone,
    bundleId,
    bundleKind,
    accessType: quote.accessType,
    serverId,
    serverIds,
    plan: quote.durationId,
    durationDays: quote.durationDays,
    amount: quote.amountPaise,
    currency: "INR",
    status: "created",
    paidAt: null,
    refundedAt: null,
    fulfilledAt: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await payments.insertOne(doc);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const raced = await payments.findOne({ razorpayOrderId: txnid });
    if (!raced) throw err;
    const racedParams = buildPayuCheckoutParams({
      txnid: raced.razorpayOrderId,
      amountPaise: raced.amount,
      productinfo: checkoutDescription,
      firstname: input.personaName.slice(0, 60) || "WallBang Player",
      email: input.email,
      phone: input.phone,
      surl: callbackUrl,
      furl: callbackUrl,
      udf1: input.userId,
      udf2: input.steamId,
      udf3: quote.durationId,
      udf4: bundleId,
      udf5: quote.accessType,
    });
    return {
      provider: "payu",
      action: getPayuPaymentUrl(),
      params: racedParams,
      txnid: raced.razorpayOrderId,
      amount: raced.amount,
      currency: "INR",
      plan: quote.durationId,
      accessType: quote.accessType,
      bundleId,
      serverId: raced.serverId,
      reused: true,
    };
  }

  return {
    provider: "payu",
    action: getPayuPaymentUrl(),
    params,
    txnid,
    amount: quote.amountPaise,
    currency: "INR",
    plan: quote.durationId,
    accessType: quote.accessType,
    bundleId,
    serverId,
    reused: false,
  };
}
