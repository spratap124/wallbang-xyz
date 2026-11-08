import "server-only";

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
export async function getGlobalLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  await ensurePlayerIndexes();
  const col = await playersCollection();
  return col.find({}, { projection: { _id: 0, steamId: 1, name: 1, avatar: 1, rating: 1, rank: 1, wins: 1, matchesPlayed: 1 } })
    .sort({ rating: -1, steamId: 1 }).limit(limit).toArray();
}
