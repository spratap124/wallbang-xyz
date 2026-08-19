/**
 * Client-safe VIP quote. Server checkout must re-run this with the catalog.
 * Total is per-server × count, capped at the all-servers fleet price.
 */
import type { VipDuration, VipPlanId, VipQuote } from "@/types/vip";

export function quoteVipSelection(input: {
  selectedServerIds: string[];
  liveServerIds: string[];
  duration: VipDuration;
}): VipQuote {
  const live = new Set(input.liveServerIds);
  const serverIds = [...new Set(input.selectedServerIds)]
    .filter((id) => live.has(id))
    .sort();
  const serverCount = serverIds.length;
  const stacked = input.duration.perServerPaise * serverCount;
  const amountPaise =
    serverCount === 0
      ? 0
      : Math.min(stacked, input.duration.allServersPaise);
  const fleetRate =
    serverCount > 0 && amountPaise === input.duration.allServersPaise;

  return {
    amountPaise,
    serverCount,
    fleetRate,
    durationId: input.duration.id,
    durationDays: input.duration.durationDays,
    serverIds,
  };
}

export function isVipPlanId(value: string): value is VipPlanId {
  return (
    value === "1_month" ||
    value === "3_months" ||
    value === "6_months" ||
    value === "1_year"
  );
}
