import "server-only";

import {
  getCachedPermissions,
  invalidatePermissionCache,
  setCachedPermissions,
} from "@/lib/permissions/cache";
import {
  auditLogsCollection,
  ensurePermissionIndexes,
  rolesCollection,
  userRolesCollection,
} from "@/lib/permissions/collections";
import {
  DEFAULT_ROLE_PERMISSIONS,
  GAME_VIP_PERMISSIONS,
  isRoleCode,
  parseOwnerSteamIds,
  ROLE_PRIORITY,
} from "@/lib/permissions/constants";
import { seedPermissionsCatalog } from "@/lib/permissions/seed";
import {
  ensureUserFromSteamId,
  findUserById,
  findUserBySteamId,
  findUsersByIds,
  listUsers as listUserDocs,
  searchUsers as searchUserDocs,
  toAuthUser,
  updateUserDisplayRole,
  updateUserDisplayTags,
  type UserDoc,
} from "@/lib/auth/users";
import {
  isAllowedPlayerTag,
  parsePlayerTag,
} from "@/lib/permissions/player-tags";
import { LAUNCH_GIVEAWAY_ENTITLEMENT_KEY } from "@/lib/payments/entitlements-logic";
import type {
  AuditLogDoc,
  PermissionCode,
  PlayerPermissionsResponse,
  ResolvedPermissions,
  RoleCode,
  RoleSource,
  UserRoleDoc,
} from "@/types/permissions";
import { getGameLoadoutForPlayer } from "@/lib/loadout/service";
import { withVipEntitlementTransaction } from "@/lib/payments/entitlement-transaction";
import { loadEffectiveVipHistory } from "@/lib/payments/effective-vip-history";
import { entitlementKeyFromRecord, furthestEntitlementExpiry } from "@/lib/payments/entitlements-logic";
import {
  refreshVipRolePresentation,
  synchronizeVipRole,
} from "@/lib/permissions/vip-role-service";

async function ready(): Promise<void> {
  await ensurePermissionIndexes();
  await seedPermissionsCatalog();
}

function isAssignmentActive(
  assignment: UserRoleDoc,
  now = new Date(),
): boolean {
  if (!assignment.active) return false;
  if (assignment.expiresAt && assignment.expiresAt <= now) return false;
  return true;
}

function highestRole(roles: RoleCode[]): RoleCode {
  if (roles.length === 0) return "USER";
  return roles.reduce((best, role) =>
    ROLE_PRIORITY[role] > ROLE_PRIORITY[best] ? role : best,
  );
}

