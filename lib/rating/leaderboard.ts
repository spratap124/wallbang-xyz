import "server-only";

import { unstable_cache } from "next/cache";
import { fetchSteamPlayerSummaries } from "@/lib/auth/steam-api";
import { ensurePlayerIndexes, playersCollection } from "@/lib/rating/RatingRepository";
import type { PlayerDoc } from "@/types/rating";

export type LeaderboardEntry = {
  steamId: string;
  name: string;
  avatar: string;
  rating: number;
  rank: PlayerDoc["rank"];
  wins: number;
  matchesPlayed: number;
};

/** Public leaderboard uses stored rating, descending, then SteamID ascending. */
export async function getGlobalLeaderboard(limit = 100): Promise<{ players: LeaderboardEntry[] }> {
  return getCachedGlobalLeaderboard(limit);
}

const getCachedGlobalLeaderboard = unstable_cache(
  async (limit: number) => {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    const players = await col
      .find(
        {},
        {
          projection: {
            _id: 0,
            steamId: 1,
            name: 1,
            avatar: 1,
            rating: 1,
            rank: 1,
            wins: 1,
            matchesPlayed: 1,
          },
        },
      )
      .sort({ rating: -1, steamId: 1 })
      .limit(limit)
      .toArray();
    const missingAvatars = players
      .filter((player) => !player.avatar)
      .map((player) => player.steamId);
    if (!missingAvatars.length) return { players };

    const summaries = await fetchSteamPlayerSummaries(missingAvatars).catch(() => []);
    const avatarBySteamId = new Map(
      summaries.map((summary) => [summary.steamId, summary.avatarUrl]),
    );
    return {
      players: players.map((player) => ({
        ...player,
        avatar: player.avatar || avatarBySteamId.get(player.steamId) || "",
      })),
    };
  },
  ["global-leaderboard-v1"],
  { revalidate: 60, tags: ["global-leaderboard"] },
);
