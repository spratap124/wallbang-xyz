import type { PremierDisplay, RankName } from "@/types/rating";
import { RANK_NAMES } from "@/types/rating";

/** Starting WallBang Rating — maps to Gold. */
export const DEFAULT_RATING = 1500;

/**
 * Inclusive lower bounds for each rank (highest first for lookup).
 * 1500 lands in Gold.
 */
export const RANK_THRESHOLDS: ReadonlyArray<{
  rank: RankName;
  minRating: number;
}> = [
  { rank: "Global", minRating: 2300 },
  { rank: "Master", minRating: 2100 },
  { rank: "Diamond", minRating: 1900 },
  { rank: "Platinum", minRating: 1700 },
  { rank: "Gold", minRating: 1500 },
  { rank: "Silver", minRating: 1300 },
  { rank: "Bronze", minRating: 1100 },
  { rank: "Iron", minRating: 0 },
];

/**
 * CS2 Premier–inspired tier colors (Valve scoreboard palette).
 * Mapped 1:1 onto WallBang named ranks so `// rating` paints like Premier.
 */
export const RANK_PREMIER_COLORS: Record<
  RankName,
  { hex: string; r: number; g: number; b: number }
> = {
  Iron: { hex: "#B1C3D9", r: 177, g: 195, b: 217 },
  Bronze: { hex: "#5E98D9", r: 94, g: 152, b: 217 },
  Silver: { hex: "#4B69CD", r: 75, g: 105, b: 205 },
  Gold: { hex: "#8847FF", r: 136, g: 71, b: 255 },
  Platinum: { hex: "#D32CE6", r: 211, g: 44, b: 230 },
  Diamond: { hex: "#EB4B4B", r: 235, g: 75, b: 75 },
  Master: { hex: "#FF6B35", r: 255, g: 107, b: 53 },
  Global: { hex: "#FFD700", r: 255, g: 215, b: 0 },
};

export class RankService {
  /** Map a numeric rating → display rank (1500 → Gold). */
  rankFromRating(rating: number): RankName {
    const clamped = Number.isFinite(rating)
      ? Math.max(0, Math.round(rating))
      : 0;
    for (const tier of RANK_THRESHOLDS) {
      if (clamped >= tier.minRating) return tier.rank;
    }
    return "Iron";
  }

  isValidRank(value: string): value is RankName {
    return (RANK_NAMES as readonly string[]).includes(value);
  }

  /** Premier color for a named rank. */
  colorForRank(rank: RankName): {
    hex: string;
    r: number;
    g: number;
    b: number;
  } {
    return RANK_PREMIER_COLORS[rank];
  }

  /**
   * Scoreboard string in CS2 Premier style: "// 1,500"
   * (double slash + locale-grouped digits).
   */
  formatPremierLabel(rating: number): string {
    const n = Number.isFinite(rating) ? Math.max(0, Math.round(rating)) : 0;
    return `// ${n.toLocaleString("en-US")}`;
  }

  /** Full Premier presentation for plugin / API consumers. */
  toPremierDisplay(rating: number, rank?: RankName): PremierDisplay {
    const resolved = rank ?? this.rankFromRating(rating);
    const color = this.colorForRank(resolved);
    return {
      rating: Number.isFinite(rating) ? Math.max(0, Math.round(rating)) : 0,
      label: this.formatPremierLabel(rating),
      color: color.hex,
      colorRgb: { r: color.r, g: color.g, b: color.b },
    };
  }

  /** Convenience: rating → named rank + Premier paint in one call. */
  resolve(rating: number): { rank: RankName; premier: PremierDisplay } {
    const rank = this.rankFromRating(rating);
    return { rank, premier: this.toPremierDisplay(rating, rank) };
  }
}

export const rankService = new RankService();
