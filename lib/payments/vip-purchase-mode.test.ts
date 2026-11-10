import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getVipPurchaseMode } from "@/lib/payments/vip-purchase-mode";

describe("VIP purchase mode", () => {
  it("keeps online checkout when FEATURE_VIP_CHECKOUT is enabled", () => {
    assert.equal(getVipPurchaseMode(true), "online");
  });

  it("switches to Discord purchase when FEATURE_VIP_CHECKOUT is disabled", () => {
    assert.equal(getVipPurchaseMode(false), "discord");
  });
});
