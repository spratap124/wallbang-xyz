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

export type PaymentProvider = "razorpay" | "payu";

export type PaymentDoc = {
  _id: string;
  userId: string;
  steamId: string;
  provider?: PaymentProvider;
  /** Provider order id — Razorpay order id or PayU txnid. */
  razorpayOrderId: string;
  /** Provider payment id — Razorpay payment id or PayU mihpayid. */
  razorpayPaymentId: string | null;
  email?: string | null;
  phone?: string | null;
  bundleId: string;
  bundleKind: VipBundleKind;
  /** Bundle display name at purchase time (snapshot). */
  bundleName?: string | null;
  accessType?: VipAccessType;
  serverId: string | null;
  serverIds: string[];
  plan: VipPlanId;
  durationDays: number;
  amount: number;
  /** Price and offer snapshot captured when the provider order was created. */
  originalAmount?: number;
  discountAmount?: number;
  promotionId?: string | null;
  promotionName?: string | null;
  promotionTargetType?: "server" | "bundle" | null;
  promotionTargetId?: string | null;
  promotionEndsAt?: Date | null;
  currency: "INR";
  status: PaymentStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  fulfilledAt: Date | null;
  failureReason: string | null;
  invoiceNumber?: string | null;
  invoiceGeneratedAt?: Date | null;
  payuInvoiceSyncedAt?: Date | null;
  /** GA4 client id captured at checkout (server-side purchase attribution). */
  gaClientId?: string | null;
  /** GA4 session id captured at checkout (joins the event to that session). */
  gaSessionId?: string | null;
  purchaseSentAt?: Date | null;
  refundSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VipHistoryDoc = {
  _id: string;
  userId: string;
  steamId: string;
  bundleId: string;
  bundleKind: VipBundleKind;
  /** Bundle display name at purchase time (snapshot). */
  bundleName?: string | null;
  accessType?: VipAccessType;
  serverId: string | null;
  serverIds: string[];
  plan: VipPlanId;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  promotionId?: string | null;
  promotionName?: string | null;
  promotionTargetType?: "server" | "bundle" | null;
  promotionTargetId?: string | null;
  promotionEndsAt?: Date | null;
  durationDays: number;
  startDate: Date;
  endDate: Date;
  paymentId: string;
  /** Origin of the entitlement when known; older rows infer this from paymentId. */
  source?: string;
  /** Stable originating role/grant id for complimentary entitlements. */
  grantId?: string | null;
  /** New grants use explicit stacking semantics; absent means legacy history. */
  calculationVersion?: 2;
  /** Explicit lifetime flag on newly created manual grants. */
  lifetimeGrant?: boolean;
  /** Superseded rows remain for audit but never contribute to access. */
  status?: "ACTIVE" | "SUPERSEDED" | "REVOKED";
  supersededBy?: string | null;
  supersededAt?: Date | null;
  createdAt: Date;
};

export type RazorpayWebhookEventDoc = {
  _id: string;
  eventId: string;
  event: string;
  processedAt: Date;
};

export type PayuWebhookEventDoc = {
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
