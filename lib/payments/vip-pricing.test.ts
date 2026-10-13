import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildServerDurationOptions,
  buildVipShopQuote,
  getVipShopCatalog,
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

  it("uses admin server prices instead of env defaults", () => {
    const catalog = getVipShopCatalog(
      [
        {
          id: serverA.id,
          name: serverA.name,
          shortName: serverA.shortName,
          mode: serverA.mode,
          city: serverA.city,
          region: serverA.region,
          map: serverA.map,
          maxPlayers: serverA.maxPlayers,
          pingMs: serverA.pingMs,
          status: serverA.status,
          vipPricingByPlan: {
            "1_month": 12_000,
            "3_months": 33_900,
            "6_months": 64_900,
            "1_year": 119_900,
          },
        },
      ],
      { env: testEnv },
    );
    const plans = catalog.servers[0]?.durationOptions ?? [];
    assert.deepEqual(
      plans.map((plan) => plan.amountPaise),
      [12_000, 33_900, 64_900, 119_900],
    );
    assert.notEqual(
      plans[0]?.amountPaise,
      testEnv.individualDefaultPaise["1_month"],
    );
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
        accessType: "INDIVIDUAL_SERVER",
        serverId: serverA.id,
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

});

describe("custom server bundles", () => {
  const bundle = {
    id: "mumbai-starter",
    name: "Mumbai Starter",
    serverIds: [serverA.id, serverB.id],
    pricingByPlan: {
      "1_month": 15_900,
      "3_months": 41_900,
      "6_months": 79_900,
      "1_year": 149_900,
    },
    enabled: true,
  };

  it("prices every duration from the bundle, not the individual servers", () => {
    const quote = quoteVipOrder({
      accessType: "BUNDLE",
      bundleId: bundle.id,
      planId: "3_months",
      servers: [serverA, serverB],
      bundles: [bundle],
      env: testEnv,
    });
    assert.equal(quote.accessType, "BUNDLE");
    assert.equal(quote.amountPaise, 41_900);
    assert.equal(quote.durationId, "3_months");
    assert.equal(quote.bundleKind, "custom");
    assert.equal(quote.bundleId, "mumbai-starter");
    assert.equal(quote.serverId, null);
    assert.deepEqual(quote.serverIds, ["retake-1-mumbai", "retake-2-mumbai"]);
  });

  it("ignores bundle servers that no longer exist", () => {
    const quote = quoteVipOrder({
      accessType: "BUNDLE",
      bundleId: bundle.id,
      planId: "1_month",
      servers: [serverA],
      bundles: [bundle],
      env: testEnv,
    });
    assert.deepEqual(quote.serverIds, ["retake-1-mumbai"]);
  });

  it("refuses unknown, disabled, or server-less bundles", () => {
    assert.throws(
      () =>
        quoteVipOrder({
          accessType: "BUNDLE",
          bundleId: "nope",
          planId: "1_month",
          servers: [serverA],
          bundles: [bundle],
          env: testEnv,
        }),
      /Unknown bundle/,
    );
    assert.throws(
      () =>
        quoteVipOrder({
          accessType: "BUNDLE",
          bundleId: bundle.id,
          planId: "1_month",
          servers: [serverA],
          bundles: [{ ...bundle, enabled: false }],
          env: testEnv,
        }),
      /not available/,
    );
    assert.throws(
      () =>
        quoteVipOrder({
          accessType: "BUNDLE",
          bundleId: bundle.id,
          planId: "1_month",
          servers: [serverB],
          bundles: [{ ...bundle, serverIds: [serverA.id] }],
          env: testEnv,
        }),
      /no available servers/,
    );
  });

  it("quotes bundle durations in the shop", () => {
    const quote = buildVipShopQuote({
      accessType: "BUNDLE",
      bundleId: bundle.id,
      servers: [serverA, serverB],
      bundles: [bundle],
      env: testEnv,
    });
    assert.equal(quote.accessType, "BUNDLE");
    assert.equal(quote.bundleId, "mumbai-starter");
    assert.deepEqual(
      quote.durations.map((plan) => plan.amountPaise),
      [15_900, 41_900, 79_900, 149_900],
    );
  });

  it("exposes enabled bundles in the catalog with their servers", () => {
    const catalog = getVipShopCatalog(
      [
        {
          id: serverA.id,
          name: serverA.name,
          shortName: serverA.shortName,
          mode: serverA.mode,
          city: serverA.city,
          region: serverA.region,
          map: serverA.map,
          maxPlayers: serverA.maxPlayers,
          pingMs: serverA.pingMs,
          status: serverA.status,
        },
        {
          id: serverB.id,
          name: serverB.name,
          shortName: serverB.shortName,
          mode: serverB.mode,
          city: serverB.city,
          region: serverB.region,
          map: serverB.map,
          maxPlayers: serverB.maxPlayers,
          pingMs: serverB.pingMs,
          status: serverB.status,
        },
      ],
      { bundles: [bundle, { ...bundle, id: "off", enabled: false }], env: testEnv },
    );
    assert.equal(catalog.bundles.length, 1, "disabled bundles are hidden");
    assert.deepEqual(catalog.bundles[0]?.serverIds, [serverA.id, serverB.id]);
    assert.equal(catalog.bundles[0]?.servers.length, 2);
    assert.equal(catalog.bundles[0]?.durations.length, 4);
  });

  it("grants VIP on exactly the bundle's servers", () => {
    const entitled = resolveVipEntitledServerIds({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-starter",
      serverId: null,
      serverIds: [serverA.id, serverB.id, "retake-gone"],
      eligibleServerIds: [serverA.id, serverB.id],
    });
    assert.deepEqual(entitled, ["retake-1-mumbai", "retake-2-mumbai"]);
  });
});
