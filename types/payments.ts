import type { VipAccessType, VipBundleKind, VipPlanId } from "@/types/vip";

export const PAYMENT_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "disputed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentDoc = {
  _id: string;
  userId: string;
  steamId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  bundleId: string;
  bundleKind: VipBundleKind;
  accessType?: VipAccessType;
  serverId: string | null;
  serverIds: string[];
  plan: VipPlanId;
  durationDays: number;
  amount: number;
  currency: "INR";
  status: PaymentStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  fulfilledAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VipHistoryDoc = {
  _id: string;
  userId: string;
  steamId: string;
  bundleId: string;
  bundleKind: VipBundleKind;
  accessType?: VipAccessType;
  serverId: string | null;
  serverIds: string[];
  plan: VipPlanId;
  amount: number;
  durationDays: number;
  startDate: Date;
  endDate: Date;
  paymentId: string;
  createdAt: Date;
};

export type RazorpayWebhookEventDoc = {
  _id: string;
  eventId: string;
  event: string;
  processedAt: Date;
};

export type VipAccessStatus = {
  isVip: boolean;
  lifetime: boolean;
  expiresAt: Date | null;
  source: string | null;
};
