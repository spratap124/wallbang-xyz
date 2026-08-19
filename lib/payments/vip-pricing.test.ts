import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAllRetakesDurationOptions,
  buildServerDurationOptions,
  buildVipShopQuote,
  quoteVipOrder,
  readPricingEnv,
  resolveVipEntitledServerIds,
} from "./vip-pricing";
import type { VipPricingServer } from "./vip-pricing";

const testEnv = readPricingEnv({
  VIP_SERVER_PRICE_1M_PAISE: "9900",
  VIP_SERVER_PRICE_3M_PAISE: "27900",
  VIP_SERVER_PRICE_6M_PAISE: "54900",
  VIP_SERVER_PRICE_1Y_PAISE: "99900",
  VIP_ALL_RETAKES_1M_PAISE: "14900",
  VIP_ALL_RETAKES_3M_PAISE: "39900",
  VIP_ALL_RETAKES_6M_PAISE: "79900",
  VIP_ALL_RETAKES_1Y_PAISE: "169900",
});

const serverA: VipPricingServer = {
  id: "retake-1-mumbai",
  name: "Retake #1 Mumbai",
  shortName: "Retake Mumbai #1",
  mode: "Retakes",
  city: "Mumbai",
  region: "Mumbai, India",
  map: "de_mirage",
  maxPlayers: 10,
  pingMs: 0,
  status: "live",
  vipPricingByPlan: {
    "1_month": 9_900,
    "3_months": 27_900,
    "6_months": 54_900,
    "1_year": 99_900,
  },
};

const serverB: VipPricingServer = {
  ...serverA,
  id: "retake-2-mumbai",
  name: "Retake #2 Mumbai",
  shortName: "Retake Mumbai #2",
  vipPricingByPlan: {
    "1_month": 10_900,
    "3_months": 29_900,
    "6_months": 59_900,
    "1_year": 109_900,
  },
};

describe("individual server pricing", () => {
  it("uses configured 1-month price", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      planId: "1_month",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 9_900);
  });

  it("uses configured 3-month price", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      planId: "3_months",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 27_900);
  });

  it("uses configured 6-month price", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      planId: "6_months",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 54_900);
  });

  it("uses configured 1-year price", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      planId: "1_year",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 99_900);
  });

  it("supports different prices per server", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverB.id,
      planId: "1_month",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 10_900);
  });

  it("updates displayed pricing when selected server changes", () => {
    const first = buildVipShopQuote({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      servers: [serverA, serverB],
      env: testEnv,
    });
    const second = buildVipShopQuote({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverB.id,
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.notEqual(
      first.durations[0]?.amountPaise,
      second.durations[0]?.amountPaise,
    );
  });

  it("quotes exactly one server", () => {
    const quote = quoteVipOrder({
      accessType: "INDIVIDUAL_SERVER",
      serverId: serverA.id,
      planId: "1_month",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.serverId, serverA.id);
    assert.equal(quote.bundleKind, "server");
  });
});

describe("all retakes pricing", () => {
  it("charges ₹149 for 1 month", () => {
    const quote = quoteVipOrder({
      accessType: "ALL_RETAKES",
      planId: "1_month",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 14_900);
  });

  it("charges ₹399 for 3 months", () => {
    const quote = quoteVipOrder({
      accessType: "ALL_RETAKES",
      planId: "3_months",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 39_900);
  });

  it("charges ₹799 for 6 months", () => {
    const quote = quoteVipOrder({
      accessType: "ALL_RETAKES",
      planId: "6_months",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 79_900);
  });

  it("charges ₹1,699 for 1 year", () => {
    const quote = quoteVipOrder({
      accessType: "ALL_RETAKES",
      planId: "1_year",
      servers: [serverA, serverB],
      env: testEnv,
    });
    assert.equal(quote.amountPaise, 169_900);
  });
});

describe("validation and entitlements", () => {
  it("requires serverId for individual purchases", () => {
    assert.throws(() =>
      quoteVipOrder({
        accessType: "INDIVIDUAL_SERVER",
        planId: "1_month",
        servers: [serverA],
        env: testEnv,
      }),
    );
  });

  it("rejects serverId for all retakes purchases", () => {
    assert.throws(() =>
      quoteVipOrder({
        accessType: "ALL_RETAKES",
        serverId: serverA.id,
        planId: "1_month",
        servers: [serverA],
        env: testEnv,
      }),
    );
  });

  it("rejects unknown server ids", () => {
    assert.throws(() =>
      quoteVipOrder({
        accessType: "INDIVIDUAL_SERVER",
        serverId: "missing-server",
        planId: "1_month",
        servers: [serverA],
        env: testEnv,
      }),
    );
  });

  it("rejects unknown durations", () => {
    assert.throws(() =>
      quoteVipOrder({
        accessType: "ALL_RETAKES",
        planId: "2_months",
        servers: [serverA],
        env: testEnv,
      }),
    );
  });

  it("resolves individual entitlement to one server", () => {
    const entitled = resolveVipEntitledServerIds({
      accessType: "INDIVIDUAL_SERVER",
      bundleKind: "server",
      bundleId: serverA.id,
      serverId: serverA.id,
      serverIds: [serverA.id],
      eligibleServerIds: [serverA.id, serverB.id],
    });
    assert.deepEqual(entitled, [serverA.id]);
  });

  it("resolves all retakes entitlement to all eligible servers", () => {
    const entitled = resolveVipEntitledServerIds({
      accessType: "ALL_RETAKES",
      bundleKind: "all",
      bundleId: "all_retakes",
      serverId: null,
      serverIds: [],
      eligibleServerIds: [serverA.id, serverB.id, "retake-3-mumbai"],
    });
    assert.equal(entitled, "all");
  });

  it("keeps legacy multi-server purchases readable", () => {
    const entitled = resolveVipEntitledServerIds({
      bundleKind: "server",
      bundleId: `${serverA.id}+${serverB.id}`,
      serverId: null,
      serverIds: [serverA.id, serverB.id],
      eligibleServerIds: [serverA.id, serverB.id],
    });
    assert.deepEqual(entitled, [serverA.id, serverB.id]);
  });

  it("builds per-server duration cards from configured pricing", () => {
    const options = buildServerDurationOptions(serverB, testEnv);
    assert.equal(options[0]?.amountPaise, 10_900);
    assert.equal(options[3]?.amountPaise, 109_900);
  });

  it("builds all retakes duration cards from global pricing", () => {
    const options = buildAllRetakesDurationOptions(testEnv);
    assert.equal(options[0]?.amountPaise, 14_900);
    assert.equal(options[3]?.amountPaise, 169_900);
  });
});
