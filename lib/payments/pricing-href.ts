import type { VipAccessType } from "@/types/vip";

export function pricingCheckoutHref(input?: {
  accessType?: VipAccessType;
  serverId?: string | null;
}): string {
  if (!input?.accessType && !input?.serverId) return "/pricing";
  const params = new URLSearchParams();
  if (input.accessType) params.set("access", input.accessType);
  if (input.serverId) params.set("serverId", input.serverId);
  return `/pricing?${params.toString()}`;
}
