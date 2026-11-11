import "server-only";

import type { ClientSession } from "mongodb";

import { auditLogsCollection, rolesCollection, userRolesCollection } from "@/lib/permissions/collections";
import { invalidatePermissionCache } from "@/lib/permissions/cache";
import { ROLE_PRIORITY } from "@/lib/permissions/constants";
import { ensurePermissionIndexes } from "@/lib/permissions/collections";
import { seedPermissionsCatalog } from "@/lib/permissions/seed";
import { updateUserDisplayRole, updateUserDisplayTags } from "@/lib/auth/users";
import { furthestEntitlementExpiry } from "@/lib/payments/entitlements-logic";
import { loadEffectiveVipHistory } from "@/lib/payments/effective-vip-history";
import type { VipHistoryDoc } from "@/types/payments";
import type { AuditLogDoc, RoleSource, UserRoleDoc } from "@/types/permissions";

export type VipRoleSyncMode = "extend" | "reconcile" | "revoke";

export type VipRoleStore = {
  listEntitlements(userId: string): Promise<VipHistoryDoc[]>;
  listAssignments(userId: string): Promise<UserRoleDoc[]>;
  getVipRoleId(): Promise<string>;
  insertAssignment(assignment: UserRoleDoc): Promise<void>;
  updateAssignment(id: string, set: Partial<UserRoleDoc>): Promise<void>;
  insertAudit(log: AuditLogDoc): Promise<void>;
};

export type SynchronizeVipRoleInput = {
  userId: string;
  steamId: string;
  personaName: string;
  source: RoleSource;
  grantedBy: { id: string; steamId: string } | null;
  mode?: VipRoleSyncMode;
  /** Explicit lifetime grants are represented by a null role expiry. */
  grantLifetime?: boolean;
  /** A specifically selected managed lifetime grant was revoked. */
  reconcileManagedLifetime?: boolean;
};

export type VipRoleSyncResult = {
  assignmentId: string | null;
  expiresAt: Date | null;
  lifetime: boolean;
  changed: boolean;
  active: boolean;
};

/** Run index/catalog setup before opening a transaction that may create VIP. */
export async function ensureVipRoleServiceReady(): Promise<void> {
  await ensurePermissionIndexes();
  await seedPermissionsCatalog();
}

/**
 * Persistence boundary for global VIP roles. The store can read entitlement
 * history but deliberately exposes no history, payment, or purchase writers.
 */
export async function synchronizeVipRoleWithStore(
  input: SynchronizeVipRoleInput,
  store: VipRoleStore,
  now = new Date(),
): Promise<VipRoleSyncResult> {
  const history = await store.listEntitlements(input.userId);
  const assignments = await store.listAssignments(input.userId);

  const activeAssignments = assignments.filter(
    (assignment) => assignment.roleCode === "VIP" && assignment.active,
  );
  if (activeAssignments.length > 1 && input.mode !== "revoke") {
    throw new Error(
      `Multiple active VIP assignments exist for user ${input.userId}; resolve the duplicate assignments before synchronization.`,
    );
  }

  const current = activeAssignments[0] ?? null;
  if (input.mode === "revoke") {
    for (const assignment of activeAssignments) {
      await store.updateAssignment(assignment._id, { active: false });
      await writeSyncAudit(input, store, assignment, null, now, "REVOKE_ROLE");
    }
    return {
      assignmentId: current?._id ?? null,
      expiresAt: null,
      lifetime: false,
      changed: activeAssignments.length > 0,
      active: false,
    };
  }
  if (current?.expiresAt === null && !(input.reconcileManagedLifetime && current.lifetimeManaged)) {
    return {
      assignmentId: current._id,
      expiresAt: null,
      lifetime: true,
      changed: false,
      active: true,
    };
  }

  const historyExpiry = furthestEntitlementExpiry(history);
  const priorExpiry = current?.expiresAt && current.expiresAt > now
    ? current.expiresAt
    : null;
  const desiredLifetime = input.grantLifetime === true ||
    Boolean(input.reconcileManagedLifetime && history.some((row) => row.lifetimeGrant === true && row.status !== "REVOKED" && row.status !== "SUPERSEDED"));
  let desiredExpiry = historyExpiry;
  if (desiredLifetime) {
    desiredExpiry = null;
  } else if (input.mode !== "reconcile" && priorExpiry && (!desiredExpiry || priorExpiry > desiredExpiry)) {
    // Grant synchronization is monotonic. Revocation uses explicit reconciliation.
    desiredExpiry = priorExpiry;
  }

  if (!desiredLifetime && (!desiredExpiry || desiredExpiry <= now)) {
    if (!current) {
      return { assignmentId: null, expiresAt: null, lifetime: false, changed: false, active: false };
    }
    await store.updateAssignment(current._id, { active: false });
    await writeSyncAudit(input, store, current, null, now, "REVOKE_ROLE");
    return { assignmentId: current._id, expiresAt: null, lifetime: false, changed: true, active: false };
  }

  if (current) {
    const expiryUnchanged = desiredLifetime
      ? current.expiresAt === null
      : current.expiresAt?.getTime() === desiredExpiry?.getTime();
    if (expiryUnchanged && current.source === input.source) {
      return { assignmentId: current._id, expiresAt: current.expiresAt, lifetime: desiredLifetime, changed: false, active: true };
    }
    await store.updateAssignment(current._id, {
      expiresAt: desiredExpiry,
      source: input.source,
      ...(desiredLifetime && current.expiresAt !== null ? { lifetimeManaged: true } : {}),
      ...(!desiredLifetime && input.reconcileManagedLifetime ? { lifetimeManaged: false } : {}),
    });
    await writeSyncAudit(input, store, current, desiredExpiry, now, "GRANT_ROLE");
    return { assignmentId: current._id, expiresAt: desiredExpiry, lifetime: desiredLifetime, changed: true, active: true };
  }

  // Reuse the most recently useful historical assignment when possible.
  const priorAssignment = assignments
    .filter((assignment) => assignment.roleCode === "VIP" && !assignment.active)
    .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0];
  const assignmentId = priorAssignment?._id ?? crypto.randomUUID();
  if (priorAssignment) {
    await store.updateAssignment(assignmentId, {
      active: true,
      expiresAt: desiredExpiry,
      source: input.source,
      ...(desiredLifetime ? { lifetimeManaged: true } : { lifetimeManaged: false }),
    });
  } else {
    await store.insertAssignment({
      _id: assignmentId,
      userId: input.userId,
      roleId: await store.getVipRoleId(),
      roleCode: "VIP",
      source: input.source,
      grantedBy: input.grantedBy?.id ?? null,
      grantedAt: now,
      expiresAt: desiredExpiry,
      active: true,
      ...(desiredLifetime ? { lifetimeManaged: true } : {}),
    });
  }
  await writeSyncAudit(input, store, priorAssignment ?? null, desiredExpiry, now, "GRANT_ROLE", assignmentId);
  return { assignmentId, expiresAt: desiredExpiry, lifetime: desiredLifetime, changed: true, active: true };
}

