import { hostedAccessProduct } from "@/content/business";
import type {
  VipAccessType,
  VipBundleKind,
  VipPlanId,
} from "@/types/vip";
import type { GaEcommerceItem } from "@/types/analytics";

export const GA_AFFILIATION = "WallBang";

const PLAN_LABELS: Record<VipPlanId, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
};

/**
 * GA4 ecommerce item for a VIP offer. Shared by the web tag (client) and the
 * Measurement Protocol (server) so both depend only on stable, non-personal
 * quote fields — never PII.
 */
export function vipGaItem(input: {
  accessType: VipAccessType;
  bundleKind?: VipBundleKind;
  plan: VipPlanId;
  /** Amount in paise. */
  amountPaise: number;
  serverId?: string | null;
  serverShortName?: string | null;
}): GaEcommerceItem {
  const plan = PLAN_LABELS[input.plan] ?? input.plan;
  const isAllRetakes =
    input.accessType !== "INDIVIDUAL_SERVER" ||
    input.bundleKind === "all" ||
    input.serverId == null;
  return {
    item_id: `${input.bundleKind ?? (isAllRetakes ? "all" : "server")}:${
      input.serverId ?? "all_retakes"
    }:${input.plan}`,
    item_name: `${plan} — ${hostedAccessProduct}`,
    item_brand: "WallBang",
    item_category: isAllRetakes ? "All Retakes" : "Individual Server",
    item_variant: isAllRetakes
      ? "All Retakes"
      : input.serverShortName || input.serverId || "server",
    affiliation: GA_AFFILIATION,
    price: Math.round(input.amountPaise) / 100,
    quantity: 1,
  };
}
