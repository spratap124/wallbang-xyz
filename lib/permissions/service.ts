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
  isRoleCode,
  parseOwnerSteamIds,
  ROLE_PRIORITY,
} from "@/lib/permissions/constants";
import { seedPermissionsCatalog } from "@/lib/permissions/seed";
import {
  findUserById,
  findUserBySteamId,
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
  return resolved;
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
        .filter((log) => !log.targetPersonaName)
        .map((log) => log.targetUserId),
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
    log.targetPersonaName
      ? log
      : {
          ...log,
          targetPersonaName: nameById.get(log.targetUserId) ?? null,
        },
  );
}

export async function getPlayerPermissions(
  steamId: string,
): Promise<PlayerPermissionsResponse | null> {
  const resolved = await getUserPermissions({ steamId });
  if (!resolved) {
    return {
      player: { steamId, username: "" },
      roles: [],
      permissions: [],
    };
  }

  return {
    player: {
      steamId: resolved.steamId,
      username: resolved.personaName,
    },
    roles: resolved.roles,
    permissions: resolved.permissions,
  };
}

export function refreshCache(steamId: string): void {
  invalidatePermissionCache(steamId);
}
