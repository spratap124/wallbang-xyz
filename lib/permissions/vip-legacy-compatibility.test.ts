import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminVipGrantRows, computeEntitlementExpiry, furthestEntitlementExpiry, hasActiveVipEntitlementForServer } from "@/lib/payments/entitlements-logic";
import { synchronizeVipRoleWithStore, type VipRoleStore } from "@/lib/permissions/vip-role-service";
import type { VipHistoryDoc } from "@/types/payments";
import type { UserRoleDoc } from "@/types/permissions";
import type { AuditLogDoc } from "@/types/permissions";
import { applyHistoricalRevocationEvidence, historicalRevokedComplimentaryIds } from "@/lib/payments/legacy-vip-evidence";

const servers = ["fixture-retake-a", "fixture-retake-b", "fixture-retake-c"];
function grant(id: string, created: string, end: string, durationDays: number): VipHistoryDoc {
  return {
    _id: id, userId: "fixture-user", steamId: "00000000000000000",
    bundleId: "fixture-bundle", bundleKind: "custom", accessType: "BUNDLE",
    serverId: null, serverIds: servers, plan: "1_month", amount: 0,
    durationDays, startDate: new Date(created), endDate: new Date(end),
    createdAt: new Date(created), source: "ADMIN", status: "ACTIVE",
    paymentId: `complimentary:${id}:fixture-bundle`, grantId: `${id}:fixture-bundle`,
  };
}

test("characterizes legacy revoked lifetime followed by a finite bundle grant", async () => {
  const history = [
    grant("lifetime-revoked-role", "2026-11-08T18:32:12.621Z", "2126-10-15T18:32:12.621Z", 36500),
    grant("finite-role", "2026-11-08T18:32:19.764Z", "2026-12-08T18:32:19.764Z", 30),
  ];
  const assignment: UserRoleDoc = {
    _id: "finite-role", userId: "fixture-user", roleId: "vip", roleCode: "VIP",
    source: "MANUAL", grantedBy: "fixture-admin", grantedAt: new Date("2026-11-08T18:32:19.752Z"),
    expiresAt: new Date("2026-12-08T18:32:19.556Z"), active: true,
  };
  const updates: Partial<UserRoleDoc>[] = [];
  const store: VipRoleStore = {
    async listEntitlements() { return history; },
    async listAssignments() { return [assignment]; },
    async getVipRoleId() { return "vip"; },
    async insertAssignment() { throw new Error("unexpected insert"); },
    async updateAssignment(_id, update) { updates.push(update); },
    async insertAudit() {},
  };

  // Stable main treats all complimentary payment IDs as giveaway-like and
  // selects their earliest stored end, regardless of an explicit ADMIN source.
  const stableMainExpiry = new Date(Math.min(...history.map((row) => row.endDate.getTime())));
  assert.equal(stableMainExpiry.toISOString(), "2026-12-08T18:32:19.764Z");
  const result = await synchronizeVipRoleWithStore({
    userId: "fixture-user", steamId: "00000000000000000", personaName: "Fixture",
    source: "PURCHASE", grantedBy: null, mode: "extend",
  }, store, new Date("2026-11-09T00:00:00Z"));

  assert.equal(result.expiresAt?.toISOString(), "2026-12-08T18:32:19.764Z");
  assert.equal(updates[0]?.expiresAt?.toISOString(), "2026-12-08T18:32:19.764Z");
  const afterFiniteExpiry = new Date("2026-12-09T00:00:00Z");
  assert.equal(stableMainExpiry > afterFiniteExpiry, false);
  assert.equal(hasActiveVipEntitlementForServer({ history, serverId: servers[0]!, now: afterFiniteExpiry }), false);
  assert.equal(history[0]?.status, "ACTIVE");
});

test("uses explicit grant and revocation audit links without inferring paid or ambiguous history", () => {
  const revoked = grant("lifetime-revoked-role", "2026-11-08T18:32:12.621Z", "2126-10-15T18:32:12.621Z", 36500);
  const finite = grant("finite-role", "2026-11-08T18:32:19.764Z", "2026-12-08T18:32:19.764Z", 30);
  const paid = { ...revoked, _id: "paid", paymentId: "online-payment", amount: 5000 };
  const audit = (partial: Partial<AuditLogDoc>): AuditLogDoc => ({
    _id: "audit", adminId: "admin", adminSteamId: null, action: "GRANT_ROLE",
    targetUserId: "fixture-user", targetSteamId: null, targetPersonaName: null,
    oldValue: null, newValue: null, timestamp: new Date("2026-11-08T18:32:12.634Z"),
    ...partial,
  });
  const grantAudit = audit({ newValue: {
    roleCode: "VIP", assignmentId: "lifetime-revoked-role", entitlementKeys: ["fixture-bundle"],
  } });
  const revokeAudit = audit({ action: "REVOKE_ROLE", timestamp: new Date("2026-11-08T18:32:16.702Z"),
    oldValue: { roleCode: "VIP", assignmentId: "lifetime-revoked-role" },
  });
  assert.deepEqual([...historicalRevokedComplimentaryIds([revoked, finite, paid], [grantAudit, revokeAudit])], [revoked._id]);
  assert.equal(historicalRevokedComplimentaryIds([revoked], [revokeAudit]).size, 0);
  assert.equal(historicalRevokedComplimentaryIds([revoked], [grantAudit, grantAudit, revokeAudit]).size, 0);
  assert.equal(historicalRevokedComplimentaryIds([revoked], [grantAudit, {
    ...revokeAudit, oldValue: { ...revokeAudit.oldValue, automaticVipSync: true },
  }]).size, 0);
  assert.equal(historicalRevokedComplimentaryIds([paid], [grantAudit, revokeAudit]).size, 0);
  const ambiguousPaid = { ...revoked, _id: "ambiguous-paid", source: "PURCHASE", amount: 5000 };
  assert.equal(historicalRevokedComplimentaryIds([ambiguousPaid], [grantAudit, revokeAudit]).size, 0);
  assert.equal(applyHistoricalRevocationEvidence([ambiguousPaid], [grantAudit, revokeAudit])[0]?.status, "ACTIVE");
  const projected = applyHistoricalRevocationEvidence([revoked, finite], [grantAudit, revokeAudit]);
  assert.equal(projected[0]?.status, "REVOKED");
  assert.equal(revoked.status, "ACTIVE", "the stored historical row is not mutated");
  assert.equal(computeEntitlementExpiry(projected)?.toISOString(), "2026-12-08T18:32:19.764Z");
  assert.equal(hasActiveVipEntitlementForServer({ history: projected, serverId: servers[0]!, now: new Date("2026-12-09T00:00:00Z") }), false);
  const renewal = { ...grant("renewal", "2026-11-15T00:00:00Z", "2027-01-07T18:32:19.764Z", 30),
    calculationVersion: 2 as const, source: "PURCHASE", paymentId: "new-online-payment",
    startDate: new Date("2026-12-08T18:32:19.764Z") };
  assert.equal(computeEntitlementExpiry([...projected, renewal])?.toISOString(), "2027-01-07T18:32:19.764Z");
  assert.equal(historicalRevokedComplimentaryIds([paid], [grantAudit, revokeAudit]).size, 0);
});

