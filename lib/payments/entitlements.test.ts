import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_RETAKES_ENTITLEMENT_KEY,
  buildEntitlementsFromHistory,
  buildAdminVipEntitlementRows,
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
import type { VipBundleEntitlement } from "@/types/vip";

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

  const build = (
    records: VipHistoryDoc[],
    bundleLabels?: Record<string, string>,
  ) =>
    buildMembershipFromHistory({
      history: records,
      lifetime: false,
      overallExpiresAt: null,
      eligibleServers: SERVERS,
      bundleLabels,
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
    assert.equal(purchaseHistory.length, 1, "bundle purchase is recorded");
    assert.equal(purchaseHistory[0]!.kind, "bundle");
    assert.equal(purchaseHistory[0]!.label, "Mumbai Starter");
  });

  it("individual + longer bundle → bundle only, purchase kept in history", () => {
    const { entitlements, purchaseHistory } = build([
      individualPurchase("retake-1-mumbai", 30),
      bundlePurchase(120),
    ]);
    assert.equal(entitlements.length, 1, "no duplicate individual row");
    assert.equal(entitlements[0]!.kind, "bundle");
    assert.equal(purchaseHistory.length, 2, "bundle + individual purchase rows");
    const individual = purchaseHistory.find((row) => row.kind === "individual");
    assert.ok(individual, "individual purchase kept in history");
    assert.equal(individual!.status, "covered");
    assert.deepEqual(individual!.serverIds, ["retake-1-mumbai"]);
    assert.equal(individual!.label, "Individual Server Access");
    assert.equal(individual!.planName, "1 Month");
    assert.ok(
      purchaseHistory.some((row) => row.kind === "bundle"),
      "bundle purchase kept in history",
    );
  });

  it("bundle expires while individual VIP remains active → individual access shown", () => {
    const expiredBundle = history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-starter",
      bundleName: "Mumbai Starter",
      serverIds: SERVERS.map((server) => server.id),
      durationDays: 30,
      createdAt: new Date(NOW.getTime() - days(120)), // expired 90 days ago
      endDate: new Date(NOW.getTime() - days(90)),
    });
    const { entitlements } = build([
      individualPurchase("retake-1-mumbai", 200),
      expiredBundle,
    ]);
    assert.equal(
      entitlements.filter((item) => item.kind === "bundle").length,
      0,
      "expired bundle is not shown as active",
    );
    const individual = entitlements.find((item) => item.kind === "individual");
    assert.ok(individual, "individual access survives the bundle");
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
    const bundle = entitlements.find(
      (item): item is VipBundleEntitlement => item.kind === "bundle",
    );
    assert.ok(bundle);
    const server = bundle.includedServers.find(
      (entry) => entry.id === "retake-2-mumbai",
    );
    assert.ok(server, "covered server listed once on the bundle card");
    const expiry = new Date(server!.expiresAt!);
    assert.ok(
      expiry.getTime() > NOW.getTime() + 399 * 24 * 60 * 60 * 1000,
      "effective access reflects the individual purchase, not the shorter bundle",
    );
    assert.equal(
      entitlements.filter((item) => item.kind === "individual").length,
      0,
      "no duplicate row for the same server",
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

describe("bundle labels", () => {
  const SERVERS = [
    { id: "retake-1-mumbai", shortName: "Retake #1 Mumbai", name: "Retake #1 Mumbai" },
  ];
  const NOW = new Date("2026-10-13T00:00:00.000Z");

  function legacyBundlePurchase(overrides: Record<string, unknown> = {}) {
    return history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-retake-bundle-all",
      serverIds: ["retake-1-mumbai"],
      durationDays: 95,
      createdAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
      ...overrides,
    });
  }

  it("falls back to the current bundle name when no snapshot exists", () => {
    const { entitlements } = buildMembershipFromHistory({
      history: [legacyBundlePurchase()],
      lifetime: false,
      overallExpiresAt: null,
      eligibleServers: SERVERS,
      bundleLabels: { "mumbai-retake-bundle-all": "Mumbai Retake Bundle All" },
      now: NOW,
    });
    assert.equal(entitlements[0]?.kind === "bundle" && entitlements[0].label, "Mumbai Retake Bundle All");
  });

  it("prefers the purchase-time snapshot over the current name", () => {
    const { entitlements } = buildMembershipFromHistory({
      history: [legacyBundlePurchase({ bundleName: "Original Name" })],
      lifetime: false,
      overallExpiresAt: null,
      eligibleServers: SERVERS,
      bundleLabels: { "mumbai-retake-bundle-all": "Renamed Later" },
      now: NOW,
    });
    assert.equal(entitlements[0]?.kind === "bundle" && entitlements[0].label, "Original Name");
  });

  it("falls back to the id when the bundle was deleted", () => {
    const { entitlements } = buildMembershipFromHistory({
      history: [legacyBundlePurchase()],
      lifetime: false,
      overallExpiresAt: null,
      eligibleServers: SERVERS,
      now: NOW,
    });
    assert.equal(
      entitlements[0]?.kind === "bundle" && entitlements[0].label,
      "mumbai-retake-bundle-all",
    );
  });
});

