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
  findUserById,
  findUserBySteamId,
  listUsers as listUserDocs,
  searchUsers as searchUserDocs,
  toAuthUser,
  updateUserDisplayRole,
  type UserDoc,
} from "@/lib/auth/users";
import type {
  AuditLogDoc,
  PermissionCode,
  PlayerPermissionsResponse,
  ResolvedPermissions,
  RoleCode,
  RoleSource,
  UserRoleDoc,
} from "@/types/permissions";
import { durationDaysToMs } from "@/lib/payments/expiry";
import { getGameLoadoutForPlayer } from "@/lib/loadout/service";

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === 11000,
  );
}

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
};

export async function grantRole(input: GrantRoleInput): Promise<ResolvedPermissions> {
  await ready();

  if (!isRoleCode(input.roleCode)) {
    throw new Error("Invalid role code.");
  }

  const user = input.targetUserId
    ? await findUserById(input.targetUserId)
    : input.targetSteamId
      ? await findUserBySteamId(input.targetSteamId)
      : null;

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

  // Deactivate any existing active assignment for the same role (replace).
  await col.updateMany(
    { userId: user._id, roleCode: input.roleCode, active: true },
    { $set: { active: false } },
  );

  const assignment: UserRoleDoc = {
    _id: crypto.randomUUID(),
    userId: user._id,
    roleId: role._id,
    roleCode: input.roleCode,
    source: input.source,
    grantedBy: input.grantedBy?.id ?? null,
    grantedAt: new Date(),
    expiresAt,
    active: true,
  };

  await col.insertOne(assignment);
  invalidatePermissionCache(user.steamId);

  if (input.roleCode === "VIP" && input.source !== "PURCHASE") {
    await syncComplimentaryVipEntitlement({
      userId: user._id,
      steamId: user.steamId,
      expiresAt,
      assignmentId: assignment._id,
    });
  }

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

export type ExtendVipExpiryInput = {
  userId: string;
  durationDays: number;
  source: RoleSource;
  grantedBy: { id: string; steamId: string } | null;
};

export type VipExtensionResult = {
  startDate: Date;
  endDate: Date;
  assignmentId: string;
  lifetime: boolean;
};

export type EnsureVipCoversUntilInput = {
  userId: string;
  coversUntil: Date;
  source: RoleSource;
  grantedBy: { id: string; steamId: string } | null;
};

/**
 * Ensure the global VIP role lasts at least until `coversUntil`.
 * Does not add days blindly — used after per-entitlement stacking so buying
 * Retake #2 does not inflate Retake #1 remaining onto the role calendar.
 *
 * Important: never create a second VIP row via grantRole while any VIP assignment
 * exists — grantRole deactivates prior VIP and drops remaining paid time.
 */
export async function ensureVipCoversUntil(
  input: EnsureVipCoversUntilInput,
): Promise<{ assignmentId: string; expiresAt: Date | null; lifetime: boolean }> {
  await ready();

  const user = await findUserById(input.userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const now = new Date();
  const coversUntil = input.coversUntil;
  const col = await userRolesCollection();

  const lifetime = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    active: true,
    expiresAt: null,
  });
  if (lifetime) {
    return {
      assignmentId: lifetime._id,
      expiresAt: null,
      lifetime: true,
    };
  }

  const active = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    active: true,
    expiresAt: { $gt: now },
  });

  if (active?.expiresAt && active.expiresAt.getTime() >= coversUntil.getTime()) {
    return {
      assignmentId: active._id,
      expiresAt: active.expiresAt,
      lifetime: false,
    };
  }

  if (active) {
    await col.updateOne(
      { _id: active._id },
      { $set: { expiresAt: coversUntil, source: input.source } },
    );
    invalidatePermissionCache(user.steamId);
    await writeAudit({
      adminId: input.grantedBy?.id ?? null,
      adminSteamId: input.grantedBy?.steamId ?? null,
      action: "GRANT_ROLE",
      targetUserId: user._id,
      targetSteamId: user.steamId,
      targetPersonaName: user.personaName,
      oldValue: {
        roleCode: "VIP",
        expiresAt: active.expiresAt,
        assignmentId: active._id,
      },
      newValue: {
        roleCode: "VIP",
        source: input.source,
        expiresAt: coversUntil,
        assignmentId: active._id,
        coversUntil: true,
      },
      timestamp: new Date(),
    });
    const resolved = await resolveFromUser(user);
    await syncDisplayRole(user._id, resolved.roles);
    return {
      assignmentId: active._id,
      expiresAt: coversUntil,
      lifetime: false,
    };
  }

  const existingVip = await col.findOne(
    { userId: user._id, roleCode: "VIP" },
    { sort: { expiresAt: -1, grantedAt: -1 } },
  );

  if (existingVip) {
    await col.updateMany(
      {
        userId: user._id,
        roleCode: "VIP",
        _id: { $ne: existingVip._id },
        active: true,
      },
      { $set: { active: false } },
    );
    await col.updateOne(
      { _id: existingVip._id },
      {
        $set: {
          active: true,
          expiresAt: coversUntil,
          source: input.source,
        },
      },
    );
    invalidatePermissionCache(user.steamId);
    await writeAudit({
      adminId: input.grantedBy?.id ?? null,
      adminSteamId: input.grantedBy?.steamId ?? null,
      action: "GRANT_ROLE",
      targetUserId: user._id,
      targetSteamId: user.steamId,
      targetPersonaName: user.personaName,
      oldValue: {
        roleCode: "VIP",
        expiresAt: existingVip.expiresAt,
        assignmentId: existingVip._id,
        active: existingVip.active,
      },
      newValue: {
        roleCode: "VIP",
        source: input.source,
        expiresAt: coversUntil,
        assignmentId: existingVip._id,
        revived: true,
      },
      timestamp: new Date(),
    });
    const resolved = await resolveFromUser(user);
    await syncDisplayRole(user._id, resolved.roles);
    return {
      assignmentId: existingVip._id,
      expiresAt: coversUntil,
      lifetime: false,
    };
  }

  const resolved = await grantRole({
    targetUserId: user._id,
    roleCode: "VIP",
    source: input.source,
    grantedBy: input.grantedBy,
    expiresAt: coversUntil,
  });
  const assignment = resolved.activeAssignments.find((a) => a.roleCode === "VIP");
  return {
    assignmentId: assignment?.id ?? resolved.userId,
    expiresAt: assignment?.expiresAt ?? coversUntil,
    lifetime: false,
  };
}

