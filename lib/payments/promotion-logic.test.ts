import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPromotionActiveAt, mergeDefined, promotionPrice, rangesOverlap } from "./promotion-logic";
import type { VipPromotionDoc } from "@/types/vip";

const startsAt = new Date("2026-11-09T00:00:00.000Z");
const endsAt = new Date("2026-11-16T00:00:00.000Z");
const offer: VipPromotionDoc = {
  _id: "offer1", id: "offer1", name: "Test offer", description: null, enabled: true,
  startsAt, endsAt, createdAt: startsAt, updatedAt: startsAt,
  targets: [
    { targetType: "server", targetId: "server-a", pricingByPlan: { "1_month": 7900, "3_months": 27900, "6_months": 54900, "1_year": 99900 } },
    { targetType: "bundle", targetId: "bundle-a", pricingByPlan: { "1_month": 12900, "3_months": 33900, "6_months": 63900, "1_year": 119900 } },
  ],
};

describe("VIP promotion lifecycle and targeting", () => {
  it("does not apply before start, activates at start, and expires exactly at end", () => {
    assert.equal(isPromotionActiveAt(offer, new Date(startsAt.getTime() - 1)), false);
    assert.equal(isPromotionActiveAt(offer, startsAt), true);
    assert.equal(isPromotionActiveAt(offer, new Date(endsAt.getTime() - 1)), true);
    assert.equal(isPromotionActiveAt(offer, endsAt), false);
  });

  it("does not apply when disabled", () => {
    assert.equal(isPromotionActiveAt({ ...offer, enabled: false }, startsAt), false);
  });

  it("resolves target and duration independently", () => {
    assert.equal(promotionPrice({ promotion: offer, targetType: "server", targetId: "server-a", plan: "1_month", basePrice: 9900, now: startsAt }), 7900);
    assert.equal(promotionPrice({ promotion: offer, targetType: "bundle", targetId: "bundle-a", plan: "6_months", basePrice: 79900, now: startsAt }), 63900);
    assert.equal(promotionPrice({ promotion: offer, targetType: "server", targetId: "bundle-a", plan: "1_month", basePrice: 9900, now: startsAt }), null);
    assert.equal(promotionPrice({ promotion: offer, targetType: "bundle", targetId: "bundle-a", plan: "1_month", basePrice: 10000, now: startsAt }), null);
  });

  it("detects half-open schedule overlap", () => {
    assert.equal(rangesOverlap({ startsAt, endsAt }, { startsAt: endsAt, endsAt: new Date(endsAt.getTime() + 1000) }), false);
    assert.equal(rangesOverlap({ startsAt, endsAt }, { startsAt: new Date(startsAt.getTime() + 1000), endsAt }), true);
  });

  it("converts IST wall time to the expected UTC instant", () => {
    assert.equal(new Date("2026-11-09T00:00:00+05:30").toISOString(), "2026-11-08T18:30:00.000Z");
  });

  it("keeps targets and other stored fields for an enable-only PATCH", () => {
    const disabledOffer = { ...offer, enabled: false };
    const updated = mergeDefined(disabledOffer, { enabled: true, targets: undefined });
    assert.equal(updated.enabled, true);
    assert.equal(updated.targets.length, offer.targets.length);
    assert.equal(updated.name, offer.name);
  });
});
