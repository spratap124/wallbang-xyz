import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_RETAKES_ENTITLEMENT_KEY,
  buildEntitlementsFromHistory,
  buildMembershipFromHistory,
  buildGrantedEntitlementRecord,
  computeEntitlementExpiry,
  durationDaysToCoverUntil,
  entitlementKeyFromRecord,
  furthestEntitlementExpiry,
  hasActiveVipEntitlementForServer,
  normalizeAdminEntitlementKeys,
  pickComplimentaryVipPlan,
} from "@/lib/payments/entitlements-logic";
import { computeVipExtension } from "@/lib/payments/expiry";
import type { VipHistoryDoc } from "@/types/payments";

function history(
  partial: Partial<VipHistoryDoc> &
    Pick<VipHistoryDoc, "bundleId" | "durationDays" | "createdAt">,
): VipHistoryDoc {
  return {
    _id: partial._id ?? crypto.randomUUID(),
    userId: partial.userId ?? "user",
    steamId: partial.steamId ?? "steam",
    bundleId: partial.bundleId,
    bundleKind: partial.bundleKind ?? "server",
    bundleName: partial.bundleName ?? null,
    accessType: partial.accessType,
    serverId: partial.serverId ?? null,
    serverIds: partial.serverIds ?? [],
    plan: partial.plan ?? "1_month",
    amount: partial.amount ?? 9900,
    durationDays: partial.durationDays,
    startDate: partial.startDate ?? partial.createdAt,
    endDate: partial.endDate ?? partial.createdAt,
    paymentId: partial.paymentId ?? crypto.randomUUID(),
    createdAt: partial.createdAt,
  };
}

describe("VIP entitlement expiry rules", () => {
  it("1. no prior access → duration from purchase date", () => {
    const purchasedAt = new Date("2026-08-20T10:00:00.000Z");
    const expiry = computeEntitlementExpiry([
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 90,
        createdAt: purchasedAt,
      }),
    ]);

    assert.ok(expiry);
    assert.equal(expiry.toISOString(), "2026-11-18T10:00:00.000Z");
  });

  it("2. same server with remaining time → remaining + new duration", () => {
    // 90d bought Aug 1 → expires Oct 30. On Sep 10, 50d remaining; renew +180.
    const first = new Date("2026-08-01T10:00:00.000Z");
    const renewAt = new Date("2026-09-10T10:00:00.000Z");
    const priorExpiry = computeEntitlementExpiry([
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 90,
        createdAt: first,
      }),
    ]);
    assert.ok(priorExpiry);
    const remainingMs = priorExpiry.getTime() - renewAt.getTime();
    assert.equal(remainingMs, 50 * 86_400_000);

    const stacked = computeVipExtension({
      currentExpiresAt: priorExpiry,
      now: renewAt,
      durationDays: 180,
    });
    // 50 remaining + 180 = 230 days from renew → 2027-04-28
    assert.equal(stacked.endDate.toISOString(), "2027-04-28T10:00:00.000Z");

    const fromHistory = computeEntitlementExpiry([
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 90,
        createdAt: first,
      }),
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 180,
        createdAt: renewAt,
      }),
    ]);
    assert.equal(fromHistory?.toISOString(), stacked.endDate.toISOString());
  });

  it("3. different server → duration from that purchase date only", () => {
    const retake1At = new Date("2026-08-01T10:00:00.000Z");
    const retake2At = new Date("2026-09-10T10:00:00.000Z");
    const historyDocs = [
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 90,
        createdAt: retake1At,
      }),
      history({
        bundleId: "retake-2-mumbai",
        serverId: "retake-2-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 365,
        createdAt: retake2At,
      }),
    ];

    const retake1 = computeEntitlementExpiry(
      historyDocs.filter((r) => r.serverId === "retake-1-mumbai"),
    );
    const retake2 = computeEntitlementExpiry(
      historyDocs.filter((r) => r.serverId === "retake-2-mumbai"),
    );

    assert.equal(retake1?.toISOString(), "2026-10-30T10:00:00.000Z");
    assert.equal(retake2?.toISOString(), "2027-09-10T10:00:00.000Z");
    assert.equal(
      furthestEntitlementExpiry(historyDocs)?.toISOString(),
      "2027-09-10T10:00:00.000Z",
    );
  });

  it("All Retakes covers every server; individual only covers that server", () => {
    const purchasedAt = new Date("2026-08-20T10:00:00.000Z");
    const individual = [
      history({
        bundleId: "retake-1-mumbai",
        serverId: "retake-1-mumbai",
        accessType: "INDIVIDUAL_SERVER",
        durationDays: 90,
        createdAt: purchasedAt,
      }),
    ];
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: individual,
        serverId: "retake-1-mumbai",
        now: purchasedAt,
      }),
      true,
    );
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: individual,
        serverId: "retake-2-mumbai",
        now: purchasedAt,
      }),
      false,
    );

    const bundle = [
      history({
        bundleId: "all_retakes",
        bundleKind: "all",
        accessType: "ALL_RETAKES",
        durationDays: 365,
        createdAt: purchasedAt,
      }),
    ];
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: bundle,
        serverId: "retake-2-mumbai",
        now: purchasedAt,
      }),
      true,
    );
  });
});

