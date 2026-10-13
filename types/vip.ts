export const VIP_PLAN_IDS = [
  "1_month",
  "3_months",
  "6_months",
  "1_year",
] as const;

export type VipPlanId = (typeof VIP_PLAN_IDS)[number];
export type VipPricingByPlan = Partial<Record<VipPlanId, number>>;

export const VIP_ACCESS_TYPES = [
  "INDIVIDUAL_SERVER",
  "ALL_RETAKES",
  "BUNDLE",
] as const;

export type VipAccessType = (typeof VIP_ACCESS_TYPES)[number];

export const VIP_BUNDLE_KINDS = ["all", "server", "custom"] as const;

export type VipBundleKind = (typeof VIP_BUNDLE_KINDS)[number];

export type VipDurationMeta = {
  id: VipPlanId;
  name: string;
  months: number;
  durationDays: number;
  badge?: "popular" | "best-value";
};

/** Display-only duration row — amounts computed server-side. */
export type VipDurationOption = {
  id: VipPlanId;
  name: string;
  months: number;
  durationDays: number;
  badge?: "popular" | "best-value";
  amountPaise: number;
  perMonthPaise: number | null;
};

export type VipShopQuote = {
  accessType: VipAccessType;
  serverId: string | null;
  /** Set when accessType is BUNDLE. */
  bundleId: string | null;
  durations: VipDurationOption[];
};

/** A named, admin-managed bundle of servers with its own pricing. */
export type VipBundleDoc = {
  _id: string;
  id: string;
  name: string;
  description: string | null;
  serverIds: string[];
  pricingByPlan: VipPricingByPlan;
  enabled: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Admin-facing bundle with resolved durations and server names. */
export type VipBundleView = Omit<VipBundleDoc, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  durations: VipDurationOption[];
  servers: VipServerRef[];
};

/** Public shop representation of a bundle. */
export type VipShopBundle = {
  id: string;
  name: string;
  description: string | null;
  serverIds: string[];
  servers: VipServerRef[];
  durations: VipDurationOption[];
};

export type VipShopServer = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  city: string;
  region: string;
  map: string;
  maxPlayers: number;
  pingMs: number;
  status: "live" | "offline" | "maintenance";
  vipPricingByPlan?: VipPricingByPlan;
  /** Per-server duration prices for the individual-server picker. */
  durationOptions: VipDurationOption[];
};

export type VipShopCatalog = {
  servers: VipShopServer[];
  allRetakes: {
    durations: VipDurationOption[];
  };
  bundles: VipShopBundle[];
  quote: VipShopQuote;
};

/** Authoritative checkout quote for order creation. */
export type VipQuote = {
  accessType: VipAccessType;
  amountPaise: number;
  durationId: VipPlanId;
  durationDays: number;
  serverId: string | null;
  /** Servers covered by this purchase (bundle or multi-server legacy). */
  serverIds: string[];
  bundleKind: VipBundleKind;
  bundleId: string;
};

export type VipEntitlementStatus = "active" | "expired";

export type VipServerRef = {
  id: string;
  name: string;
};

export type VipIndividualEntitlement = {
  kind: "individual";
  serverId: string;
  serverName: string;
  expiresAt: string | null;
  status: VipEntitlementStatus;
};

export type VipBundleEntitlement = {
  kind: "bundle";
  bundleId: string;
  label: string;
  expiresAt: string | null;
  status: VipEntitlementStatus;
  includedServers: VipServerRef[];
};

export type VipLifetimeEntitlement = {
  kind: "lifetime";
  label: string;
  expiresAt: null;
  status: "active";
};

export type VipGeneralEntitlement = {
  kind: "general";
  label: string;
  expiresAt: string | null;
  status: VipEntitlementStatus;
};

export type VipEntitlement =
  | VipIndividualEntitlement
  | VipBundleEntitlement
  | VipLifetimeEntitlement
  | VipGeneralEntitlement;

export type VipMembershipSummary = {
  activeCount: number;
  serverCount: number;
  headline: string;
  subline: string | null;
};

export type VipMembershipView = {
  hasActiveVip: boolean;
  lifetime: boolean;
  overallExpiresAt: string | null;
  lastExpiredAt: string | null;
  entitlements: VipEntitlement[];
  summary: VipMembershipSummary | null;
};
