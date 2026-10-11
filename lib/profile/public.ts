import type {
  PlayerProfileView,
  PublicPlayerProfile,
  PublicPlayerSummary,
} from "@/types/profile";

const STEAM_ID64_RE = /^\d{17}$/;

/** SteamID64 is always a 17-digit decimal string at API boundaries. */
export function isValidSteamId64(steamId: string): boolean {
  return STEAM_ID64_RE.test(steamId);
}

/**
 * Explicit allowlist of fields that may be returned to an anonymous visitor.
 * Kept as data so tests can assert the projection never grows by accident.
 */
export const PUBLIC_PROFILE_FIELDS = [
  "steamId",
  "displayName",
  "avatarUrl",
  "steamProfileUrl",
  "bannerUrl",
  "countryCode",
  "bio",
  "role",
  "isVip",
  "showWebsiteBadge",
  "joinedAt",
  "lastLoginAt",
  "profileViews",
  "stats",
  "statsHidden",
  "serverActivity",
  "badges",
  "summary",
] as const;

/** Fields that must never appear in a public response. */
export const PRIVATE_PROFILE_FIELDS = [
  "userId",
  "privacy",
  "isOwner",
  "personaName",
] as const;

/**
 * SteamID64 is only shown to the account owner and to admins; public visitors
 * see the profile without it.
 */
export function canViewSteamId(input: {
  isOwner: boolean;
  isAdmin: boolean;
}): boolean {
  return input.isOwner || input.isAdmin;
}

/**
 * Drops the SteamID64 (and the Steam profile URL, which embeds it) for
 * viewers who are not allowed to see the ID. Used for anonymous API payloads;
 * the profile page still renders the Steam link as an explicit navigation
 * control.
 */
export function toAnonymousPublicProfile(
  profile: PublicPlayerProfile,
): Omit<PublicPlayerProfile, "steamId" | "steamProfileUrl"> {
  const { steamId: _steamId, steamProfileUrl: _steamProfileUrl, ...rest } =
    profile;
  void _steamId;
  void _steamProfileUrl;
  return rest;
}

function toPublicSummary(summary: PublicPlayerSummary): PublicPlayerSummary {
  return {
    memberSince: summary.memberSince,
    lastLoginAt: summary.lastLoginAt,
    role: summary.role,
    favoriteWeapon: summary.favoriteWeapon,
    favoriteMap: summary.favoriteMap,
    preferredSide: summary.preferredSide,
    currentServer: summary.currentServer
      ? {
          serverId: summary.currentServer.serverId,
          serverName: summary.currentServer.serverName,
          map: summary.currentServer.map,
          players: summary.currentServer.players,
          maxPlayers: summary.currentServer.maxPlayers,
          connectUrl: summary.currentServer.connectUrl,
          ip: summary.currentServer.ip,
          updatedAt: summary.currentServer.updatedAt,
        }
      : null,
  };
}

/**
 * Projects an aggregate profile view down to public fields.
 * Returns null when the profile is unknown (callers answer 404/notFound),
 * so the "unknown player" path never leaks internal identifiers.
 */
export function toPublicPlayerProfile(
  profile: PlayerProfileView | null,
): PublicPlayerProfile | null {
  if (!profile) return null;

  return {
    steamId: profile.steamId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    steamProfileUrl: profile.steamProfileUrl,
    bannerUrl: profile.bannerUrl,
    countryCode: profile.countryCode,
    bio: profile.bio,
    role: profile.role,
    isVip: profile.isVip,
    showWebsiteBadge: profile.showWebsiteBadge,
    joinedAt: profile.joinedAt,
    lastLoginAt: profile.lastLoginAt,
    profileViews: profile.profileViews,
    stats: profile.stats,
    statsHidden: profile.statsHidden ?? false,
    serverActivity: profile.serverActivity ?? null,
    badges: profile.badges,
    summary: toPublicSummary(profile.summary),
  };
}
