import "server-only";

import type { AuthUser } from "@/types/auth";
import type { RoleCode } from "@/types/permissions";
import type {
  PatchProfileInput,
  PlayerActivityDoc,
  PlayerBadgeDoc,
  PlayerProfileDoc,
  PlayerProfileView,
  PlayerSettingsDoc,
  PlayerStatsDoc,
  PrivacySettings,
  ProfileBadge,
  QuickStats,
} from "@/types/profile";
import { findUserBySteamId } from "@/lib/auth/users";
import { getUserPermissions } from "@/lib/permissions/service";
import { badgeLabel, ROLE_TO_BADGE } from "@/lib/profile/badges";
import {
  ensureProfileIndexes,
  playerActivityCollection,
  playerBadgesCollection,
  playerProfilesCollection,
  playerSettingsCollection,
  playerStatsCollection,
} from "@/lib/profile/collections";
import {
  buildProfileCompletion,
  emptyStats,
  toQuickStats,
} from "@/lib/profile/stats";
import { resolveCurrentServer } from "@/lib/profile/presence";
import { grantPlayerBadge as grantBadgeInternal } from "@/lib/profile/activity";
import { canViewerAccess } from "@/lib/profile/privacy";

const STEAM_ID64_RE = /^\d{17}$/;

export const DEFAULT_PRIVACY: PrivacySettings = {
  stats: "public",
  matchHistory: "public",
  steamInventory: "public",
  activity: "public",
};

export function isValidSteamId64(steamId: string): boolean {
  return STEAM_ID64_RE.test(steamId);
}

function defaultSettings(steamId: string): Omit<PlayerSettingsDoc, "_id"> {
  return {
    steamId,
    privacy: { ...DEFAULT_PRIVACY },
    theme: "dark",
    notificationsEnabled: true,
    updatedAt: new Date(),
  };
}

/** Ensure Player-domain docs exist after auth (or first profile visit). */
export async function ensurePlayerDomain(
  user: AuthUser,
): Promise<PlayerProfileDoc> {
  await ensureProfileIndexes();
  const now = new Date();
  const profiles = await playerProfilesCollection();
  const existing = await profiles.findOne({ steamId: user.steamId });
  if (existing) return existing;

  const profile: PlayerProfileDoc = {
    _id: crypto.randomUUID(),
    userId: user.id,
    steamId: user.steamId,
    displayName: null,
    bannerUrl: null,
    countryCode: null,
    bio: null,
    profileViews: 0,
    preferredSide: null,
    favoriteWeapon: null,
    favoriteMap: null,
    createdAt: now,
    updatedAt: now,
  };

  await profiles.insertOne(profile);

  const [statsCol, settingsCol, activityCol] = await Promise.all([
    playerStatsCollection(),
    playerSettingsCollection(),
    playerActivityCollection(),
  ]);

  await Promise.all([
    statsCol.updateOne(
      { steamId: user.steamId },
      {
        $setOnInsert: {
          _id: crypto.randomUUID(),
          ...emptyStats(user.steamId),
        },
      },
      { upsert: true },
    ),
    settingsCol.updateOne(
      { steamId: user.steamId },
      {
        $setOnInsert: {
          _id: crypto.randomUUID(),
          ...defaultSettings(user.steamId),
        },
      },
      { upsert: true },
    ),
    activityCol.insertOne({
      _id: crypto.randomUUID(),
      steamId: user.steamId,
      type: "joined",
      title: "Joined WallBang",
      description: "Welcome to the community.",
      metadata: null,
      createdAt: now,
    } satisfies PlayerActivityDoc),
  ]);

  return profile;
}

async function loadStats(steamId: string): Promise<PlayerStatsDoc> {
  const col = await playerStatsCollection();
  const doc = await col.findOne({ steamId });
  if (doc) return doc;
  const created: PlayerStatsDoc = {
    _id: crypto.randomUUID(),
    ...emptyStats(steamId),
  };
  await col.insertOne(created);
  return created;
}

