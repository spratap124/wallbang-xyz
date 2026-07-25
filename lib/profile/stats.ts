import type {
  PlayerStatsDoc,
  ProfileCompletion,
  ProfileCompletionItem,
  QuickStats,
} from "@/types/profile";

/** WallBang Rating v0 starting value. */
export const DEFAULT_RATING = 1000;

/** Rating change applied on each round win / loss (retakes-friendly). */
export const ROUND_WIN_RATING_DELTA = 2;
export const ROUND_LOSS_RATING_DELTA = -2;

export function emptyStats(steamId: string): Omit<PlayerStatsDoc, "_id"> {
  return {
    steamId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0,
    damage: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    roundsLost: 0,
    plants: 0,
    plantAttempts: 0,
    defuses: 0,
    defuseAttempts: 0,
    mvps: 0,
    rating: DEFAULT_RATING,
    hoursPlayed: 0,
    updatedAt: new Date(),
  };
}

/** Fill Phase 1 fields missing on docs created before the stats pipeline. */
export function normalizeStatsDoc(doc: PlayerStatsDoc): PlayerStatsDoc {
  const defaults = emptyStats(doc.steamId);
  return {
    ...defaults,
    ...doc,
    assists: doc.assists ?? 0,
    damage: doc.damage ?? 0,
    roundsPlayed: doc.roundsPlayed ?? 0,
    roundsWon: doc.roundsWon ?? 0,
    roundsLost: doc.roundsLost ?? 0,
    plants: doc.plants ?? 0,
    plantAttempts: doc.plantAttempts ?? 0,
    defuses: doc.defuses ?? 0,
    defuseAttempts: doc.defuseAttempts ?? 0,
    rating: doc.rating ?? DEFAULT_RATING,
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

export function toQuickStats(doc: PlayerStatsDoc): QuickStats {
  const s = normalizeStatsDoc(doc);
  const {
    matchesPlayed,
    wins,
    losses,
    kills,
    deaths,
    assists,
    headshots,
    damage,
    roundsPlayed,
    roundsWon,
    roundsLost,
    plants,
    plantAttempts,
    defuses,
    defuseAttempts,
    mvps,
    rating,
    hoursPlayed,
  } = s;

  return {
    matchesPlayed,
    wins,
    losses,
    winRate:
      matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : null,
    kills,
    deaths,
    assists,
    kd:
      deaths > 0
        ? Math.round((kills / deaths) * 100) / 100
        : kills > 0
          ? kills
          : null,
    headshots,
    headshotPercent:
      kills > 0 ? Math.round((headshots / kills) * 1000) / 10 : null,
    damage,
    adr:
      roundsPlayed > 0 ? Math.round((damage / roundsPlayed) * 10) / 10 : null,
    roundsPlayed,
    roundsWon,
    roundsLost,
    roundWinRate:
      roundsPlayed > 0
        ? Math.round((roundsWon / roundsPlayed) * 1000) / 10
        : null,
    plants,
    plantAttempts,
    defuses,
    defuseAttempts,
    mvps,
    rating,
    hoursPlayed,
  };
}

export function buildProfileCompletion(input: {
  hasAvatar: boolean;
  hasCountry: boolean;
  hasBio: boolean;
  hasFavoriteWeapon: boolean;
  hasFavoriteMap: boolean;
  hasPreferredSide: boolean;
  hasMatches: boolean;
}): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    { key: "avatar", label: "Steam avatar", done: input.hasAvatar },
    { key: "country", label: "Country", done: input.hasCountry },
    { key: "bio", label: "Bio", done: input.hasBio },
    {
      key: "favoriteWeapon",
      label: "Favorite weapon",
      done: input.hasFavoriteWeapon,
    },
    { key: "favoriteMap", label: "Favorite map", done: input.hasFavoriteMap },
    {
      key: "preferredSide",
      label: "Preferred side",
      done: input.hasPreferredSide,
    },
    { key: "matches", label: "Play a match", done: input.hasMatches },
  ];
  const filled = items.filter((i) => i.done).length;
  return {
    percent: Math.round((filled / items.length) * 100),
    items,
  };
}

/** @deprecated Prefer buildProfileCompletion */
export function computeProfileCompletion(
  input: Parameters<typeof buildProfileCompletion>[0],
): number {
  return buildProfileCompletion(input).percent;
}