describe("buildEntitlementsFromHistory", () => {
  it("shows independent expiries per individual server", () => {
    const purchasedAt = new Date("2026-08-20T10:01:32.179Z");
    const entitlements = buildEntitlementsFromHistory({
      history: [
        history({
          bundleId: "retake-1-mumbai",
          serverId: "retake-1-mumbai",
          accessType: "INDIVIDUAL_SERVER",
          durationDays: 90,
          createdAt: purchasedAt,
        }),
        history({
          bundleId: "retake-2-mumbai",
          serverId: "retake-2-mumbai",
          accessType: "INDIVIDUAL_SERVER",
          durationDays: 180,
          createdAt: purchasedAt,
        }),
      ],
      lifetime: false,
      overallExpiresAt: new Date("2027-05-17T10:01:32.179Z"),
      eligibleServers: [
        {
          id: "retake-1-mumbai",
          shortName: "Retake #1 Mumbai",
          name: "Retake #1 Mumbai",
        },
        {
          id: "retake-2-mumbai",
          shortName: "Retake #2 Mumbai",
          name: "Retake #2 Mumbai",
        },
      ],
      now: purchasedAt,
    });

    assert.equal(entitlements.length, 2);
    const one = entitlements.find(
      (item) =>
        item.kind === "individual" && item.serverId === "retake-1-mumbai",
    );
    const two = entitlements.find(
      (item) =>
        item.kind === "individual" && item.serverId === "retake-2-mumbai",
    );
    assert.ok(one && one.kind === "individual");
    assert.ok(two && two.kind === "individual");
    assert.equal(one.expiresAt, "2026-11-18T10:01:32.179Z");
    assert.equal(two.expiresAt, "2027-02-16T10:01:32.179Z");
  });
});

describe("complimentary VIP coverage days", () => {
  it("uses remaining days when there is no prior entitlement", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    const coversUntil = new Date("2026-11-18T10:00:00.000Z");
    assert.equal(
      durationDaysToCoverUntil({ currentExpiry: null, coversUntil, now }),
      90,
    );
    assert.equal(pickComplimentaryVipPlan(90), "3_months");
  });

  it("skips when individual entitlement already covers the VIP expiry", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    assert.equal(
      durationDaysToCoverUntil({
        currentExpiry: new Date("2026-11-18T10:00:00.000Z"),
        coversUntil: new Date("2026-11-18T10:00:00.000Z"),
        now,
      }),
      null,
    );
  });

  it("only adds the gap when extending a shorter entitlement", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    const currentExpiry = new Date("2026-09-19T10:00:00.000Z");
    const coversUntil = new Date("2026-11-18T10:00:00.000Z");
    assert.equal(
      durationDaysToCoverUntil({ currentExpiry, coversUntil, now }),
      60,
    );
  });
});

