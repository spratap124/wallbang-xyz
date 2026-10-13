import type { VipAccessType } from "@/types/vip";

export function pricingCheckoutHref(input?: {
  accessType?: VipAccessType;
  serverId?: string | null;
  bundleId?: string | null;
}): string {
  if (!input?.accessType && !input?.serverId && !input?.bundleId) {
    return "/pricing";
  }
  const params = new URLSearchParams();
  if (input.accessType) params.set("access", input.accessType);
  if (input.serverId) params.set("serverId", input.serverId);
  if (input.bundleId) params.set("bundle", input.bundleId);
  return `/pricing?${params.toString()}`;
}