/**
 * Stack prepaid VIP onto an active VIP expiry, or grant VIP from now if expired.
 * Concurrent captured payments serialize on the user_roles document via pipeline $add.
 *
 * Prefer ensureVipCoversUntil for purchases: VIP days are per entitlement (server /
 * All Retakes), and the global role should only cover the furthest entitlement end.
 *
 * Important: never create a second VIP row via grantRole while any VIP assignment
 * exists — grantRole deactivates prior VIP and drops remaining paid time.
 */
export async function extendVipExpiry(
  input: ExtendVipExpiryInput,
): Promise<VipExtensionResult> {
  await ready();

  const user = await findUserById(input.userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const durationMs = durationDaysToMs(input.durationDays);
  const now = new Date();
  const col = await userRolesCollection();

  const extendActive = async (): Promise<UserRoleDoc | null> => {
    return col.findOneAndUpdate(
      {
        userId: user._id,
        roleCode: "VIP",
        active: true,
        expiresAt: { $gt: now },
      },
      [{ $set: { expiresAt: { $add: ["$expiresAt", durationMs] } } }],
      { returnDocument: "after" },
    );
  };

  const updated = await extendActive();
  if (updated?.expiresAt) {
    invalidatePermissionCache(user.steamId);
    const startDate = new Date(updated.expiresAt.getTime() - durationMs);
    await writeAudit({
      adminId: input.grantedBy?.id ?? null,
      adminSteamId: input.grantedBy?.steamId ?? null,
      action: "GRANT_ROLE",
      targetUserId: user._id,
      targetSteamId: user.steamId,
      targetPersonaName: user.personaName,
      oldValue: {
        roleCode: "VIP",
        expiresAt: startDate,
        assignmentId: updated._id,
      },
      newValue: {
        roleCode: "VIP",
        source: updated.source,
        expiresAt: updated.expiresAt,
        assignmentId: updated._id,
        stacked: true,
      },
      timestamp: new Date(),
    });
    const resolved = await resolveFromUser(user);
    await syncDisplayRole(user._id, resolved.roles);
    return {
      startDate,
      endDate: updated.expiresAt,
      assignmentId: updated._id,
      lifetime: false,
    };
  }

  const lifetime = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    active: true,
    expiresAt: null,
  });
  if (lifetime) {
    return {
      startDate: now,
      endDate: new Date(now.getTime() + durationMs),
      assignmentId: lifetime._id,
      lifetime: true,
    };
  }

  // Revive the best existing VIP row (including inactive) instead of grantRole,
  // which would deactivate prior paid VIP and start a fresh shorter term.
  const existingVip = await col.findOne(
    { userId: user._id, roleCode: "VIP" },
    { sort: { expiresAt: -1, grantedAt: -1 } },
  );

  if (existingVip) {
    const base =
      existingVip.expiresAt && existingVip.expiresAt.getTime() > now.getTime()
        ? existingVip.expiresAt
        : now;
    const endDate = new Date(base.getTime() + durationMs);

    await col.updateMany(
      {
        userId: user._id,
        roleCode: "VIP",
        _id: { $ne: existingVip._id },
        active: true,
      },
      { $set: { active: false } },
    );

    await col.updateOne(
      { _id: existingVip._id },
      {
        $set: {
          active: true,
          expiresAt: endDate,
          source: input.source,
        },
      },
    );

    invalidatePermissionCache(user.steamId);
    await writeAudit({
      adminId: input.grantedBy?.id ?? null,
      adminSteamId: input.grantedBy?.steamId ?? null,
      action: "GRANT_ROLE",
      targetUserId: user._id,
      targetSteamId: user.steamId,
      targetPersonaName: user.personaName,
      oldValue: {
        roleCode: "VIP",
        expiresAt: existingVip.expiresAt,
        assignmentId: existingVip._id,
        active: existingVip.active,
      },
      newValue: {
        roleCode: "VIP",
        source: input.source,
        expiresAt: endDate,
        assignmentId: existingVip._id,
        revived: !existingVip.active,
        stacked: Boolean(
          existingVip.expiresAt &&
            existingVip.expiresAt.getTime() > now.getTime(),
        ),
      },
      timestamp: new Date(),
    });

    const resolved = await resolveFromUser(user);
    await syncDisplayRole(user._id, resolved.roles);
    return {
      startDate: base,
      endDate,
      assignmentId: existingVip._id,
      lifetime: false,
    };
  }

  try {
    const resolved = await grantRole({
      targetUserId: user._id,
      roleCode: "VIP",
      source: input.source,
      grantedBy: input.grantedBy,
      expiresAt: new Date(now.getTime() + durationMs),
    });
    const assignment = resolved.activeAssignments.find(
      (a) => a.roleCode === "VIP",
    );
    return {
      startDate: now,
      endDate: assignment?.expiresAt ?? new Date(now.getTime() + durationMs),
      assignmentId: assignment?.id ?? resolved.userId,
      lifetime: false,
    };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const retried = await extendActive();
    if (!retried?.expiresAt) throw err;
    invalidatePermissionCache(user.steamId);
    return {
      startDate: new Date(retried.expiresAt.getTime() - durationMs),
      endDate: retried.expiresAt,
      assignmentId: retried._id,
      lifetime: false,
    };
  }
}