async function loadActiveAssignments(userId: string): Promise<UserRoleDoc[]> {
  const col = await userRolesCollection();
  const now = new Date();
  const docs = await col
    .find({
      userId,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
    .toArray();
  return docs.filter((d) => isAssignmentActive(d, now));
}

async function resolveFromUser(user: UserDoc): Promise<ResolvedPermissions> {
  await ready();

  const cached = getCachedPermissions(user.steamId);
  const assignments = await loadActiveAssignments(user._id);
  const roleCodes = Array.from(
    new Set(assignments.map((a) => a.roleCode)),
  ) as RoleCode[];

  let permissions: PermissionCode[];

  if (
    cached &&
    cached.roles.length === roleCodes.length &&
    cached.roles.every((r) => roleCodes.includes(r))
  ) {
    permissions = cached.permissions;
  } else {
    const rolesCol = await rolesCollection();
    const roleDocs =
      roleCodes.length > 0
        ? await rolesCol.find({ code: { $in: roleCodes } }).toArray()
        : [];

    const permSet = new Set<PermissionCode>();
    for (const role of roleDocs) {
      for (const code of role.permissions) {
        permSet.add(code);
      }
    }
    permissions = Array.from(permSet).sort();
    setCachedPermissions(user.steamId, roleCodes, permissions);
  }

  const displayRole = highestRole(roleCodes);

  return {
    userId: user._id,
    steamId: user.steamId,
    personaName: user.personaName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    displayRole,
    chatTag: user.chatTag?.trim() || null,
    nameTag: user.nameTag?.trim() || null,
    roles: roleCodes.sort(
      (a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a],
    ),
    permissions,
    activeAssignments: assignments.map((a) => ({
      id: a._id,
      roleCode: a.roleCode,
      source: a.source,
      grantedAt: a.grantedAt,
      expiresAt: a.expiresAt,
    })),
  };
}

async function writeAudit(entry: Omit<AuditLogDoc, "_id">): Promise<void> {
  const col = await auditLogsCollection();
  await col.insertOne({ _id: crypto.randomUUID(), ...entry });
}

/** Write an admin audit log entry (role, badge, or server ops). */
export async function recordAuditLog(
  entry: Omit<AuditLogDoc, "_id">,
): Promise<void> {
  await writeAudit(entry);
}

async function syncDisplayRole(userId: string, roles: RoleCode[]): Promise<void> {
  await updateUserDisplayRole(userId, highestRole(roles));
}

export async function getUserPermissions(params: {
  userId?: string;
  steamId?: string;
}): Promise<ResolvedPermissions | null> {
  await ready();

  let user: UserDoc | null = null;
  if (params.userId) {
    user = await findUserById(params.userId);
  } else if (params.steamId) {
    user = await findUserBySteamId(params.steamId);
  }

  if (!user) return null;
  return resolveFromUser(user);
}

export async function setPlayerTags(input: {
  targetUserId?: string;
  targetSteamId?: string;
  chatTag: unknown;
  nameTag: unknown;
  grantedBy: { id: string; steamId: string };
}): Promise<ResolvedPermissions> {
  await ready();

  let user: UserDoc | null = null;
  if (input.targetUserId) {
    user = await findUserById(input.targetUserId);
  } else if (input.targetSteamId) {
    user = await findUserBySteamId(input.targetSteamId);
  }
  if (!user) {
    throw new Error("User not found.");
  }

  const chatTag = parsePlayerTag(input.chatTag);
  const nameTag = parsePlayerTag(input.nameTag);
  if (
    !isAllowedPlayerTag("chat", chatTag) ||
    !isAllowedPlayerTag("name", nameTag)
  ) {
    throw new Error("Choose a tag from the list.");
  }
  const previous = {
    chatTag: user.chatTag?.trim() || null,
    nameTag: user.nameTag?.trim() || null,
  };

  const updated = await updateUserDisplayTags(user._id, { chatTag, nameTag });
  invalidatePermissionCache(updated.steamId);

  await writeAudit({
    adminId: input.grantedBy.id,
    adminSteamId: input.grantedBy.steamId,
    action: "SET_PLAYER_TAGS",
    targetUserId: updated._id,
    targetSteamId: updated.steamId,
    targetPersonaName: updated.personaName,
    oldValue: previous,
    newValue: { chatTag, nameTag },
    timestamp: new Date(),
  });

  return resolveFromUser(updated);
}

export async function hasPermission(params: {
  userId?: string;
  steamId?: string;
  permission: PermissionCode;
}): Promise<boolean> {
  const resolved = await getUserPermissions(params);
  if (!resolved) return false;
  return resolved.permissions.includes(params.permission);
}

export async function ensureBaselineUserRole(user: {
  id: string;
  steamId: string;
}): Promise<void> {
  await ready();
  const col = await userRolesCollection();
  const existing = await col.findOne({
    userId: user.id,
    roleCode: "USER",
    active: true,
  });
  if (existing) return;

  const rolesCol = await rolesCollection();
  const userRole = await rolesCol.findOne({ code: "USER" });
  if (!userRole) return;

  await col.insertOne({
    _id: crypto.randomUUID(),
    userId: user.id,
    roleId: userRole._id,
    roleCode: "USER",
    source: "SYSTEM",
    grantedBy: null,
    grantedAt: new Date(),
    expiresAt: null,
    active: true,
  });
  invalidatePermissionCache(user.steamId);
}

export async function ensureOwnerFromEnv(user: {
  id: string;
  steamId: string;
  personaName?: string;
}): Promise<void> {
  const owners = parseOwnerSteamIds();
  if (!owners.includes(user.steamId)) return;

  await ready();
  const col = await userRolesCollection();
  const existing = await col.findOne({
    userId: user.id,
    roleCode: "OWNER",
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  if (existing) return;

  const rolesCol = await rolesCollection();
  const ownerRole = await rolesCol.findOne({ code: "OWNER" });
  if (!ownerRole) return;

  await col.insertOne({
    _id: crypto.randomUUID(),
    userId: user.id,
    roleId: ownerRole._id,
    roleCode: "OWNER",
    source: "SYSTEM",
    grantedBy: null,
    grantedAt: new Date(),
    expiresAt: null,
    active: true,
  });

  invalidatePermissionCache(user.steamId);
  const resolved = await getUserPermissions({ userId: user.id });
  if (resolved) {
    await syncDisplayRole(user.id, resolved.roles);
  }

  await writeAudit({
    adminId: null,
    adminSteamId: null,
    action: "GRANT_ROLE",
    targetUserId: user.id,
    targetSteamId: user.steamId,
    targetPersonaName: user.personaName ?? null,
    oldValue: null,
    newValue: { roleCode: "OWNER", source: "SYSTEM", expiresAt: null },
    timestamp: new Date(),
  });
}

/** Run after Steam login: baseline USER + optional OWNER from env. */
export async function onUserAuthenticated(user: {
  id: string;
  steamId: string;
  personaName?: string;
}): Promise<void> {
  await ensureBaselineUserRole(user);
  await ensureOwnerFromEnv(user);
}

export type GrantRoleInput = {
  targetUserId?: string;
  targetSteamId?: string;
  roleCode: RoleCode;
  source: RoleSource;
  grantedBy: { id: string; steamId: string } | null;
  expiresAt?: Date | null;
  /** VIP only: server ids or `all_retakes`. Defaults to complimentary Mumbai. */
  entitlementKeys?: string[];
  /** Offline VIP purchase amount in paise; only used when source is PURCHASE. */
  purchaseAmountPaise?: number;
  entitlementAmounts?: { key: string; amountPaise: number }[];
  requestId?: string;
};

export async function resolveGrantTarget(
  input: Pick<GrantRoleInput, "targetUserId" | "targetSteamId">,
): Promise<UserDoc | null> {
  if (input.targetUserId) {
    return findUserById(input.targetUserId);
  }
  if (!input.targetSteamId) return null;

  const existing = await findUserBySteamId(input.targetSteamId);
  if (existing) return existing;

  const created = await ensureUserFromSteamId(input.targetSteamId);
  await ensureBaselineUserRole({
    id: created._id,
    steamId: created.steamId,
  });
  return created;
}

export async function grantRole(input: GrantRoleInput): Promise<ResolvedPermissions> {
  if (input.roleCode === "VIP") {
    if (!input.entitlementKeys?.length) {
      throw new Error("Select explicit VIP servers or bundles before granting VIP.");
    }
    const { grantManualVip } = await import("@/lib/payments/manual-vip-service");
    return grantManualVip(input);
  }

  await ready();

  if (!isRoleCode(input.roleCode)) {
    throw new Error("Invalid role code.");
  }

  const user = await resolveGrantTarget(input);

  if (!user) {
    throw new Error("User not found.");
  }

  const rolesCol = await rolesCollection();
  const role = await rolesCol.findOne({ code: input.roleCode });
  if (!role) {
    throw new Error("Role not found in catalog.");
  }

  const expiresAt = input.expiresAt ?? null;
  const col = await userRolesCollection();
  if (input.requestId) {
    const existingRequest = await col.findOne({ _id: input.requestId, userId: user._id, roleCode: input.roleCode });
    if (existingRequest) return resolveFromUser(user);
  }

  // Deactivate any existing active assignment for the same role (replace).
  await col.updateMany(
    { userId: user._id, roleCode: input.roleCode, active: true },
    { $set: { active: false } },
  );

  const assignment: UserRoleDoc = {
    _id: input.requestId ?? crypto.randomUUID(),
    userId: user._id,
    roleId: role._id,
    roleCode: input.roleCode,
    source: input.source,
    grantedBy: input.grantedBy?.id ?? null,
    grantedAt: new Date(),
    expiresAt,
    active: true,
  };

  try {
    await col.insertOne(assignment);
  } catch (err) {
    if (input.requestId && err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 11000) {
      const concurrentRequest = await col.findOne({ _id: input.requestId, userId: user._id, roleCode: input.roleCode });
      if (concurrentRequest) return resolveFromUser(user);
    }
    throw err;
  }
  invalidatePermissionCache(user.steamId);

  await writeAudit({
    adminId: input.grantedBy?.id ?? null,
    adminSteamId: input.grantedBy?.steamId ?? null,
    action: "GRANT_ROLE",
    targetUserId: user._id,
    targetSteamId: user.steamId,
    targetPersonaName: user.personaName,
    oldValue: null,
    newValue: {
      roleCode: input.roleCode,
      source: input.source,
      expiresAt,
      assignmentId: assignment._id,
    },
    timestamp: new Date(),
  });

  const resolved = await resolveFromUser(user);
  await syncDisplayRole(user._id, resolved.roles);

  // Best-effort Player-domain badge + activity sync (non-blocking for RBAC).
  try {
    const { syncBadgeFromRole } = await import("@/lib/profile/activity");
    await syncBadgeFromRole({
      steamId: user.steamId,
      roleCode: input.roleCode,
      grantedBy: input.grantedBy?.id ?? null,
    });
  } catch (err) {
    console.error("[grantRole] badge sync failed", err);
  }

  return resolved;
}

export type EnsureVipCoversUntilInput = {
  userId: string;
  coversUntil: Date;
  source: RoleSource;
  grantedBy: { id: string; steamId: string } | null;
};

/**
 * Legacy signature retained for compatibility. `coversUntil` is deliberately
 * ignored: role expiry is derived from persisted vip_history in the shared
 * role-only synchronizer.
 */
export async function ensureVipCoversUntil(
  input: EnsureVipCoversUntilInput,
): Promise<{ assignmentId: string; expiresAt: Date | null; lifetime: boolean }> {
  await ready();
  const user = await findUserById(input.userId);
  if (!user) throw new Error("User not found.");
  const result = await withVipEntitlementTransaction({
    userId: user._id,
    run: ({ session }) => synchronizeVipRole({
      userId: user._id,
      steamId: user.steamId,
      personaName: user.personaName,
      source: input.source,
      grantedBy: input.grantedBy,
      mode: "extend",
      session,
    }),
  });
  await refreshVipRolePresentation({
    userId: user._id,
    steamId: user.steamId,
    source: input.source,
  });
  return {
    assignmentId: result.assignmentId ?? user._id,
    expiresAt: result.expiresAt,
    lifetime: result.lifetime,
  };
}

export type RevokeRoleInput = {
  targetUserId?: string;
  targetSteamId?: string;
  roleCode?: RoleCode;
  userRoleId?: string;
  revokedBy: { id: string; steamId: string } | null;
};

export async function revokeRole(
  input: RevokeRoleInput,
): Promise<ResolvedPermissions> {
  await ready();

  const user = input.targetUserId
    ? await findUserById(input.targetUserId)
    : input.targetSteamId
      ? await findUserBySteamId(input.targetSteamId)
      : null;

  if (!user) {
    throw new Error("User not found.");
  }

  const col = await userRolesCollection();
  let assignment: UserRoleDoc | null = null;

  if (input.userRoleId) {
    assignment = await col.findOne({
      _id: input.userRoleId,
      userId: user._id,
      active: true,
    });
  } else if (input.roleCode) {
    assignment = await col.findOne({
      userId: user._id,
      roleCode: input.roleCode,
      active: true,
    });
  }

  if (!assignment) {
    throw new Error("Active role assignment not found.");
  }

  if (assignment.roleCode === "VIP") {
    throw new Error("Select a specific VIP grant in VIP management.");
  }

  if (assignment.roleCode === "USER") {
    throw new Error("Cannot revoke the baseline USER role.");
  }

  await col.updateOne(
    { _id: assignment._id },
    { $set: { active: false } },
  );

  invalidatePermissionCache(user.steamId);

  await writeAudit({
    adminId: input.revokedBy?.id ?? null,
    adminSteamId: input.revokedBy?.steamId ?? null,
    action: "REVOKE_ROLE",
    targetUserId: user._id,
    targetSteamId: user.steamId,
    targetPersonaName: user.personaName,
    oldValue: {
      roleCode: assignment.roleCode,
      source: assignment.source,
      expiresAt: assignment.expiresAt,
      assignmentId: assignment._id,
    },
    newValue: null,
    timestamp: new Date(),
  });

  const resolved = await resolveFromUser(user);
  await syncDisplayRole(user._id, resolved.roles);
  return resolved;
}

export type RevokeAllVipAccessInput = {
  targetUserId?: string;
  targetSteamId?: string;
  revokedBy: { id: string; steamId: string } | null;
};

export type RevokeAllVipAccessResult = {
  permissions: ResolvedPermissions;
  deactivatedVipRoles: number;
  deletedHistoryRows: number;
};

/**
 * Testing / support: strip purchased VIP so membership UI and role match a clean slate.
 * Deactivates every VIP role row and deletes vip_history for the user.
 * Does not refund payments or touch FOUNDING_MEMBER.
 */
export async function revokeAllVipAccess(
  _input: RevokeAllVipAccessInput,
): Promise<RevokeAllVipAccessResult> {
  void _input;
  throw new Error("Select a specific VIP grant in VIP management.");
}

export type RevokeVipEntitlementInput = {
  targetUserId?: string;
  targetSteamId?: string;
  /** Exact vip_history identifier. A key is supported only when unambiguous. */
  entitlementId?: string;
  entitlementKey?: string;
  revokedBy: { id: string; steamId: string } | null;
};

export type RevokeVipEntitlementResult = {
  permissions: ResolvedPermissions;
  entitlementId: string;
  entitlementKey: string;
  alreadyRevoked: boolean;
  deletedHistoryRows: number;
  vipExpiresAt: Date | null;
  vipDeactivated: boolean;
};

/** Revoke one explicitly selected grant through an immutable audit record. */
export async function revokeVipEntitlement(
  input: RevokeVipEntitlementInput,
): Promise<RevokeVipEntitlementResult> {
  await ready();
  if (!input.revokedBy) throw new Error("An authorized administrator is required.");
  const user = input.targetUserId
    ? await findUserById(input.targetUserId)
    : input.targetSteamId ? await findUserBySteamId(input.targetSteamId) : null;
  if (!user) throw new Error("User not found.");
  const id = input.entitlementId?.trim();
  const key = input.entitlementKey?.trim();
  if (!id && !key) throw new Error("Select a specific VIP grant.");

  const result = await withVipEntitlementTransaction({
    userId: user._id,
    run: async ({ session }) => {
      const history = await loadEffectiveVipHistory(user._id, session);
      const matches = id ? history.filter((row) => row._id === id)
        : history.filter((row) => entitlementKeyFromRecord(row) === key);
      if (matches.length !== 1) {
        throw new Error(matches.length ? "Multiple grants match this entitlement; select a specific grant." : "VIP grant not found for this player.");
      }
      const selected = matches[0]!;
      if (id && key && entitlementKeyFromRecord(selected) !== key) throw new Error("VIP grant does not match the selected entitlement.");
      const assignment = await (await userRolesCollection()).findOne({ userId: user._id, roleCode: "VIP", active: true }, { session });
      const alreadyRevoked = selected.status === "REVOKED" || selected.status === "SUPERSEDED";
      if (alreadyRevoked) return { selected, alreadyRevoked, role: null };

      const before = furthestEntitlementExpiry(history);
      if (assignment?.expiresAt && assignment.expiresAt > new Date() && (!before || assignment.expiresAt > before)) {
        throw new Error("VIP role has additional coverage that cannot be attributed safely; review before revocation.");
      }
      if (assignment?.expiresAt === null && selected.lifetimeGrant === true && !assignment.lifetimeManaged) {
        throw new Error("Lifetime VIP ownership is ambiguous; review before revocation.");
      }
      if (assignment?.expiresAt === null && selected.calculationVersion !== 2 && selected.amount === 0 && selected.source !== "PURCHASE") {
        throw new Error("Historical lifetime VIP ownership is ambiguous; review before revocation.");
      }
      const audit = await auditLogsCollection();
      const timestamp = new Date();
      await audit.insertOne({
        _id: `vip-grant-revoke:${selected._id}`,
        adminId: input.revokedBy?.id ?? null, adminSteamId: input.revokedBy?.steamId ?? null,
        action: "REVOKE_VIP_ACCESS", targetUserId: user._id, targetSteamId: user.steamId,
        targetPersonaName: user.personaName,
        oldValue: { scope: "grant", historyId: selected._id, entitlementKey: entitlementKeyFromRecord(selected) },
        newValue: { revoked: true }, timestamp,
      }, { session });
      const role = await synchronizeVipRole({
        userId: user._id, steamId: user.steamId, personaName: user.personaName,
        source: "MANUAL", grantedBy: input.revokedBy, mode: "reconcile",
        reconcileManagedLifetime: selected.lifetimeGrant === true,
        session,
      });
      return { selected, alreadyRevoked, role };
    },
  });
  await refreshVipRolePresentation({ userId: user._id, steamId: user.steamId });
  const permissions = await resolveFromUser(user);
  return {
    permissions, entitlementId: result.selected._id,
    entitlementKey: entitlementKeyFromRecord(result.selected) ?? result.selected.bundleId,
    alreadyRevoked: result.alreadyRevoked, deletedHistoryRows: 0,
    vipExpiresAt: result.role?.expiresAt ?? permissions.activeAssignments.find((row) => row.roleCode === "VIP")?.expiresAt ?? null,
    vipDeactivated: result.role ? !result.role.active : !permissions.roles.includes("VIP"),
  };
}

export async function searchUsers(query: string, options?: { skip?: number; limit?: number }) {
  await ready();
  const result = await searchUserDocs(query, options);
  return { ...result, users: result.users.map((doc) => ({
    ...toAuthUser(doc),
    role: doc.role ?? "USER",
    lastLoginAt: doc.lastLoginAt,
    createdAt: doc.createdAt,
  })) };
}

export async function listUsers(options?: { skip?: number; limit?: number }) {
  await ready();
  const result = await listUserDocs(options);
  return { ...result, users: result.users.map((doc) => ({
    ...toAuthUser(doc),
    role: doc.role ?? "USER",
    lastLoginAt: doc.lastLoginAt,
    createdAt: doc.createdAt,
  })) };
}

export async function getAuditLogs(params?: {
  limit?: number;
}): Promise<AuditLogDoc[]> {
  await ready();
  const limit = Math.min(params?.limit ?? 50, 200);
  const col = await auditLogsCollection();
  const logs = await col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();

  const missingIds = Array.from(
    new Set(
      logs
        .filter((log) => !log.targetPersonaName && log.targetUserId)
        .map((log) => log.targetUserId as string),
    ),
  );

  if (missingIds.length === 0) return logs;

  const nameById = new Map<string, string>();
  await Promise.all(
    missingIds.map(async (id) => {
      const user = await findUserById(id);
      if (user) nameById.set(id, user.personaName);
    }),
  );

  return logs.map((log) =>
    log.targetPersonaName || !log.targetUserId
      ? log
      : {
          ...log,
          targetPersonaName: nameById.get(log.targetUserId) ?? null,
        },
  );
}

export async function getPlayerPermissions(
  steamId: string,
  options?: { serverId?: string | null },
): Promise<PlayerPermissionsResponse | null> {
  const [resolved, loadout] = await Promise.all([
    getUserPermissions({ steamId }),
    getGameLoadoutForPlayer(steamId).catch(() => null),
  ]);

  if (!resolved) {
    return {
      player: { steamId, username: "" },
      roles: [],
      permissions: [],
      chatTag: null,
      nameTag: null,
      loadout,
    };
  }

  const scoped = options?.serverId
    ? await scopePermissionsForGameServer(resolved, options.serverId)
    : resolved;

  return {
    player: {
      steamId: scoped.steamId,
      username: scoped.personaName,
    },
    roles: scoped.roles,
    permissions: scoped.permissions,
    chatTag: scoped.chatTag,
    nameTag: scoped.nameTag,
    loadout,
  };
}

/**
 * When the game server passes serverId, VIP perks require an active entitlement
 * for that server (individual or All Retakes). Staff and founding stay global.
 * Manual / giveaway / purchase VIP are all scoped the same way.
 */
async function scopePermissionsForGameServer(
  resolved: ResolvedPermissions,
  serverId: string,
): Promise<ResolvedPermissions> {
  const trimmed = serverId.trim();
  if (!trimmed) return resolved;

  if (!resolved.roles.includes("VIP")) return resolved;

  const hasGlobalVipAccess =
    resolved.roles.includes("FOUNDING_MEMBER") ||
    resolved.roles.includes("OWNER") ||
    resolved.roles.includes("ADMIN") ||
    resolved.roles.includes("MODERATOR");

  if (hasGlobalVipAccess) return resolved;

  const { hasActiveVipEntitlementForServer } = await import(
    "@/lib/payments/entitlements-logic"
  );
  const history = await loadEffectiveVipHistory(resolved.userId);
  const entitled = hasActiveVipEntitlementForServer({
    history,
    serverId: trimmed,
  });

  if (entitled) return resolved;

  const roles = resolved.roles.filter((role) => role !== "VIP");
  const activeAssignments = resolved.activeAssignments.filter(
    (a) => a.roleCode !== "VIP",
  );
  const grantedByRemaining = new Set<PermissionCode>();
  for (const role of roles) {
    for (const code of DEFAULT_ROLE_PERMISSIONS[role] ?? []) {
      grantedByRemaining.add(code);
    }
  }
  const permissions = resolved.permissions.filter(
    (code) =>
      !GAME_VIP_PERMISSIONS.includes(code) || grantedByRemaining.has(code),
  );

  return {
    ...resolved,
    roles,
    permissions,
    activeAssignments,
    displayRole: highestRole(
      roles.length > 0 ? roles : (["USER"] as RoleCode[]),
    ),
  };
}

export function refreshCache(steamId: string): void {
  invalidatePermissionCache(steamId);
}

export type LaunchGiveawayStatus =
  | "granted"
  | "already_granted"
  | "revoked"
  | "not_first_login"
  | "slots_full"
  | "ineligible"
  | "needs_discord"
  | "not_in_guild";

export type LaunchGiveawayResult = {
  steamId: string;
  personaName: string;
  position: number;
  maxWinners: number;
  status: LaunchGiveawayStatus;
  expiresAt: Date | null;
  discordUserId?: string | null;
  discordUsername?: string | null;
};

/** @deprecated Use LaunchGiveawayResult — kept for the legacy Discord bot API. */
export type GiveawayEntryResult = {
  steamId: string;
  personaName: string;
  position: number;
  maxWinners: number;
  alreadyGranted: boolean;
  expiresAt: Date;
};

export function getLaunchGiveawayMaxWinners(): number {
  return 50;
}

/** The launch VIP promotion has ended; existing grants remain valid. */
export function isLaunchGiveawayClosed(): boolean {
  return true;
}

export function getLaunchGiveawayVipMonths(): number {
  const parsed = Number.parseInt(process.env.GIVEAWAY_VIP_MONTHS ?? "3", 10);
  return Number.isFinite(parsed) ? parsed : 3;
}

/**
 * When true, launch VIP requires Steam login + Discord link + guild membership.
 * When false (default), Steam login alone grants VIP. Discord claim paths stay wired.
 */
export function isLaunchGiveawayDiscordRequired(): boolean {
  const raw = process.env.GIVEAWAY_REQUIRE_DISCORD?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function giveawayVipExpiresAt(from = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setMonth(expiresAt.getMonth() + getLaunchGiveawayVipMonths());
  return expiresAt;
}

/** True only for the Steam sign-in that created the account. Later logins bump lastLoginAt. */
function isFirstSteamLogin(user: { createdAt: Date; lastLoginAt: Date }): boolean {
  return (
    user.createdAt instanceof Date &&
    user.lastLoginAt instanceof Date &&
    user.createdAt.getTime() === user.lastLoginAt.getTime()
  );
}

/** Count unique users with an active launch VIP (duplicate rows for one user = 1 slot). */
async function countActiveGiveawayVips(now = new Date()): Promise<number> {
  const col = await userRolesCollection();
  const userIds = await col.distinct("userId", {
    roleCode: "VIP",
    source: "GIVEAWAY",
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });
  return userIds.length;
}

async function isLaunchGiveawayIneligible(user: {
  id: string;
  steamId: string;
}): Promise<boolean> {
  if (parseOwnerSteamIds().includes(user.steamId)) return true;

  const col = await userRolesCollection();
  const owner = await col.findOne({
    userId: user.id,
    roleCode: "OWNER",
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  return Boolean(owner);
}

/** Revoke any active launch VIP so staff accounts do not consume offer slots. */
async function revokeActiveGiveawayVip(userId: string): Promise<number> {
  const col = await userRolesCollection();
  const result = await col.updateMany(
    {
      userId,
      roleCode: "VIP",
      source: "GIVEAWAY",
      active: true,
    },
    { $set: { active: false } },
  );
  return result.modifiedCount;
}

export async function getLaunchGiveawayStatus(): Promise<{
  maxWinners: number;
  claimed: number;
  remaining: number;
  vipMonths: number;
}> {
  await ready();
  const maxWinners = getLaunchGiveawayMaxWinners();
  if (isLaunchGiveawayClosed()) {
    return {
      maxWinners,
      claimed: maxWinners,
      remaining: 0,
      vipMonths: getLaunchGiveawayVipMonths(),
    };
  }
  const claimed = await countActiveGiveawayVips();
  return {
    maxWinners,
    claimed,
    remaining: Math.max(0, maxWinners - claimed),
    vipMonths: getLaunchGiveawayVipMonths(),
  };
}

/** Public-safe avatar list for players with active launch giveaway VIP. */
export async function getLaunchGiveawayPlayers(): Promise<
  Array<{ personaName: string; avatarUrl: string }>
> {
  await ready();
  const now = new Date();
  const col = await userRolesCollection();
  const assignments = await col
    .find({
      roleCode: "VIP",
      source: "GIVEAWAY",
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
    .sort({ grantedAt: 1 })
    .toArray();

  const userIds = [...new Set(assignments.map((assignment) => assignment.userId))].slice(
    0,
    getLaunchGiveawayMaxWinners(),
  );
  const users = await findUsersByIds(userIds);
  const byId = new Map(users.map((user) => [user._id, user]));
  return userIds.flatMap((userId) => {
    const user = byId.get(userId);
    return user ? [{ personaName: user.personaName, avatarUrl: user.avatarUrl }] : [];
  });
}

function toLegacyGiveawayResult(result: LaunchGiveawayResult): GiveawayEntryResult {
  return {
    steamId: result.steamId,
    personaName: result.personaName,
    position: result.position,
    maxWinners: result.maxWinners,
    alreadyGranted: result.status === "already_granted",
    expiresAt: result.expiresAt ?? giveawayVipExpiresAt(),
  };
}

/**
 * Grant launch VIP once, on the Steam sign-in that creates the account.
 * A later login does not issue it again, including after an admin revoke.
 */
export async function processLaunchGiveaway(input: {
  steamId: string;
  maxWinners?: number;
  discordUserId?: string;
  discordUsername?: string;
}): Promise<LaunchGiveawayResult> {
  await ready();

  const maxWinners = input.maxWinners ?? getLaunchGiveawayMaxWinners();
  const requireDiscord = isLaunchGiveawayDiscordRequired();
  const user = await findUserBySteamId(input.steamId);
  if (!user) {
    throw new Error(
      "You need to sign in with Steam on wallbang.xyz before claiming the launch offer.",
    );
  }

  const col = await userRolesCollection();
  const now = new Date();

  // Owners already have full access — never consume a launch VIP slot.
  if (await isLaunchGiveawayIneligible({ id: user._id, steamId: user.steamId })) {
    const revoked = await revokeActiveGiveawayVip(user._id);
    if (revoked > 0) {
      invalidatePermissionCache(user.steamId);
      const resolved = await getUserPermissions({ userId: user._id });
      if (resolved) {
        await syncDisplayRole(user._id, resolved.roles);
      }
    }
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: 0,
      maxWinners,
      status: "ineligible",
      expiresAt: null,
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  const existingVip = await col.findOne({
    userId: user._id,
    roleCode: { $in: ["VIP", "FOUNDING_MEMBER"] },
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  if (existingVip) {
    // Do not replace manual/founding VIP with a shorter launch grant,
    // and do not consume a launch slot for players who already have access.
    const earlierOrSame =
      existingVip.roleCode === "VIP" && existingVip.source === "GIVEAWAY"
        ? await col.distinct("userId", {
            roleCode: "VIP",
            source: "GIVEAWAY",
            active: true,
            grantedAt: { $lte: existingVip.grantedAt },
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
          })
        : [];

    if (existingVip.roleCode === "VIP" && existingVip.source === "GIVEAWAY") {
      const { grantManualVip } = await import("@/lib/payments/manual-vip-service");
      await grantManualVip({
        targetUserId: user._id,
        roleCode: "VIP",
        source: "GIVEAWAY",
        grantedBy: null,
        expiresAt: existingVip.expiresAt ?? giveawayVipExpiresAt(existingVip.grantedAt),
        entitlementKeys: [LAUNCH_GIVEAWAY_ENTITLEMENT_KEY],
        requestId: existingVip._id,
      });
    }

    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: earlierOrSame.length,
      maxWinners,
      status: "already_granted",
      expiresAt:
        existingVip.expiresAt ??
        (existingVip.source === "GIVEAWAY"
          ? giveawayVipExpiresAt(existingVip.grantedAt)
          : null),
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  // Revoke deactivates the row; it does not delete it. A later login must not
  // insert a second GIVEAWAY assignment for the same account.
  const priorGiveaway = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    source: "GIVEAWAY",
  });
  if (priorGiveaway) {
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: 0,
      maxWinners,
      status: "revoked",
      expiresAt: null,
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  if (isLaunchGiveawayClosed()) {
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: maxWinners,
      maxWinners,
      status: "slots_full",
      expiresAt: null,
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  if (!isFirstSteamLogin(user)) {
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: 0,
      maxWinners,
      status: "not_first_login",
      expiresAt: null,
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  const discordUserId =
    input.discordUserId?.trim() || user.discordUserId?.trim() || null;
  const discordUsername =
    input.discordUsername?.trim() || user.discordUsername?.trim() || null;

  // Discord gate kept intact — skipped when GIVEAWAY_REQUIRE_DISCORD is off.
  if (requireDiscord) {
    if (!discordUserId) {
      return {
        steamId: user.steamId,
        personaName: user.personaName,
        position: 0,
        maxWinners,
        status: "needs_discord",
        expiresAt: null,
        discordUserId: null,
        discordUsername: null,
      };
    }

    const { isDiscordGuildMember } = await import("@/lib/discord/guild");
    const inGuild = await isDiscordGuildMember(discordUserId);
    if (!inGuild) {
      return {
        steamId: user.steamId,
        personaName: user.personaName,
        position: 0,
        maxWinners,
        status: "not_in_guild",
        expiresAt: null,
        discordUserId,
        discordUsername,
      };
    }
  }

  const winnerCount = await countActiveGiveawayVips(now);

  if (winnerCount >= maxWinners) {
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: maxWinners,
      maxWinners,
      status: "slots_full",
      expiresAt: null,
      discordUserId,
      discordUsername,
    };
  }

  // Re-check after the slot count to shrink the login/offers race window.
  const raced = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    source: "GIVEAWAY",
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });
  if (raced) {
    const { grantManualVip } = await import("@/lib/payments/manual-vip-service");
    await grantManualVip({
      targetUserId: user._id,
      roleCode: "VIP",
      source: "GIVEAWAY",
      grantedBy: null,
      expiresAt: raced.expiresAt ?? giveawayVipExpiresAt(raced.grantedAt),
      entitlementKeys: [LAUNCH_GIVEAWAY_ENTITLEMENT_KEY],
      requestId: raced._id,
    });
    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: winnerCount,
      maxWinners,
      status: "already_granted",
      expiresAt: raced.expiresAt ?? giveawayVipExpiresAt(raced.grantedAt),
      discordUserId,
      discordUsername,
    };
  }

  const expiresAt = giveawayVipExpiresAt(now);

  const { grantManualVip } = await import("@/lib/payments/manual-vip-service");
  await grantManualVip({
    targetUserId: user._id,
    targetSteamId: user.steamId,
    roleCode: "VIP",
    source: "GIVEAWAY",
    grantedBy: null,
    expiresAt,
    // Launch VIP covers every retake server, matching the offer copy
    // ("priority access to all VIP server features").
    entitlementKeys: [LAUNCH_GIVEAWAY_ENTITLEMENT_KEY],
    requestId: crypto.randomUUID(),
  });

  try {
    const { recordPlayerActivity } = await import("@/lib/profile/activity");
    const claimHow = requireDiscord
      ? "signing in with Steam and joining Discord"
      : "signing in with Steam";
    await recordPlayerActivity({
      steamId: user.steamId,
      type: "won_giveaway",
      title: "Claimed launch VIP offer",
      description: `Earned ${getLaunchGiveawayVipMonths()} months of VIP by ${claimHow} during the launch offer.`,
      metadata: {
        requireDiscord,
        ...(discordUserId ? { discordUserId } : {}),
        ...(discordUsername ? { discordUsername } : {}),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[giveaway] activity sync failed", err);
  }

  return {
    steamId: user.steamId,
    personaName: user.personaName,
    position: winnerCount + 1,
    maxWinners,
    status: "granted",
    expiresAt,
    discordUserId,
    discordUsername,
  };
}

/** Legacy Discord bot entry point — wraps processLaunchGiveaway. */
export async function processGiveawayEntry(input: {
  steamId: string;
  discordUserId?: string;
  discordUsername?: string;
  maxWinners?: number;
}): Promise<GiveawayEntryResult> {
  const result = await processLaunchGiveaway(input);
  if (result.status === "slots_full") {
    throw new Error(
      `All ${result.maxWinners} VIP launch offer slots have been claimed. Thanks for joining WallBang!`,
    );
  }
  if (result.status === "ineligible") {
    throw new Error(
      "Owner and staff accounts are not eligible for the launch VIP offer.",
    );
  }
  if (result.status === "revoked") {
    throw new Error(
      "Launch VIP for this account was removed and will not be granted again.",
    );
  }
  if (result.status === "not_first_login") {
    throw new Error("Launch VIP is only granted on the first Steam login.");
  }
  if (result.status === "needs_discord") {
    throw new Error(
      "Link Discord on wallbang.xyz/offers after signing in with Steam.",
    );
  }
  if (result.status === "not_in_guild") {
    throw new Error(
      "Join the WallBang Discord server, then return to /offers to claim VIP.",
    );
  }
  return toLegacyGiveawayResult(result);
}

/**
 * When a Discord member joins the guild, grant VIP if they already linked
 * Discord to a Steam account on the site.
 */
export async function processDiscordMemberJoined(input: {
  discordUserId: string;
  discordUsername?: string;
}): Promise<LaunchGiveawayResult | null> {
  const { findUserByDiscordUserId, linkDiscordAccount } = await import(
    "@/lib/auth/users"
  );
  const user = await findUserByDiscordUserId(input.discordUserId);
  if (!user) return null;

  if (
    input.discordUsername &&
    input.discordUsername !== user.discordUsername
  ) {
    try {
      await linkDiscordAccount({
        userId: user._id,
        discordUserId: input.discordUserId,
        discordUsername: input.discordUsername,
      });
    } catch (err) {
      console.error("[giveaway] discord username refresh failed", err);
    }
  }

  return processLaunchGiveaway({
    steamId: user.steamId,
    discordUserId: input.discordUserId,
    discordUsername: input.discordUsername ?? user.discordUsername ?? undefined,
  });
}
