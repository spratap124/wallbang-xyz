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
import { getGameLoadoutForPlayer } from "@/lib/loadout/service";

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

  return {
    player: {
      steamId: resolved.steamId,
      username: resolved.personaName,
    },
    roles: resolved.roles,
    permissions: resolved.permissions,
    loadout,
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

/** Grant launch VIP after Steam login + Discord membership. Idempotent. */
export async function processLaunchGiveaway(input: {
  steamId: string;
  maxWinners?: number;
  discordUserId?: string;
  discordUsername?: string;
}): Promise<LaunchGiveawayResult> {
  await ready();

  const maxWinners = input.maxWinners ?? getLaunchGiveawayMaxWinners();
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

  const existingGiveaway = await col.findOne({
    userId: user._id,
    roleCode: "VIP",
    source: "GIVEAWAY",
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  if (existingGiveaway) {
    // Position = how many unique winners claimed at or before this grant.
    const earlierOrSame = await col.distinct("userId", {
      roleCode: "VIP",
      source: "GIVEAWAY",
      active: true,
      grantedAt: { $lte: existingGiveaway.grantedAt },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    return {
      steamId: user.steamId,
      personaName: user.personaName,
      position: earlierOrSame.length,
      maxWinners,
      status: "already_granted",
      expiresAt:
        existingGiveaway.expiresAt ??
        giveawayVipExpiresAt(existingGiveaway.grantedAt),
      discordUserId: user.discordUserId ?? null,
      discordUsername: user.discordUsername ?? null,
    };
  }

  const discordUserId =
    input.discordUserId?.trim() || user.discordUserId?.trim() || null;
  const discordUsername =
    input.discordUsername?.trim() || user.discordUsername?.trim() || null;

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
    await recordPlayerActivity({
      steamId: user.steamId,
      type: "won_giveaway",
      title: "Claimed launch VIP offer",
      description: `Earned ${getLaunchGiveawayVipMonths()} months of VIP by signing in with Steam and joining Discord during the launch offer.`,
      metadata: {
        discordUserId,
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
