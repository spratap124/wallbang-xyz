import type { FleetMonetizationAnalytics, FleetVipPurchase } from "@/types/profile";

/** The compact set of monetization fields used by the admin Revenue page. */
export type AdminRevenueResponse = {
  grossCapturedPaise: number;
  refundsPaise: number;
  netRevenuePaise: number;
  monthlyEquivalentPaise: number;
  payingCustomers: number;
  successfulPurchases: number;
  abandonedCheckouts: number;
  checkoutUsers: number;
  checkoutConversionPercent: number | null;
  revenueByPlan: FleetMonetizationAnalytics["revenueByPlan"];
  recentPurchases: FleetVipPurchase[];
};