function writeSyncAudit(
  input: SynchronizeVipRoleInput,
  store: VipRoleStore,
  previous: UserRoleDoc | null,
  expiresAt: Date | null,
  now: Date,
  action: AuditLogDoc["action"],
  assignmentId = previous?._id ?? null,
): Promise<void> {
  return store.insertAudit({
      _id: crypto.randomUUID(),
      adminId: input.grantedBy?.id ?? null,
      adminSteamId: input.grantedBy?.steamId ?? null,
      action,
      targetUserId: input.userId,
      targetSteamId: input.steamId,
      targetPersonaName: input.personaName,
      oldValue: previous
        ? { roleCode: "VIP", expiresAt: previous.expiresAt, assignmentId: previous._id, automaticVipSync: true }
        : null,
      newValue: action === "GRANT_ROLE"
        ? { roleCode: "VIP", source: input.source, expiresAt, assignmentId, automaticVipSync: true }
        : null,
      timestamp: now,
  });
}

/** Mongo-backed role store. It has no entitlement history write method. */
export function createMongoVipRoleStore(session?: ClientSession): VipRoleStore {
  return {
    async listEntitlements(userId) {
      return loadEffectiveVipHistory(userId, session);
    },
    async listAssignments(userId) {
      const collection = await userRolesCollection();
      return collection.find({ userId, roleCode: "VIP" }, { session }).toArray();
    },
    async getVipRoleId() {
      const collection = await rolesCollection();
      const role = await collection.findOne({ code: "VIP" });
      if (!role) throw new Error("VIP role not found in catalog.");
      return role._id;
    },
    async insertAssignment(assignment) {
      const collection = await userRolesCollection();
      await collection.insertOne(assignment, { session });
    },
    async updateAssignment(id, set) {
      const collection = await userRolesCollection();
      const result = await collection.updateOne(
        { _id: id, roleCode: "VIP" },
        { $set: set },
        { session },
      );
      if (!result.matchedCount) throw new Error("VIP role assignment changed during synchronization.");
    },
    async insertAudit(log) {
      const collection = await auditLogsCollection();
      await collection.insertOne(log, { session });
    },
  };
}

/** Refresh presentation/cache state after the transaction commits. */
export async function refreshVipRolePresentation(input: {
  userId: string;
  steamId: string;
  source?: RoleSource;
}): Promise<void> {
  const collection = await userRolesCollection();
  const assignments = await collection.find({ userId: input.userId, active: true }).toArray();
  const roles = assignments
    .filter((assignment) => !assignment.expiresAt || assignment.expiresAt > new Date())
    .map((assignment) => assignment.roleCode);
  const displayRole = roles.reduce((best, role) =>
    ROLE_PRIORITY[role] > ROLE_PRIORITY[best] ? role : best, "USER" as (typeof roles)[number] | "USER");
  invalidatePermissionCache(input.steamId);
  await updateUserDisplayRole(input.userId, displayRole);
  if (input.source === "PURCHASE") {
    await updateUserDisplayTags(input.userId, { chatTag: "[VIP]", nameTag: "VIP" });
  }
}

/**
 * Convenience entry for callers already inside a VIP entitlement transaction.
 * The supplied session must cover the history read and every role write.
 */
export async function synchronizeVipRole(
  input: SynchronizeVipRoleInput & { session: ClientSession },
): Promise<VipRoleSyncResult> {
  return synchronizeVipRoleWithStore(
    input,
    createMongoVipRoleStore(input.session),
  );
}
