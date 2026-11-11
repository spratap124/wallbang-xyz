import assert from "node:assert/strict";
import test from "node:test";

import {
  synchronizeVipRoleWithStore,
  type VipRoleStore,
} from "./vip-role-service";
import type { VipHistoryDoc } from "@/types/payments";
import type { AuditLogDoc, UserRoleDoc } from "@/types/permissions";

const now = new Date("2026-11-11T00:00:00.000Z");

function entitlement(endDate: string, paymentId = "payment-1"): VipHistoryDoc {
  const createdAt = new Date("2026-11-01T00:00:00.000Z");
  const expiry = new Date(endDate);
  return {
    _id: paymentId,
    userId: "user-1",
    steamId: "76561198000000000",
    bundleId: "retake-1-mumbai-giganodes",
    bundleKind: "server",
    accessType: "INDIVIDUAL_SERVER",
    serverId: "retake-1-mumbai-giganodes",
    serverIds: ["retake-1-mumbai-giganodes"],
    plan: "1_month",
    amount: 9900,
    durationDays: Math.round((expiry.getTime() - createdAt.getTime()) / 86_400_000),
    startDate: createdAt,
    endDate: expiry,
    paymentId,
    createdAt,
  };
}

function assignment(partial: Partial<UserRoleDoc> = {}): UserRoleDoc {
  return {
    _id: "role-1",
    userId: "user-1",
    roleId: "vip-role",
    roleCode: "VIP",
    source: "PURCHASE",
    grantedBy: null,
    grantedAt: new Date("2026-11-01T00:00:00.000Z"),
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    active: true,
    ...partial,
  };
}

function memoryStore(input: {
  history?: VipHistoryDoc[];
  assignments?: UserRoleDoc[];
} = {}): VipRoleStore & { history: VipHistoryDoc[]; assignments: UserRoleDoc[]; audits: AuditLogDoc[] } {
  const state = {
    history: input.history ?? [],
    assignments: input.assignments ?? [],
    audits: [] as AuditLogDoc[],
  };
  return {
    ...state,
    async listEntitlements() { return [...state.history]; },
    async listAssignments() { return [...state.assignments]; },
    async getVipRoleId() { return "vip-role"; },
    async insertAssignment(value) { state.assignments.push(value); },
    async updateAssignment(id, set) {
      const index = state.assignments.findIndex((value) => value._id === id);
      assert.notEqual(index, -1);
      state.assignments[index] = { ...state.assignments[index]!, ...set };
    },
    async insertAudit(value) { state.audits.push(value); },
  };
}

const input = {
  userId: "user-1",
  steamId: "76561198000000000",
  personaName: "Player",
  source: "PURCHASE" as const,
  grantedBy: null,
};

test("creates a finite global role from persisted entitlement history", async () => {
  const store = memoryStore({ history: [entitlement("2027-01-01T00:00:00.000Z")] });
  const result = await synchronizeVipRoleWithStore(input, store, now);

  assert.equal(result.active, true);
  assert.equal(result.lifetime, false);
  assert.equal(result.expiresAt?.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(store.assignments.length, 1);
  assert.equal(store.history.length, 1, "role synchronization does not write entitlement history");
});

test("preserves lifetime VIP during ordinary reconciliation", async () => {
  const store = memoryStore({ assignments: [assignment({ expiresAt: null })] });
  const result = await synchronizeVipRoleWithStore({ ...input, mode: "reconcile" }, store, now);

  assert.equal(result.lifetime, true);
  assert.equal(store.assignments[0]?.expiresAt, null);
});

test("preserves another lifetime grant when a managed lifetime grant is revoked", async () => {
  const remaining = { ...entitlement("2027-01-01T00:00:00.000Z"), lifetimeGrant: true };
  const store = memoryStore({
    history: [remaining],
    assignments: [assignment({ expiresAt: null, lifetimeManaged: true })],
  });
  const result = await synchronizeVipRoleWithStore({
    ...input, mode: "reconcile", reconcileManagedLifetime: true,
  }, store, now);
  assert.equal(result.lifetime, true);
  assert.equal(store.assignments[0]?.expiresAt, null);
});

test("extends finite VIP monotonically but reconciliation can shorten it", async () => {
  const longer = memoryStore({
    history: [entitlement("2026-12-10T00:00:00.000Z")],
    assignments: [assignment({ expiresAt: new Date("2027-01-01T00:00:00.000Z") })],
  });
  await synchronizeVipRoleWithStore(input, longer, now);
  assert.equal(longer.assignments[0]?.expiresAt?.toISOString(), "2027-01-01T00:00:00.000Z");

  const revoked = memoryStore({
    history: [entitlement("2026-12-10T00:00:00.000Z")],
    assignments: [assignment({ expiresAt: new Date("2027-01-01T00:00:00.000Z") })],
  });
  await synchronizeVipRoleWithStore({ ...input, mode: "reconcile" }, revoked, now);
  assert.equal(revoked.assignments[0]?.expiresAt?.toISOString(), "2026-12-10T00:00:00.000Z");
});

test("an explicit all-access revocation deactivates even a lifetime assignment", async () => {
  const store = memoryStore({ assignments: [assignment({ expiresAt: null })] });
  const result = await synchronizeVipRoleWithStore({ ...input, mode: "revoke" }, store, now);

  assert.equal(result.active, false);
  assert.equal(store.assignments[0]?.active, false);
});

test("does not silently clean duplicate active assignments", async () => {
  const store = memoryStore({ assignments: [assignment(), assignment({ _id: "role-2" })] });
  await assert.rejects(
    synchronizeVipRoleWithStore(input, store, now),
    /Multiple active VIP assignments/,
  );
  assert.equal(store.assignments.filter((item) => item.active).length, 2);
});