test("legacy complimentary grouping remains stable when a new paid renewal is added", () => {
  const long = grant("old-one", "2026-11-08T18:32:12.621Z", "2126-10-15T18:32:12.621Z", 36500);
  const finite = grant("old-two", "2026-11-08T18:32:19.764Z", "2026-12-08T18:32:19.764Z", 30);
  const renewal = { ...grant("new-paid", "2026-11-15T00:00:00Z", "2027-01-07T18:32:19.764Z", 30),
    calculationVersion: 2 as const, source: "PURCHASE", paymentId: "new-paid-payment",
    startDate: new Date("2026-12-08T18:32:19.764Z") };
  assert.equal(computeEntitlementExpiry([long, finite])?.toISOString(), finite.endDate.toISOString());
  assert.equal(computeEntitlementExpiry([long, finite, renewal])?.toISOString(), "2027-01-07T18:32:19.764Z");
  assert.equal(long.status, "ACTIVE");
});

test("serializes renewal expiry by committed start date when capture times arrive out of order", () => {
  const first = { ...grant("first", "2026-11-11T00:00:01Z", "2026-12-11T00:00:01Z", 30),
    source: "PURCHASE", paymentId: "payment-first", calculationVersion: 2 as const };
  const second = { ...grant("second", "2026-11-11T00:00:00Z", "2027-01-10T00:00:01Z", 30),
    source: "PURCHASE", paymentId: "payment-second", calculationVersion: 2 as const,
    startDate: new Date("2026-12-11T00:00:01Z") };
  assert.equal(computeEntitlementExpiry([first, second])?.toISOString(), "2027-01-10T00:00:01.000Z");
  assert.equal(computeEntitlementExpiry([{ ...first, status: "REVOKED" }, second])?.toISOString(), "2027-01-10T00:00:01.000Z");
});

test("new bundle and individual purchases do not stack across entitlement keys", () => {
  const created = "2026-11-11T00:00:00Z";
  const bundle = { ...grant("bundle", created, "2026-12-11T00:00:00Z", 30),
    source: "PURCHASE", paymentId: "paid-bundle", calculationVersion: 2 as const };
  const individual = { ...bundle, _id: "individual", bundleId: servers[0]!, bundleKind: "server" as const,
    accessType: "INDIVIDUAL_SERVER" as const, serverId: servers[0]!, serverIds: [servers[0]!], paymentId: "paid-individual" };
  const other = { ...individual, _id: "other", bundleId: servers[1]!, serverId: servers[1]!, serverIds: [servers[1]!],
    paymentId: "paid-other", durationDays: 90, endDate: new Date("2027-02-09T00:00:00Z") };
  const records = [bundle, individual, other];
  const now = new Date("2026-12-26T00:00:00Z");
  assert.ok(furthestEntitlementExpiry(records)! > now);
  assert.equal(hasActiveVipEntitlementForServer({ history: records, serverId: servers[0]!, now }), false);
  assert.equal(hasActiveVipEntitlementForServer({ history: records, serverId: servers[1]!, now }), true);
});

test("staff can distinguish and inspect two grants for the same bundle", () => {
  const first = { ...grant("first", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", 30),
    source: "PURCHASE", amount: 5000, paymentId: "payment-first" };
  const second = { ...grant("second", "2026-11-02T00:00:00Z", "2026-12-02T00:00:00Z", 30),
    status: "REVOKED" as const };
  const rows = buildAdminVipGrantRows({ history: [first, second], eligibleServers: [],
    bundleLabels: { "fixture-bundle": "Fixture bundle" }, now: new Date("2026-11-03T00:00:00Z") });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.id === first._id)?.amountPaise, 5000);
  assert.equal(rows.find((row) => row.id === second._id)?.status, "revoked");
  assert.ok(rows.every((row) => row.label === "Fixture bundle"));
});
