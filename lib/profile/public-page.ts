import "server-only";

import type { AuthUser } from "@/types/auth";
import type { ProfilePageProfile } from "@/types/profile";
import type { ProfileDashboardExtras } from "@/types/profile-dashboard";
import {
  emptyProfileDashboard,
  getProfileDashboard,
} from "@/lib/profile/dashboard";
import type { ProfileServerMeta } from "@/types/profile-dashboard";
import { resolveCurrentServer } from "@/lib/profile/presence";
import {
  buildLimitedPublicProfile,
  canViewSteamId,
  isStaffViewer,
  isValidSteamId64,
  toPublicPlayerProfile,
} from "@/lib/profile/public";
import { readPublicPlayerStats, getPlayerProfile } from "@/lib/profile/service";
import { getPlayerServerActivity } from "@/lib/profile/sessions";
import { hasPermission } from "@/lib/permissions/service";
import { getGameServers } from "@/lib/servers/registry";

export type PlayerProfilePage = {
  profile: ProfilePageProfile;
  dashboard: ProfileDashboardExtras;
  /** False when the SteamID has no WallBang account (staff-only view). */
  accountLinked: boolean;
};

/** Resolves viewer staff flags once so callers avoid repeated permission reads. */
async function viewerFlags(viewer: AuthUser | null): Promise<{
  isAdmin: boolean;
  isModerator: boolean;
}> {
  if (!viewer) return { isAdmin: false, isModerator: false };
  const [isAdmin, isModerator] = await Promise.all([
    hasPermission({ userId: viewer.id, permission: "admin_panel" }),
    hasPermission({ userId: viewer.id, permission: "moderation_access" }),
  ]);
  return { isAdmin, isModerator };
}

/**
 * Single entry point for the public player profile page.
 *
 * - Registered players: public profile via the allowlisted projection.
 * - Unregistered (in-game only) players: staff-only limited profile built from
 *   session/stats/presence data. Anonymous visitors get null (→ 404).
 */
export async function loadPlayerProfilePage(input: {
  steamId: string;
  viewer: AuthUser | null;
}): Promise<PlayerProfilePage | null> {
  if (!isValidSteamId64(input.steamId)) return null;

  const { isAdmin, isModerator } = await viewerFlags(input.viewer);
  const staff = isStaffViewer({ isAdmin, isModerator });

  const profile = await getPlayerProfile(input.steamId, input.viewer);

  if (profile) {
    const showSteamId = canViewSteamId({
      isOwner: profile.isOwner,
      isAdmin,
      isModerator,
    });
    const pageProfile: ProfilePageProfile = profile.isOwner
      ? { ...profile, showSteamId, accountLinked: true }
      : {
          ...(toPublicPlayerProfile(profile) as ProfilePageProfile),
          isOwner: false,
          showSteamId,
          accountLinked: true,
        };

    const dashboard = await getProfileDashboard({
      userId: profile.userId,
      steamId: profile.steamId,
      fallbackVip: profile.isVip,
      joinedAt: profile.joinedAt,
    });

    return { profile: pageProfile, dashboard, accountLinked: true };
  }

  // No WallBang account: staff only, from game data alone.
  if (!staff) return null;

  const [activity, stats, currentServer, servers] = await Promise.all([
    getPlayerServerActivity(input.steamId).catch(() => null),
    readPublicPlayerStats(input.steamId).catch(() => null),
    resolveCurrentServer(input.steamId).catch(() => null),
    getGameServers().catch(() => []),
  ]);

  const serverMeta: ProfileServerMeta[] = servers.map((server) => ({
    id: server.id,
    city: server.city,
    region: server.region,
    mode: server.mode,
  }));

  const limited = buildLimitedPublicProfile({
    steamId: input.steamId,
    // Anyone who reaches here is staff, so the ID is always shown.
    showSteamId: true,
    stats,
    activity,
    currentServer,
  });

  return {
    profile: limited,
    dashboard: emptyProfileDashboard({ serverMeta }),
    accountLinked: false,
  };
}
