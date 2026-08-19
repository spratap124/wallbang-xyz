export const VIP_PLAN_IDS = [
  "1_month",
  "3_months",
  "6_months",
  "1_year",
] as const;

export type VipPlanId = (typeof VIP_PLAN_IDS)[number];
export type VipPricingByPlan = Partial<Record<VipPlanId, number>>;

export const VIP_BUNDLE_KINDS = ["all", "server"] as const;

export type VipBundleKind = (typeof VIP_BUNDLE_KINDS)[number];

export type VipDuration = {
  id: VipPlanId;
  name: string;
  months: number;
  durationDays: number;
  perServerPaise: number;
  allServersPaise: number;
  badge?: "popular" | "best-value";
};

/** Display-only duration row — amounts computed server-side. */
export type VipDurationOption = {
  id: VipPlanId;
  name: string;
  months: number;
  badge?: "popular" | "best-value";
  amountPaise: number;
  perMonthPaise: number | null;
  serverAmounts: Array<{ serverId: string; amountPaise: number }>;
};

export type VipShopQuote = {
  serverIds: string[];
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
};

export type VipShopCatalog = {
  servers: VipShopServer[];
  quote: VipShopQuote;
};

export type VipQuote = {
  amountPaise: number;
  serverCount: number;
  fleetRate: boolean;
  durationId: VipPlanId;
  durationDays: number;
  serverIds: string[];
};