async function loadSettings(steamId: string): Promise<PlayerSettingsDoc> {
  const col = await playerSettingsCollection();
  const doc = await col.findOne({ steamId });
  if (doc) return doc;
  const created: PlayerSettingsDoc = {
    _id: crypto.randomUUID(),
    ...defaultSettings(steamId),
  };
  await col.insertOne(created);
  return created;
}

async function loadBadges(
  steamId: string,
  roles: RoleCode[],
): Promise<ProfileBadge[]> {
  const col = await playerBadgesCollection();
  const stored = await col.find({ steamId }).sort({ grantedAt: -1 }).toArray();

  const byType = new Map<string, ProfileBadge>();
  for (const b of stored) {
    byType.set(b.badgeType, {
      type: b.badgeType,
      label: badgeLabel(b.badgeType),
      grantedAt: b.grantedAt.toISOString(),
    });
  }

  // Seed display badges from active RBAC roles when no stored badge exists.
  for (const role of roles) {
    const badgeType = ROLE_TO_BADGE[role];
    if (badgeType && !byType.has(badgeType)) {
      byType.set(badgeType, {
        type: badgeType,
        label: badgeLabel(badgeType),
        grantedAt: new Date(0).toISOString(),
      });
    }
  }

  return Array.from(byType.values());
}

function redactStatsForPrivacy(
  stats: QuickStats,
  privacy: PrivacySettings,
  isOwner: boolean,
): QuickStats {
  if (canViewerAccess(privacy.stats, isOwner)) return stats;
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    kills: 0,
    deaths: 0,
    kd: null,
    headshots: 0,
    headshotPercent: null,
    mvps: 0,
    hoursPlayed: 0,
  };
}

type GetProfileOptions = {
  /** Count a public profile view (default true for page/API profile reads). */
  incrementViews?: boolean;
};

export async function getPlayerProfile(
  steamId: string,
  viewer: AuthUser | null,
  options: GetProfileOptions = {},
): Promise<PlayerProfileView | null> {
  if (!isValidSteamId64(steamId)) return null;

  await ensureProfileIndexes();
  const user = await findUserBySteamId(steamId);
  if (!user) return null;

  const authUser = {
    id: user._id,
    steamId: user.steamId,
    personaName: user.personaName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
  };
  const profile = await ensurePlayerDomain(authUser);
  const isOwner = viewer?.steamId === steamId;
  const shouldIncrement = options.incrementViews !== false && !isOwner;

  if (shouldIncrement) {
    const profiles = await playerProfilesCollection();
    await profiles.updateOne(
      { steamId },
      { $inc: { profileViews: 1 }, $set: { updatedAt: new Date() } },
    );
    profile.profileViews += 1;
  }

  const [resolved, statsDoc, settings] = await Promise.all([
    getUserPermissions({ steamId }),
    loadStats(steamId),
    loadSettings(steamId),
  ]);

  const role: RoleCode = resolved?.displayRole ?? user.role ?? "USER";
  const roles = resolved?.roles ?? [role];
  const permissions = resolved?.permissions ?? [];
  const isVip =
    roles.includes("VIP") ||
    roles.includes("FOUNDING_MEMBER") ||
    permissions.includes("website_badge");
  const showWebsiteBadge = permissions.includes("website_badge") || isVip;

  const badges = await loadBadges(steamId, roles);
  const stats = redactStatsForPrivacy(
    toQuickStats(statsDoc),
    settings.privacy,
    isOwner,
  );

  const displayName = profile.displayName?.trim() || user.personaName;
  const completion = buildProfileCompletion({
    hasAvatar: Boolean(user.avatarUrl),
    hasCountry: Boolean(profile.countryCode),
    hasBio: Boolean(profile.bio),
    hasFavoriteWeapon: Boolean(profile.favoriteWeapon),
    hasFavoriteMap: Boolean(profile.favoriteMap),
    hasPreferredSide: Boolean(profile.preferredSide),
    hasMatches: statsDoc.matchesPlayed > 0,
  });
  const currentServer = await resolveCurrentServer(steamId);

  return {
    steamId: user.steamId,
    userId: user._id,
    personaName: user.personaName,
    displayName,
    avatarUrl: user.avatarUrl,
    steamProfileUrl: user.profileUrl,
    bannerUrl: profile.bannerUrl,
    countryCode: profile.countryCode,
    bio: profile.bio,
    role,
    isVip,
    showWebsiteBadge,
    joinedAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
    profileViews: profile.profileViews,
    isOwner,
    summary: {
      steamId: user.steamId,
      memberSince: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt.toISOString(),
      role,
      profileCompletion: completion.percent,
      completion,
      currentServer,
      favoriteWeapon: profile.favoriteWeapon,
      favoriteMap: profile.favoriteMap,
      preferredSide: profile.preferredSide,
    },
    stats,
    badges,
    privacy: settings.privacy,
  };
}