/** Pull VIP expiry back by a captured term (refunds / lost disputes). */
export async function subtractVipExpiry(input: {
  userId: string;
  durationDays: number;
}): Promise<Date | null> {
  await ready();
  const durationMs = durationDaysToMs(input.durationDays);
  const now = new Date();
  const col = await userRolesCollection();
  const user = await findUserById(input.userId);
  if (!user) return null;

  const updated = await col.findOneAndUpdate(
    {
      userId: input.userId,
      roleCode: "VIP",
      active: true,
      expiresAt: { $type: "date" },
    },
    [{ $set: { expiresAt: { $add: ["$expiresAt", -durationMs] } } }],
    { returnDocument: "after" },
  );

  if (!updated) return null;

  if (updated.expiresAt && updated.expiresAt <= now) {
    await col.updateOne({ _id: updated._id }, { $set: { active: false } });
  }

  invalidatePermissionCache(user.steamId);
  const resolved = await resolveFromUser(user);
  await syncDisplayRole(user._id, resolved.roles);
  return updated.expiresAt;
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

async function clearPurchasedVipRoles(userId: string): Promise<number> {
  const col = await userRolesCollection();
  const deactivate = await col.updateMany(
    { userId, roleCode: "VIP", active: true },
    { $set: { active: false } },
  );
  await col.updateMany(
    { userId, roleCode: "VIP" },
    { $set: { expiresAt: new Date(0) } },
  );
  return deactivate.modifiedCount;
}

/**
 * Align global VIP role expiry with remaining entitlements (may shorten).
 * Deactivates VIP when nothing remains.
 */
async function syncVipRoleToFurthestExpiry(input: {
  userId: string;
  steamId: string;
  furthest: Date | null;
  source: RoleSource;
}): Promise<{ deactivated: boolean; expiresAt: Date | null }> {
  const now = new Date();
  const col = await userRolesCollection();

  const lifetime = await col.findOne({
    userId: input.userId,
    roleCode: "VIP",
    active: true,
    expiresAt: null,
  });
  if (lifetime) {
    return { deactivated: false, expiresAt: null };
  }

  if (!input.furthest || input.furthest.getTime() <= now.getTime()) {
    const deactivated = await clearPurchasedVipRoles(input.userId);
    if (deactivated > 0) {
      invalidatePermissionCache(input.steamId);
    }
    return { deactivated: true, expiresAt: null };
  }

  const active = await col.findOne({
    userId: input.userId,
    roleCode: "VIP",
    active: true,
  });

  if (active) {
    await col.updateOne(
      { _id: active._id },
      { $set: { expiresAt: input.furthest, source: input.source } },
    );
    invalidatePermissionCache(input.steamId);
    return { deactivated: false, expiresAt: input.furthest };
  }

  await ensureVipCoversUntil({
    userId: input.userId,
    coversUntil: input.furthest,
    source: input.source,
    grantedBy: null,
  });
  return { deactivated: false, expiresAt: input.furthest };
}

/**
 * Testing / support: strip purchased VIP so membership UI and role match a clean slate.
 * Deactivates every VIP role row and deletes vip_history for the user.
 * Does not refund payments or touch FOUNDING_MEMBER.
 */
export async function revokeAllVipAccess(
  input: RevokeAllVipAccessInput,
): Promise<RevokeAllVipAccessResult> {
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
  const vipRows = await col
    .find({ userId: user._id, roleCode: "VIP" })
    .toArray();

  const deactivatedVipRoles = await clearPurchasedVipRoles(user._id);

  const { vipHistoryCollection } = await import("@/lib/payments/collections");
  const history = await vipHistoryCollection();
  const deleted = await history.deleteMany({ userId: user._id });

  invalidatePermissionCache(user.steamId);

  await writeAudit({
    adminId: input.revokedBy?.id ?? null,
    adminSteamId: input.revokedBy?.steamId ?? null,
    action: "REVOKE_VIP_ACCESS",
    targetUserId: user._id,
    targetSteamId: user.steamId,
    targetPersonaName: user.personaName,
    oldValue: {
      scope: "all",
      vipAssignments: vipRows.map((row) => ({
        id: row._id,
        active: row.active,
        source: row.source,
        expiresAt: row.expiresAt,
      })),
      historyRows: deleted.deletedCount,
    },
    newValue: {
      deactivatedVipRoles,
      deletedHistoryRows: deleted.deletedCount,
    },
    timestamp: new Date(),
  });

  const permissions = await resolveFromUser(user);
  await syncDisplayRole(user._id, permissions.roles);
  return {
    permissions,
    deactivatedVipRoles,
    deletedHistoryRows: deleted.deletedCount,
  };
}

export type RevokeVipEntitlementInput = {
  targetUserId?: string;
  targetSteamId?: string;
  /** Server id or `all_retakes`. */
  entitlementKey: string;
  revokedBy: { id: string; steamId: string } | null;
};

export type RevokeVipEntitlementResult = {
  permissions: ResolvedPermissions;
  entitlementKey: string;
  deletedHistoryRows: number;
  vipExpiresAt: Date | null;
  vipDeactivated: boolean;
};

/**
 * Testing / support: remove one server or All Retakes entitlement.
 * Deletes matching vip_history rows and resyncs the global VIP role to what remains.
 */
export async function revokeVipEntitlement(
  input: RevokeVipEntitlementInput,
): Promise<RevokeVipEntitlementResult> {
  await ready();

  const key = input.entitlementKey.trim();
  if (!key) {
    throw new Error("entitlementKey is required.");
  }

  const user = input.targetUserId
    ? await findUserById(input.targetUserId)
    : input.targetSteamId
      ? await findUserBySteamId(input.targetSteamId)
      : null;

  if (!user) {
    throw new Error("User not found.");
  }

  const {
    entitlementKeyFromRecord,
    furthestEntitlementExpiry,
  } = await import("@/lib/payments/entitlements-logic");
  const { vipHistoryCollection } = await import("@/lib/payments/collections");
  const historyCol = await vipHistoryCollection();
  const history = await historyCol.find({ userId: user._id }).toArray();
  const matchingIds = history
    .filter((record) => entitlementKeyFromRecord(record) === key)
    .map((record) => record._id);

  if (matchingIds.length === 0) {
    throw new Error(`No VIP history found for entitlement "${key}".`);
  }

  const deleted = await historyCol.deleteMany({
    userId: user._id,
    _id: { $in: matchingIds },
  });

  const remaining = await historyCol.find({ userId: user._id }).toArray();
  const furthest = furthestEntitlementExpiry(remaining);
  const synced = await syncVipRoleToFurthestExpiry({
    userId: user._id,
    steamId: user.steamId,
    furthest,
    source: "MANUAL",
  });

  await writeAudit({
    adminId: input.revokedBy?.id ?? null,
    adminSteamId: input.revokedBy?.steamId ?? null,
    action: "REVOKE_VIP_ACCESS",
    targetUserId: user._id,
    targetSteamId: user.steamId,
    targetPersonaName: user.personaName,
    oldValue: {
      scope: "entitlement",
      entitlementKey: key,
      historyIds: matchingIds,
    },
    newValue: {
      deletedHistoryRows: deleted.deletedCount,
      vipExpiresAt: synced.expiresAt,
      vipDeactivated: synced.deactivated,
    },
    timestamp: new Date(),
  });

  const permissions = await resolveFromUser(user);
  await syncDisplayRole(user._id, permissions.roles);
  return {
    permissions,
    entitlementKey: key,
    deletedHistoryRows: deleted.deletedCount,
    vipExpiresAt: synced.expiresAt,
    vipDeactivated: synced.deactivated,
  };
}

export async function searchUsers(query: string) {
  await ready();
  const docs = await searchUserDocs(query);
  return docs.map((doc) => ({
    ...toAuthUser(doc),
    role: doc.role ?? "USER",
    lastLoginAt: doc.lastLoginAt,
    createdAt: doc.createdAt,
  }));
}

export async function listUsers(limit?: number) {
  await ready();
  const docs = await listUserDocs(limit);
  return docs.map((doc) => ({
    ...toAuthUser(doc),
    role: doc.role ?? "USER",
    lastLoginAt: doc.lastLoginAt,
    createdAt: doc.createdAt,
  }));
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

  const { vipHistoryCollection } = await import("@/lib/payments/collections");
  const { hasActiveVipEntitlementForServer } = await import(
    "@/lib/payments/entitlements-logic"
  );
  const loadHistory = () =>
    vipHistoryCollection().then((col) =>
      col.find({ userId: resolved.userId }).toArray(),
    );

  let history = await loadHistory();
  let entitled = hasActiveVipEntitlementForServer({
    history,
    serverId: trimmed,
  });

  if (!entitled) {
    const vipAssignment = resolved.activeAssignments.find(
      (assignment) =>
        assignment.roleCode === "VIP" && assignment.source !== "PURCHASE",
    );
    if (vipAssignment) {
      await syncComplimentaryVipEntitlement({
        userId: resolved.userId,
        steamId: resolved.steamId,
        expiresAt: vipAssignment.expiresAt,
        assignmentId: vipAssignment.id,
      });
      history = await loadHistory();
      entitled = hasActiveVipEntitlementForServer({
        history,
        serverId: trimmed,
      });
    }
  }

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
  const parsed = Number.parseInt(process.env.GIVEAWAY_MAX_WINNERS ?? "100", 10);
  return Number.isFinite(parsed) ? parsed : 100;
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
  const claimed = await countActiveGiveawayVips();
  return {
    maxWinners,
    claimed,
    remaining: Math.max(0, maxWinners - claimed),
    vipMonths: getLaunchGiveawayVipMonths(),
  };
}

/**
 * Giveaway / admin VIP must write `vip_history` or in-game `?serverId=`
 * scoping treats the player as unentitled. Purchases already insert history.
 */
async function syncComplimentaryVipEntitlement(input: {
  userId: string;
  steamId: string;
  expiresAt: Date | null;
  assignmentId: string;
}): Promise<void> {
  try {
    const { ensureComplimentaryVipEntitlement } = await import(
      "@/lib/payments/entitlements"
    );
    await ensureComplimentaryVipEntitlement({
      userId: input.userId,
      steamId: input.steamId,
      expiresAt: input.expiresAt,
      paymentId: `complimentary:${input.assignmentId}`,
    });
  } catch (err) {
    console.error("[vip] complimentary vip_history sync failed", err);
  }
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

/** Grant launch VIP after Steam login (and Discord when required). Idempotent. */
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

    if (existingVip.roleCode === "VIP" && existingVip.source !== "PURCHASE") {
      await syncComplimentaryVipEntitlement({
        userId: user._id,
        steamId: user.steamId,
        expiresAt:
          existingVip.expiresAt ??
          (existingVip.source === "GIVEAWAY"
            ? giveawayVipExpiresAt(existingVip.grantedAt)
            : null),
        assignmentId: existingVip._id,
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
    await syncComplimentaryVipEntitlement({
      userId: user._id,
      steamId: user.steamId,
      expiresAt: raced.expiresAt ?? giveawayVipExpiresAt(raced.grantedAt),
      assignmentId: raced._id,
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

  await grantRole({
    targetSteamId: user.steamId,
    roleCode: "VIP",
    source: "GIVEAWAY",
    grantedBy: null,
    expiresAt,
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
