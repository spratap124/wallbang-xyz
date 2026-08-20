import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEntitlementsFromHistory,
  computeEntitlementExpiry,
  durationDaysToCoverUntil,
  furthestEntitlementExpiry,
  hasActiveVipEntitlementForServer,
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