export async function getMyProfile(
  viewer: AuthUser,
): Promise<PlayerProfileView | null> {
  await ensurePlayerDomain(viewer);
  return getPlayerProfile(viewer.steamId, viewer);
}

export async function patchPlayerProfile(
  viewer: AuthUser,
  input: PatchProfileInput,
): Promise<PlayerProfileView | null> {
  await ensurePlayerDomain(viewer);
  const now = new Date();
  const profiles = await playerProfilesCollection();

  const profileSet: Record<string, unknown> = { updatedAt: now };
  if (input.displayName !== undefined) {
    profileSet.displayName = input.displayName?.trim() || null;
  }
  if (input.bio !== undefined) {
    profileSet.bio = input.bio?.trim() || null;
  }
  if (input.countryCode !== undefined) {
    profileSet.countryCode = input.countryCode?.trim().toUpperCase() || null;
  }
  if (input.preferredSide !== undefined) {
    profileSet.preferredSide = input.preferredSide;
  }
  if (input.favoriteWeapon !== undefined) {
    profileSet.favoriteWeapon = input.favoriteWeapon?.trim() || null;
  }
  if (input.favoriteMap !== undefined) {
    profileSet.favoriteMap = input.favoriteMap?.trim() || null;
  }

  if (Object.keys(profileSet).length > 1) {
    await profiles.updateOne(
      { steamId: viewer.steamId },
      { $set: profileSet },
    );
  }

  if (
    input.privacy !== undefined ||
    input.theme !== undefined ||
    input.notificationsEnabled !== undefined
  ) {
    const settings = await playerSettingsCollection();
    const settingsSet: Record<string, unknown> = { updatedAt: now };
    if (input.theme !== undefined) settingsSet.theme = input.theme;
    if (input.notificationsEnabled !== undefined) {
      settingsSet.notificationsEnabled = input.notificationsEnabled;
    }
    if (input.privacy) {
      for (const [key, value] of Object.entries(input.privacy)) {
        if (value) settingsSet[`privacy.${key}`] = value;
      }
    }
    await settings.updateOne(
      { steamId: viewer.steamId },
      { $set: settingsSet },
      { upsert: true },
    );
  }

  return getPlayerProfile(viewer.steamId, viewer);
}

export async function getPlayerActivity(
  steamId: string,
  limit = 20,
): Promise<PlayerActivityDoc[]> {
  if (!isValidSteamId64(steamId)) return [];
  await ensureProfileIndexes();
  const col = await playerActivityCollection();
  return col.find({ steamId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getPlayerStats(
  steamId: string,
): Promise<QuickStats | null> {
  if (!isValidSteamId64(steamId)) return null;
  const user = await findUserBySteamId(steamId);
  if (!user) return null;
  await ensureProfileIndexes();
  const doc = await loadStats(steamId);
  return toQuickStats(doc);
}

export async function getPlayerBadges(
  steamId: string,
): Promise<ProfileBadge[]> {
  if (!isValidSteamId64(steamId)) return [];
  const user = await findUserBySteamId(steamId);
  if (!user) return [];
  await ensureProfileIndexes();
  const resolved = await getUserPermissions({ steamId });
  const roles = resolved?.roles ?? [user.role];
  return loadBadges(steamId, roles);
}

export async function grantPlayerBadge(input: {
  steamId: string;
  badgeType: PlayerBadgeDoc["badgeType"];
  grantedBy: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<PlayerBadgeDoc> {
  const { badge } = await grantBadgeInternal(input);
  return badge;
}

