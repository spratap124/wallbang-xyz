import type { VipPlanId, VipPromotionDoc, VipPromotionTargetType } from "@/types/vip";

export function isPromotionActiveAt(promotion: Pick<VipPromotionDoc, "enabled" | "startsAt" | "endsAt">, now: Date): boolean {
  return promotion.enabled && promotion.startsAt.getTime() <= now.getTime() && now.getTime() < promotion.endsAt.getTime();
}

export function rangesOverlap(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/** PATCH semantics: omitted fields must leave the persisted value unchanged. */
export function mergeDefined<T extends object>(current: T, patch: Partial<T>): T {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
  return { ...current, ...defined };
}

export function promotionPrice(input: {
  promotion: VipPromotionDoc;
  targetType: VipPromotionTargetType;
  targetId: string;
  plan: VipPlanId;
  basePrice: number;
  now: Date;
}): number | null {
  if (!isPromotionActiveAt(input.promotion, input.now)) return null;
  const target = input.promotion.targets.find((row) => row.targetType === input.targetType && row.targetId === input.targetId);
  const amount = target?.pricingByPlan[input.plan];
  return Number.isInteger(amount) && amount! > 0 && amount! < input.basePrice ? amount! : null;
}
