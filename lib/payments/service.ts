import "server-only";

import { quoteVipOrder } from "@/config/vip-plans";
import type { VipPlanId } from "@/types/vip";
import { findUserById } from "@/lib/auth/users";
import {
  ensurePaymentIndexes,
  paymentsCollection,
  razorpayWebhookEventsCollection,
  vipHistoryCollection,
} from "@/lib/payments/collections";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import {
  extendVipExpiry,
  getUserPermissions,
  subtractVipExpiry,
} from "@/lib/permissions/service";
import { rateLimit } from "@/lib/rate-limit";
import { getGameServers } from "@/lib/servers/registry";
import type {
  PaymentDoc,
  PaymentStatus,
  VipAccessStatus,
} from "@/types/payments";

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

export async function getVipAccessStatus(
  userId: string,
): Promise<VipAccessStatus> {
  const resolved = await getUserPermissions({ userId });
  if (!resolved) {
    return { isVip: false, lifetime: false, expiresAt: null, source: null };
  }

  const founding = resolved.activeAssignments.find(
    (a) => a.roleCode === "FOUNDING_MEMBER",
  );
  const vip = resolved.activeAssignments.find((a) => a.roleCode === "VIP");
  const assignment = founding ?? vip;

  if (!assignment) {
    return { isVip: false, lifetime: false, expiresAt: null, source: null };
  }

  const lifetime = assignment.expiresAt === null;
  return {
    isVip: true,
    lifetime,
    expiresAt: assignment.expiresAt,
    source: assignment.source,
  };
}

export type CreateVipOrderResult = {
  orderId: string;
  amount: number;
  currency: "INR";
  plan: VipPlanId;
  bundleId: string;
  serverIds: string[];
  keyId: string;
  name: string;
  description: string;
  reused: boolean;
};

