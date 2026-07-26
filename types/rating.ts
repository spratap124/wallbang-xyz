/** WallBang Rating MVP-1 — scoreboard rating ownership. */

export const MATCH_SIDES = ["T", "CT"] as const;
export type MatchSide = (typeof MATCH_SIDES)[number];

/** Named ranks derived from CS2 Premier–scale rating (15,000 = Gold / Purple). */
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
 * Plugin renders `label` (e.g. "// 1,500") tinted with `color`.
 */
export type PremierDisplay = {
  /** Same numeric rating, ready for Premier-style UI. */
  rating: number;
  /** Scoreboard string, e.g. "// 1,500". */
  label: string;
  /** Hex color matching the named rank tier. */
  color: string;
  /** 0–255 RGB for CounterStrikeSharp / HTML paint. */
  colorRgb: { r: number; g: number; b: number };
};

/**
 * `players` collection — sole source of truth for WallBang Rating.
 * Kept intentionally lean for MVP-1 (scoreboard display).
 */
export type PlayerDoc = {
  _id: string;
  steamId: string;
  name: string;
  avatar: string;
  rating: number;
  peakRating: number;
  rank: RankName;
  matchesPlayed: number;
  wins: number;
  losses: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerRatingResponse = {
  rating: number;
  rank: RankName;
  /** Premier-style `//` label + color for the CS2 scoreboard. */
  premier: PremierDisplay;
};

export type MatchPlayerInput = {
  steamId: string;
  name?: string;
  avatar?: string;
  side: MatchSide;
};

export type MatchResultInput = {
  serverId: string;
  map: string;
  winner: MatchSide;
  players: MatchPlayerInput[];
};

export type UpdatedPlayer = {
  steamId: string;
  name: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  rank: RankName;
  premier: PremierDisplay;
  won: boolean;
};
