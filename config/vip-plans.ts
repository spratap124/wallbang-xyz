import "server-only";

import { durationMetas } from "@/lib/payments/vip-pricing";

export {
  buildAllRetakesDurationOptions,
  buildServerDurationOptions,
  buildVipShopQuote,
  durationMetas,
  getVipDurationMeta,
  getVipShopCatalog,
  isVipAccessType,
  isVipPlanId,
  quoteVipOrder,
  readPricingEnv,
  resolveVipEntitledServerIds,
} from "@/lib/payments/vip-pricing";

export type {
  VipAccessType,
  VipDurationMeta,
  VipDurationOption,
  VipPlanId,
  VipPricingByPlan,
  VipQuote,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
} from "@/types/vip";

export { formatInrFromPaise } from "@/lib/payments/format";

/** @deprecated Use getVipDurationMeta */
export function getVipDuration(id: string) {
  return durationMetas().find((item) => item.id === id) ?? null;
}