export async function createVipOrder(input: {
  userId: string;
  steamId: string;
  personaName: string;
  planId: string;
  serverIds: string[];
}): Promise<CreateVipOrderResult> {
  await ready();

  if (!isRazorpayConfigured()) {
    throw new Error("VIP purchases are not configured yet.");
  }

  const servers = await getGameServers();
  const quote = quoteVipOrder({
    servers,
    selectedServerIds: input.serverIds,
    planId: input.planId,
  });

  const limited = rateLimit(`vip-order:${input.userId}`, 8, 60_000);
  if (!limited.ok) {
    throw new Error("Too many payment attempts. Try again shortly.");
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  if (!keyId) {
    throw new Error("VIP purchases are not configured yet.");
  }

  const bundleId = quote.fleetRate ? "all" : quote.serverIds.join("+");
  const bundleKind = quote.fleetRate ? "all" : "server";
  const serverId =
    quote.serverIds.length === 1 ? quote.serverIds[0]! : null;
  const checkoutName = "WallBang VIP";
  const checkoutDescription = quote.fleetRate
    ? `${quote.durationDays} days · all servers`
    : `${quote.durationDays} days · ${quote.serverCount} server${quote.serverCount === 1 ? "" : "s"}`;

  const payments = await paymentsCollection();
  const reuseAfter = new Date(Date.now() - REUSE_ORDER_MS);
  const existing = await payments.findOne({
    userId: input.userId,
    plan: quote.durationId,
    bundleId,
    status: "created",
    razorpayPaymentId: null,
    createdAt: { $gt: reuseAfter },
  });

  if (existing) {
    return {
      orderId: existing.razorpayOrderId,
      amount: existing.amount,
      currency: "INR",
      plan: quote.durationId,
      bundleId,
      serverIds: quote.serverIds,
      keyId,
      name: checkoutName,
      description: checkoutDescription,
      reused: true,
    };
  }

  const receipt = `wb_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const order = await createRazorpayOrder({
    amountPaise: quote.amountPaise,
    receipt,
    notes: {
      user_id: input.userId,
      steam_id: input.steamId,
      plan: quote.durationId,
      bundle: bundleId,
      server_ids: quote.serverIds.join(","),
    },
    idempotencyKey: `${input.userId}:${bundleId}:${quote.durationId}:${receipt}`,
  });

  const now = new Date();
  const doc: PaymentDoc = {
    _id: crypto.randomUUID(),
    userId: input.userId,
    steamId: input.steamId,
    razorpayOrderId: order.id,
    razorpayPaymentId: null,
    bundleId,
    bundleKind,
    serverId,
    serverIds: quote.serverIds,
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
    const raced = await payments.findOne({ razorpayOrderId: order.id });
    if (!raced) throw err;
    return {
      orderId: raced.razorpayOrderId,
      amount: raced.amount,
      currency: "INR",
      plan: quote.durationId,
      bundleId,
      serverIds: quote.serverIds,
      keyId,
      name: checkoutName,
      description: checkoutDescription,
      reused: true,
    };
  }

  return {
    orderId: order.id,
    amount: quote.amountPaise,
    currency: "INR",
    plan: quote.durationId,
    bundleId,
    serverIds: quote.serverIds,
    keyId,
    name: checkoutName,
    description: checkoutDescription,
    reused: false,
  };
}

export type FulfillPaymentResult = {
  alreadyFulfilled: boolean;
  paymentId: string;
  expiresAt: Date | null;
  lifetime: boolean;
};

export async function fulfillCapturedPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount?: number;
}): Promise<FulfillPaymentResult | null> {
  await ready();
  const payments = await paymentsCollection();
  const now = new Date();

  const claimed = await payments.findOneAndUpdate(
    {
      razorpayOrderId: input.razorpayOrderId,
      fulfilledAt: null,
      status: { $in: ["created", "authorized", "failed"] },
    },
    {
      $set: {
        razorpayPaymentId: input.razorpayPaymentId,
        status: "captured" satisfies PaymentStatus,
        paidAt: now,
        fulfilledAt: now,
        failureReason: null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const existing = await payments.findOne({
      razorpayOrderId: input.razorpayOrderId,
    });
    if (!existing) {
      console.warn("[payments] captured payment for unknown order", {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
      });
      return null;
    }
    const status = await getVipAccessStatus(existing.userId);
    return {
      alreadyFulfilled: true,
      paymentId: existing._id,
      expiresAt: status.expiresAt,
      lifetime: status.lifetime,
    };
  }

  if (
    typeof input.amount === "number" &&
    input.amount !== claimed.amount
  ) {
    console.error("[payments] amount mismatch; refusing VIP grant", {
      orderId: claimed.razorpayOrderId,
      expected: claimed.amount,
      actual: input.amount,
    });
    await payments.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "failed",
          fulfilledAt: null,
          failureReason: "amount_mismatch",
          updatedAt: new Date(),
        },
      },
    );
    return null;
  }

  const user = await findUserById(claimed.userId);
  if (!user) {
    throw new Error(`Payment user ${claimed.userId} not found.`);
  }

  const extension = await extendVipExpiry({
    userId: claimed.userId,
    durationDays: claimed.durationDays,
    source: "PURCHASE",
    grantedBy: null,
  });

  try {
    const history = await vipHistoryCollection();
    await history.insertOne({
      _id: crypto.randomUUID(),
      userId: claimed.userId,
      steamId: claimed.steamId,
      bundleId: claimed.bundleId ?? "all",
      bundleKind: claimed.bundleKind ?? "all",
      serverId: claimed.serverId ?? null,
      serverIds: claimed.serverIds ?? [],
      plan: claimed.plan,
      amount: claimed.amount,
      durationDays: claimed.durationDays,
      startDate: extension.startDate,
      endDate: extension.endDate,
      paymentId: claimed._id,
      createdAt: new Date(),
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }

  console.info("[payments] VIP granted", {
    userId: claimed.userId,
    steamId: claimed.steamId,
    plan: claimed.plan,
    bundleId: claimed.bundleId,
    amount: claimed.amount,
    razorpayOrderId: claimed.razorpayOrderId,
    razorpayPaymentId: claimed.razorpayPaymentId,
    startDate: extension.startDate.toISOString(),
    endDate: extension.endDate.toISOString(),
    lifetime: extension.lifetime,
  });

  return {
    alreadyFulfilled: false,
    paymentId: claimed._id,
    expiresAt: extension.lifetime ? null : extension.endDate,
    lifetime: extension.lifetime,
  };
}

export async function markPaymentFailed(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  reason?: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  await payments.updateOne(
    {
      razorpayOrderId: input.razorpayOrderId,
      status: { $nin: ["captured", "refunded"] },
    },
    {
      $set: {
        ...(input.razorpayPaymentId
          ? { razorpayPaymentId: input.razorpayPaymentId }
          : {}),
        status: "failed" satisfies PaymentStatus,
        failureReason: input.reason ?? "payment_failed",
        updatedAt: new Date(),
      },
    },
  );
}

export async function markPaymentRefunded(input: {
  razorpayPaymentId: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  const now = new Date();
  const payment = await payments.findOneAndUpdate(
    {
      razorpayPaymentId: input.razorpayPaymentId,
      status: { $in: ["captured", "disputed"] },
    },
    {
      $set: {
        status: "refunded" satisfies PaymentStatus,
        refundedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!payment) return;

  await subtractVipExpiry({
    userId: payment.userId,
    durationDays: payment.durationDays,
  });

  console.info("[payments] VIP refund applied", {
    userId: payment.userId,
    razorpayPaymentId: payment.razorpayPaymentId,
    durationDays: payment.durationDays,
  });
}

export async function markPaymentDisputed(input: {
  razorpayPaymentId: string;
}): Promise<void> {
  await ready();
  const payments = await paymentsCollection();
  await payments.updateOne(
    { razorpayPaymentId: input.razorpayPaymentId, status: "captured" },
    {
      $set: {
        status: "disputed" satisfies PaymentStatus,
        updatedAt: new Date(),
      },
    },
  );
}

export async function recordWebhookEventId(eventId: string, event: string): Promise<boolean> {
  await ready();
  const events = await razorpayWebhookEventsCollection();
  try {
    await events.insertOne({
      _id: crypto.randomUUID(),
      eventId,
      event,
      processedAt: new Date(),
    });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}