describe("admin-granted entitlements", () => {
  const base = {
    id: "row",
    userId: "user",
    steamId: "steam",
    paymentId: "admin-grant:1",
    now: new Date("2026-08-20T10:00:00.000Z"),
  };

  it("grants a single server and keys to that server id", () => {
    const record = buildGrantedEntitlementRecord({
      ...base,
      entitlementKey: "retake-2-mumbai",
      durationDays: 30,
      currentExpiry: null,
    });

    assert.equal(record.accessType, "INDIVIDUAL_SERVER");
    assert.equal(record.serverId, "retake-2-mumbai");
    assert.deepEqual(record.serverIds, ["retake-2-mumbai"]);
    assert.equal(entitlementKeyFromRecord(record), "retake-2-mumbai");
    assert.equal(record.endDate.toISOString(), "2026-09-19T10:00:00.000Z");
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: [record],
        serverId: "retake-2-mumbai",
        now: base.now,
      }),
      true,
    );
  });

  it("grants all servers as the All Retakes bundle", () => {
    const record = buildGrantedEntitlementRecord({
      ...base,
      entitlementKey: ALL_RETAKES_ENTITLEMENT_KEY,
      durationDays: 365,
      currentExpiry: null,
    });

    assert.equal(record.accessType, "ALL_RETAKES");
    assert.equal(record.serverId, null);
    assert.deepEqual(record.serverIds, []);
    assert.equal(entitlementKeyFromRecord(record), ALL_RETAKES_ENTITLEMENT_KEY);
    assert.equal(record.plan, "1_year");
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: [record],
        serverId: "any-server",
        now: base.now,
      }),
      true,
    );
  });

  it("stacks onto remaining time on the same server", () => {
    const record = buildGrantedEntitlementRecord({
      ...base,
      entitlementKey: "retake-1-mumbai",
      durationDays: 30,
      currentExpiry: new Date("2026-09-19T10:00:00.000Z"),
    });

    assert.equal(record.startDate.toISOString(), "2026-09-19T10:00:00.000Z");
    assert.equal(record.endDate.toISOString(), "2026-10-19T10:00:00.000Z");
  });

  it("starts from now when the previous term already lapsed", () => {
    const record = buildGrantedEntitlementRecord({
      ...base,
      entitlementKey: "retake-1-mumbai",
      durationDays: 30,
      currentExpiry: new Date("2026-07-01T10:00:00.000Z"),
    });

    assert.equal(record.startDate.toISOString(), base.now.toISOString());
    assert.equal(record.endDate.toISOString(), "2026-09-19T10:00:00.000Z");
  });

  it("keeps per-server grants independent of each other", () => {
    const first = buildGrantedEntitlementRecord({
      ...base,
      id: "a",
      entitlementKey: "retake-1-mumbai",
      durationDays: 30,
      currentExpiry: null,
    });
    const second = buildGrantedEntitlementRecord({
      ...base,
      id: "b",
      entitlementKey: "retake-2-mumbai",
      durationDays: 90,
      currentExpiry: null,
    });

    const firstExpiry = computeEntitlementExpiry([first]);
    const secondExpiry = computeEntitlementExpiry([second]);
    assert.ok(firstExpiry);
    assert.ok(secondExpiry);
    assert.equal(firstExpiry.toISOString(), "2026-09-19T10:00:00.000Z");
    assert.equal(secondExpiry.toISOString(), "2026-11-18T10:00:00.000Z");
    assert.equal(
      furthestEntitlementExpiry([first, second])?.toISOString(),
      "2026-11-18T10:00:00.000Z",
    );
    assert.equal(
      hasActiveVipEntitlementForServer({
        history: [first, second],
        serverId: "retake-3-mumbai",
        now: base.now,
      }),
      false,
    );
  });

  it("collapses All servers so it is never stacked with individual ids", () => {
    const normalized = normalizeAdminEntitlementKeys(
      ["retake-1-mumbai", ALL_RETAKES_ENTITLEMENT_KEY, "retake-1-mumbai"],
      ["retake-1-mumbai", "retake-2-mumbai"],
    );
    assert.deepEqual(normalized.keys, [ALL_RETAKES_ENTITLEMENT_KEY]);
    assert.deepEqual(normalized.unknown, []);
  });

  it("rejects unknown server ids", () => {
    const normalized = normalizeAdminEntitlementKeys(
      ["retake-9-nowhere"],
      ["retake-1-mumbai"],
    );
    assert.deepEqual(normalized.unknown, ["retake-9-nowhere"]);
  });
});

