/** Competitive match / round fact types (plugin → web ingest). */

export const MATCH_SIDES = ["T", "CT"] as const;
export type MatchSide = (typeof MATCH_SIDES)[number];

export const BOMB_SITES = ["A", "B"] as const;
export type BombSite = (typeof BOMB_SITES)[number];

export const MATCH_STATUSES = ["in_progress", "completed", "abandoned"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export type MatchDoc = {
  _id: string;
  /** Plugin-provided match id (same as `_id`). */
  matchId: string;
  serverId: string;
  serverName: string | null;
  map: string;
  mode: "retakes";
  status: MatchStatus;
  startedAt: Date;
  endedAt: Date | null;
  /** Round wins for T / CT when the match ends (plugin-reported). */
  scoreT: number | null;
  scoreCT: number | null;
  winner: MatchSide | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoundDoc = {
  _id: string;
  matchId: string;
  round: number;
  winner: MatchSide;
  site: BombSite | null;
  bombPlanted: boolean;
  bombDefused: boolean;
  durationMs: number | null;
  endedAt: Date;
  createdAt: Date;
};

/**
 * One doc per player per round — source of truth for aggregates.
 * Re-ingesting the same (matchId, round, steamId) is a no-op for rollups.
 */
export type PlayerRoundStatsDoc = {
  _id: string;
  matchId: string;
  round: number;
  steamId: string;
  serverId: string;
  map: string;
  side: MatchSide;
  site: BombSite | null;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  damageTaken: number;
  survived: boolean;
  won: boolean;
  mvp: boolean;
  planted: boolean;
  defused: boolean;
  plantAttempted: boolean;
  defuseAttempted: boolean;
  openingKill: boolean;
  openingDeath: boolean;
  /** Weapon → kill count this round (stored for Phase 2; not rolled up yet). */
  weapons: Record<string, number>;
  /** Set true after lifetime / map rollup applied. */
  rolledUp: boolean;
  rolledUpAt: Date | null;
  createdAt: Date;
};

/** Denormalized per-map lifetime rollup. */
export type PlayerMapStatsDoc = {
  _id: string;
  steamId: string;
  map: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  plants: number;
  defuses: number;
  mvps: number;
  updatedAt: Date;
};

/** Rating sample after a completed match (for history graphs). */
export type PlayerRatingHistoryDoc = {
  _id: string;
  steamId: string;
  matchId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  createdAt: Date;
};

/** Player payload inside a round ingest batch. */
export type PlayerRoundIngest = {
  steamId: string;
  side: MatchSide;
  site?: BombSite | null;
  kills?: number;
  deaths?: number;
  assists?: number;
  headshots?: number;
  damage?: number;
  damageTaken?: number;
  survived?: boolean;
  won: boolean;
  mvp?: boolean;
  planted?: boolean;
  defused?: boolean;
  plantAttempted?: boolean;
  defuseAttempted?: boolean;
  openingKill?: boolean;
  openingDeath?: boolean;
  weapons?: Record<string, number>;
};
