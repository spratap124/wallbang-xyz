import "server-only";

import { ensurePlayerIndexes, playersCollection } from "@/lib/rating/RatingRepository";
import { fetchSteamPlayerSummaries } from "@/lib/auth/steam-api";
import { playerStatsCollection } from "@/lib/profile/collections";
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
export async function getGlobalLeaderboard(limit = 100): Promise<{
  players: LeaderboardEntry[];
  activePlayers: number;
  totalMatches: number;
}> {
  await ensurePlayerIndexes();
  const col = await playersCollection();
  const statsCol = await playerStatsCollection();
  const players = await col.find({}, { projection: { _id: 0, steamId: 1, name: 1, avatar: 1, rating: 1, rank: 1, wins: 1, matchesPlayed: 1 } })
    .sort({ rating: -1, steamId: 1 }).limit(limit).toArray();
  const [stats, activePlayers, matchTotals] = await Promise.all([
    statsCol.find({ steamId: { $in: players.map((player) => player.steamId) } }, { projection: { _id: 0, steamId: 1, wins: 1, matchesPlayed: 1 } }).toArray(),
    statsCol.countDocuments({ matchesPlayed: { $gt: 0 } }),
    statsCol.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$matchesPlayed" } } }]).toArray(),
  ]);
  const statsBySteamId = new Map(stats.map((stat) => [stat.steamId, stat]));
  const enrichedPlayers = players.map((player) => {
    const stat = statsBySteamId.get(player.steamId);
    return {
      ...player,
      wins: stat?.wins ?? player.wins,
      matchesPlayed: stat?.matchesPlayed ?? player.matchesPlayed,
    };
  });
  const missingAvatars = enrichedPlayers.filter((player) => !player.avatar).map((player) => player.steamId);
  const totalMatches = matchTotals[0]?.total ?? 0;
  if (!missingAvatars.length) return { players: enrichedPlayers, activePlayers, totalMatches };

  try {
    const summaries = await fetchSteamPlayerSummaries(missingAvatars);
    const avatarBySteamId = new Map(summaries.map((summary) => [summary.steamId, summary.avatarUrl]));
    return { players: enrichedPlayers.map((player) => ({
      ...player,
      avatar: player.avatar || avatarBySteamId.get(player.steamId) || "",
    })), activePlayers, totalMatches };
  } catch {
    return { players: enrichedPlayers, activePlayers, totalMatches };
  }
}