describe("bundle-aware membership view", () => {
  const SERVERS = [
    { id: "retake-1-mumbai", shortName: "Retake #1 Mumbai", name: "Retake #1 Mumbai" },
    { id: "retake-2-mumbai", shortName: "Retake #2 Mumbai", name: "Retake #2 Mumbai" },
  ];
  const NOW = new Date("2026-10-13T00:00:00.000Z");
  const days = (n: number) => n * 24 * 60 * 60 * 1000;

  function bundlePurchase(expiresInDays: number, label = "Mumbai Starter") {
    return history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-starter",
      bundleName: label,
      serverIds: SERVERS.map((server) => server.id),
      durationDays: 5 + expiresInDays,
      createdAt: new Date(NOW.getTime() - days(5)),
      endDate: new Date(NOW.getTime() + days(expiresInDays)),
    });
  }

  function individualPurchase(serverId: string, expiresInDays: number) {
    return history({
      accessType: "INDIVIDUAL_SERVER",
      bundleKind: "server",
      bundleId: serverId,
      serverId,
      serverIds: [serverId],
      durationDays: 10 + expiresInDays,
      createdAt: new Date(NOW.getTime() - days(10)),
      endDate: new Date(NOW.getTime() + days(expiresInDays)),
    });
  }

  const build = (records: VipHistoryDoc[]) =>
    buildMembershipFromHistory({
      history: records,
      lifetime: false,
      overallExpiresAt: null,
      eligibleServers: SERVERS,
      now: NOW,
    });

  it("bundle only → one bundle card with its servers, no individual rows", () => {
    const { entitlements, purchaseHistory } = build([bundlePurchase(120)]);
    assert.equal(entitlements.length, 1);
    const bundle = entitlements[0]!;
    assert.equal(bundle.kind, "bundle");
    assert.equal(bundle.kind === "bundle" && bundle.label, "Mumbai Starter");
    assert.equal(
      bundle.kind === "bundle" && bundle.includedServers.length,
      2,
      "lists both included servers",
    );
    assert.equal(purchaseHistory.length, 0);
  });

  it("individual + longer bundle → bundle only, purchase kept in history", () => {
    const { entitlements, purchaseHistory } = build([
      individualPurchase("retake-1-mumbai", 30),
      bundlePurchase(120),
    ]);
    assert.equal(entitlements.length, 1, "no duplicate individual row");
    assert.equal(entitlements[0]!.kind, "bundle");
    assert.equal(purchaseHistory.length, 1);
    assert.equal(purchaseHistory[0]!.coveredByBundle, true);
    assert.equal(purchaseHistory[0]!.serverId, "retake-1-mumbai");
  });

  it("bundle expires but individual VIP remains active → individual row survives", () => {
    const { entitlements } = build([
      individualPurchase("retake-1-mumbai", 200),
      bundlePurchase(30),
    ]);
    const bundle = entitlements.find((item) => item.kind === "bundle");
    const individual = entitlements.find((item) => item.kind === "individual");
    assert.ok(bundle, "bundle card kept");
    assert.ok(individual, "individual access still shown");
    assert.equal(
      individual?.kind === "individual" && individual.serverId,
      "retake-1-mumbai",
    );
  });

  it("never shortens valid purchased time (individual outlasts bundle)", () => {
    const { entitlements } = build([
      individualPurchase("retake-2-mumbai", 400),
      bundlePurchase(60),
    ]);
    const individual = entitlements.find(
      (item) => item.kind === "individual" && item.serverId === "retake-2-mumbai",
    );
    assert.ok(individual);
    const expiry = new Date(
      individual?.kind === "individual" ? individual.expiresAt! : 0,
    );
    assert.ok(
      expiry.getTime() > NOW.getTime() + 399 * 24 * 60 * 60 * 1000,
      "expiry reflects the individual purchase, not the shorter bundle",
    );
  });

  it("bundle covers one server while another is bought individually", () => {
    const { entitlements } = build([
      history({
        accessType: "BUNDLE",
        bundleKind: "custom",
        bundleId: "solo-bundle",
        serverIds: ["retake-1-mumbai"],
        durationDays: 92,
        createdAt: new Date(NOW.getTime() - days(2)),
        endDate: new Date(NOW.getTime() + days(90)),
      }),
      individualPurchase("retake-2-mumbai", 60),
    ]);
    const bundles = entitlements.filter((item) => item.kind === "bundle");
    const individuals = entitlements.filter((item) => item.kind === "individual");
    assert.equal(bundles.length, 1);
    assert.equal(individuals.length, 1);
    assert.equal(
      individuals[0]?.kind === "individual" && individuals[0].serverId,
      "retake-2-mumbai",
    );
  });
});
