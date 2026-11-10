export type VipPurchaseMode = "online" | "discord";

export function getVipPurchaseMode(checkoutEnabled: boolean): VipPurchaseMode {
  return checkoutEnabled ? "online" : "discord";
}
