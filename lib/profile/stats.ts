import type { PlayerStatsDoc, QuickStats } from "@/types/profile";

export function emptyStats(steamId: string): Omit<PlayerStatsDoc, "_id"> {
  return {
    steamId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    headshots: 0,
    mvps: 0,
    hoursPlayed: 0,
    updatedAt: new Date(),
  };
}

export function toQuickStats(doc: PlayerStatsDoc): QuickStats {
  const { matchesPlayed, wins, losses, kills, deaths, headshots, mvps, hoursPlayed } =
    doc;

  return {
    matchesPlayed,
    wins,
    losses,
    winRate:
      matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : null,
    kills,
    deaths,
    kd: deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills > 0 ? kills : null,
    headshots,
    headshotPercent:
      kills > 0 ? Math.round((headshots / kills) * 1000) / 10 : null,
    mvps,
    hoursPlayed,
  };
}

/** Rough completion: identity + optional prefs filled. */
export function computeProfileCompletion(input: {
  hasAvatar: boolean;
  hasCountry: boolean;
  hasBio: boolean;
  hasFavoriteWeapon: boolean;
  hasFavoriteMap: boolean;
  hasPreferredSide: boolean;
  hasMatches: boolean;
}): number {
  const checks = [
    input.hasAvatar,
    input.hasCountry,
    input.hasBio,
    input.hasFavoriteWeapon,
    input.hasFavoriteMap,
    input.hasPreferredSide,
    input.hasMatches,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