describe("VIP access matrix", () => {
  const SERVERS = [
    { id: "retake-1-mumbai", shortName: "Retake #1 Mumbai", name: "Retake #1 Mumbai" },
    { id: "retake-2-mumbai", shortName: "Retake #2 Mumbai", name: "Retake #2 Mumbai" },
  ];
  const NOW = new Date("2026-10-13T00:00:00.000Z");
  const days = (n: number) => n * 24 * 60 * 60 * 1000;
  const purchased = (daysAgo: number) => new Date(NOW.getTime() - days(daysAgo));

  function individual(serverId: string, daysAgo: number, termDays: number) {
    return history({
      accessType: "INDIVIDUAL_SERVER",
      bundleKind: "server",
      bundleId: serverId,
      serverId,
      serverIds: [serverId],
      plan: "1_month",
      amount: 9900,
      durationDays: termDays,
      createdAt: purchased(daysAgo),
    });
  }

  function bundle(daysAgo: number, termDays: number, label = "Mumbai Bundle") {
    return history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-bundle",
      bundleName: label,
      serverIds: SERVERS.map((server) => server.id),
      plan: "3_months",
      amount: 39900,
      durationDays: termDays,
      createdAt: purchased(daysAgo),
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

  it("individual purchase for Retake #1 only", () => {
    const { entitlements } = build([individual("retake-1-mumbai", 5, 60)]);
    assert.equal(entitlements.length, 1);
    assert.equal(
      entitlements[0]!.kind === "individual" && entitlements[0]!.serverId,
      "retake-1-mumbai",
    );
  });

  it("individual purchases for both servers stay separate", () => {
    const { entitlements } = build([
      individual("retake-1-mumbai", 5, 60),
      individual("retake-2-mumbai", 4, 60),
    ]);
    assert.equal(entitlements.length, 2);
    const ids = entitlements
      .filter((item) => item.kind === "individual")
      .map((item) => (item.kind === "individual" ? item.serverId : ""))
      .sort();
    assert.deepEqual(ids, ["retake-1-mumbai", "retake-2-mumbai"]);
  });

  it("bundle purchase followed by an individual purchase (order independent)", () => {
    const { entitlements, purchaseHistory } = build([
      bundle(30, 120),
      individual("retake-2-mumbai", 2, 10),
    ]);
    const bundles = entitlements.filter((item) => item.kind === "bundle");
    assert.equal(bundles.length, 1, "one bundle card");
    assert.equal(
      entitlements.filter((item) => item.kind === "individual").length,
      0,
      "no duplicate server rows while the bundle covers longer",
    );
    assert.equal(purchaseHistory.length, 2);
  });

  it("individual expires while the bundle stays active", () => {
    const { entitlements } = build([
      individual("retake-1-mumbai", 40, 30), // expired 10 days ago
      bundle(5, 120),
    ]);
    assert.equal(entitlements.length, 1, "bundle alone is enough");
    assert.equal(entitlements[0]!.kind, "bundle");
  });

  it("all entitlements expired grants nothing", () => {
    const { entitlements } = build([
      individual("retake-1-mumbai", 90, 30),
      bundle(120, 30),
    ]);
    assert.equal(entitlements.length, 0);
  });

  it("renewing a bundle stacks time and keeps a single bundle card", () => {
    const { entitlements } = build([bundle(30, 120), bundle(5, 120)]);
    assert.equal(entitlements.length, 1, "one entitlement per bundle");
    const expiry = new Date(
      entitlements[0]!.kind === "bundle" ? entitlements[0]!.expiresAt! : 0,
    );
    // First purchase: now-120d + 120d = now; second stacks on the remaining end.
    assert.ok(
      expiry.getTime() > NOW.getTime() + days(200),
      "renewal extends rather than resetting",
    );
  });

  it("never lists a server twice when bundle and individual overlap", () => {
    const { entitlements } = build([
      individual("retake-1-mumbai", 5, 300),
      bundle(5, 90),
    ]);
    const serverIds = entitlements.flatMap((item) =>
      item.kind === "individual"
        ? [item.serverId]
        : item.kind === "bundle"
          ? item.includedServers.map((entry) => entry.id)
          : [],
    );
    const seen = new Set<string>();
    for (const id of serverIds) {
      assert.equal(seen.has(id), false, `duplicate server row: ${id}`);
      seen.add(id);
    }
  });
});

describe("admin VIP entitlement rows", () => {
  const SERVERS = [
    { id: "retake-1-mumbai", shortName: "Retake #1 Mumbai", name: "Retake #1 Mumbai" },
    { id: "retake-2-mumbai", shortName: "Retake #2 Mumbai", name: "Retake #2 Mumbai" },
  ];
  const NOW = new Date("2026-10-13T00:00:00.000Z");
  const days = (n: number) => n * 24 * 60 * 60 * 1000;

  it("multi-server purchase reports its real expiry, not 'never expires'", () => {
    const multi = history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "all-retake-servers-mumbai",
      bundleName: "All Retake Servers Mumbai",
      serverIds: ["retake-1-mumbai", "retake-2-mumbai"],
      durationDays: 90,
      createdAt: new Date(NOW.getTime() - days(5)),
    });
    const rows = buildAdminVipEntitlementRows({
      history: [multi],
      eligibleServers: SERVERS,
      now: NOW,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.key, "retake-1-mumbai+retake-2-mumbai");
    assert.equal(rows[0]!.label, "All Retake Servers Mumbai");
    assert.ok(rows[0]!.expiresAt, "expiry is set");
    const expiry = new Date(rows[0]!.expiresAt!);
    assert.ok(
      expiry.getTime() > NOW.getTime() + days(80),
      "expiry matches the purchase term",
    );
  });

  it("falls back to server names when no bundle label was captured", () => {
    const multi = history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-pair",
      serverIds: ["retake-1-mumbai", "retake-2-mumbai"],
      durationDays: 90,
      createdAt: new Date(NOW.getTime() - days(5)),
    });
    const rows = buildAdminVipEntitlementRows({
      history: [multi],
      eligibleServers: SERVERS,
      now: NOW,
    });
    assert.equal(rows[0]!.label, "Retake #1 Mumbai + Retake #2 Mumbai");
  });

  it("uses the bundle's current name when no snapshot and no label is derivable", () => {
    const multi = history({
      accessType: "BUNDLE",
      bundleKind: "custom",
      bundleId: "mumbai-pair",
      serverIds: ["retake-1-mumbai", "retake-2-mumbai"],
      durationDays: 90,
      createdAt: new Date(NOW.getTime() - days(5)),
    });
    const rows = buildAdminVipEntitlementRows({
      history: [multi],
      eligibleServers: SERVERS,
      bundleLabels: { "mumbai-pair": "Mumbai Pair" },
      now: NOW,
    });
    assert.equal(rows[0]!.label, "Mumbai Pair");
  });

  it("drops expired entitlements and keeps single-server labels", () => {
    const expired = history({
      accessType: "INDIVIDUAL_SERVER",
      bundleKind: "server",
      bundleId: "retake-1-mumbai",
      serverId: "retake-1-mumbai",
      serverIds: ["retake-1-mumbai"],
      durationDays: 30,
      createdAt: new Date(NOW.getTime() - days(90)),
    });
    const active = history({
      accessType: "INDIVIDUAL_SERVER",
      bundleKind: "server",
      bundleId: "retake-2-mumbai",
      serverId: "retake-2-mumbai",
      serverIds: ["retake-2-mumbai"],
      durationDays: 90,
      createdAt: new Date(NOW.getTime() - days(5)),
    });
    const rows = buildAdminVipEntitlementRows({
      history: [expired, active],
      eligibleServers: SERVERS,
      now: NOW,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.label, "Retake #2 Mumbai");
    assert.equal(rows[0]!.key, "retake-2-mumbai");
  });
});
