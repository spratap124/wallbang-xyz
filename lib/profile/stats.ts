import type {
  ProfileCompletion,
  ProfileCompletionItem,
} from "@/types/profile";
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
  const {
    matchesPlayed,
    wins,
    losses,
    kills,
    deaths,
    headshots,
    mvps,
    hoursPlayed,
  } = doc;

  return {
    matchesPlayed,
    wins,
    losses,
    winRate:
      matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : null,
    kills,
    deaths,
    kd:
      deaths > 0
        ? Math.round((kills / deaths) * 100) / 100
        : kills > 0
          ? kills
          : null,
    headshots,
    headshotPercent:
      kills > 0 ? Math.round((headshots / kills) * 1000) / 10 : null,
    mvps,
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
