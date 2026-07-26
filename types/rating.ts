/** WallBang Rating — event-driven scoreboard rating ownership. */

export const MATCH_SIDES = ["T", "CT"] as const;
export type MatchSide = (typeof MATCH_SIDES)[number];

/** Current RatingEvent payload version (bump when plugin contract evolves). */
export const RATING_EVENT_VERSION = 1 as const;
export type RatingEventVersion = typeof RATING_EVENT_VERSION;

/** Game mode keys for mode-scoped combat rollups. */
export const LIFETIME_STAT_MODES = ["retake"] as const;
export type LifetimeStatMode = (typeof LIFETIME_STAT_MODES)[number];

/** Named ranks on CS2 Premier–scale 5-digit rating (00000 = Iron; 15000 = Gold). */
export const RANK_NAMES = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Global",
] as const;

export type RankName = (typeof RANK_NAMES)[number];

/**
 * CS2 Premier–style scoreboard presentation.
 * Plugin renders `label` (e.g. "// 15200") tinted with `color`.
 */
export type PremierDisplay = {
  /** Same numeric rating, ready for Premier-style UI. */
  rating: number;
  /** Scoreboard string, e.g. "// 15200". */
  label: string;
  /** Hex color matching the named rank tier. */
  color: string;
  /** 0–255 RGB for CounterStrikeSharp / HTML paint. */
  colorRgb: { r: number; g: number; b: number };
};

/** Mode-scoped combat totals — avoids ambiguous global K/D across modes. */
export type LifetimeModeStats = {
  kills: number;
  deaths: number;
  assists: number;
};

export type LifetimeStats = {
  retake: LifetimeModeStats;
};

/**
 * `players` collection — sole source of truth for WallBang Rating.
 * Lean for MVP: no round/match documents; history lives in `rating_history`.
 */
export type PlayerDoc = {
  _id: string;
  steamId: string;
  name: string;
  avatar: string;
  rating: number;
  peakRating: number;
  rank: RankName;
  roundsPlayed: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  lifetimeStats: LifetimeStats;
  lastPlayedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerRatingResponse = {
  rating: number;
  rank: RankName;
  /** Premier-style `//` label + color for the CS2 scoreboard. */
  premier: PremierDisplay;
};

/** Per-player combat facts from a finished CS2 round (plugin → API). */
export type RoundPlayerInput = {
  steamId: string;
  name?: string;
  avatar?: string;
  side: MatchSide;
  kills: number;
  assists: number;
  headshots: number;
  damage: number;
  survived: boolean;
  plant: boolean;
  defuse: boolean;
  entryKill: boolean;
  mvp: boolean;
};

/**
 * Internal rating engine input.
 * Controllers / importers normalize into this; RatingService only consumes it.
 */
export type RatingEvent = {
  version: RatingEventVersion;
  serverId: string;
  map: string;
  roundNumber?: number;
  winner: MatchSide;
  players: RoundPlayerInput[];
};

/** @deprecated Prefer RatingEvent / POST /api/rounds for public retakes. */
export type MatchPlayerInput = {
  steamId: string;
  name?: string;
  avatar?: string;
  side: MatchSide;
};

/** @deprecated Prefer RatingEvent / POST /api/rounds for public retakes. */
export type MatchResultInput = {
  serverId: string;
  map: string;
  winner: MatchSide;
  players: MatchPlayerInput[];
};

/** Facts that explain a round rating delta (stored on history, not full round). */
export type RatingHistoryStats = {
  kills: number;
  assists: number;
  headshots: number;
  plant: boolean;
  defuse: boolean;
  death: boolean;
  mvp: boolean;
};

export type RatingResult = {
  before: number;
  after: number;
  delta: number;
};

export type UpdatedPlayer = {
  steamId: string;
  name: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  rank: RankName;
  /** True when named rank tier crossed this update. */
  rankChanged: boolean;
  premier: PremierDisplay;
  won: boolean;
};

export type RatingHistoryReason = "ROUND" | "MATCH";

/**
 * `rating_history` — enough to explain the delta + plot rating over time.
 * Does not store the full round.
 */
export type RatingHistoryDoc = {
  _id: string;
  steamId: string;
  reason: RatingHistoryReason;
  serverId: string;
  map: string;
  side?: MatchSide;
  won?: boolean;
  delta: number;
  ratingBefore: number;
  ratingAfter: number;
  stats?: RatingHistoryStats;
  createdAt: Date;
};
