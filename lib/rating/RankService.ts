import type { PremierDisplay, RankName } from "@/types/rating";
import { RANK_NAMES } from "@/types/rating";

/** New players start at zero — scoreboard shows "// 00000". */
export const DEFAULT_RATING = 0;

/** Display width for Premier-style labels (always 5 digits). */
export const RATING_DIGITS = 5;

/** Soft ceiling so Elo cannot run away forever. */
export const RATING_MAX = 99_999;

/**
 * CS2 Premier rating bands → WallBang named ranks (5-digit scale).
 *
 * | Color      | Range         | Named rank |
 * |------------|---------------|------------|
 * | Gray       | 00000–04999   | Iron       |
 * | Light Blue | 05000–09999   | Bronze     |
 * | Blue       | 10000–14999   | Silver     |
 * | Purple     | 15000–19999   | Gold       |
 * | Pink       | 20000–24999   | Platinum   |
 * | Red        | 25000–29999   | Diamond    |
 * | Gold       | 30000–34999   | Master     |
 * | Gold       | 35000+        | Global     |
 */
export const RANK_THRESHOLDS: ReadonlyArray<{
  rank: RankName;
  minRating: number;
}> = [
  { rank: "Global", minRating: 35_000 },
  { rank: "Master", minRating: 30_000 },
  { rank: "Diamond", minRating: 25_000 },
  { rank: "Platinum", minRating: 20_000 },
  { rank: "Gold", minRating: 15_000 },
  { rank: "Silver", minRating: 10_000 },
  { rank: "Bronze", minRating: 5_000 },
  { rank: "Iron", minRating: 0 },
];

/**
 * Premier scoreboard colors (Valve palette), keyed by named rank.
 * Master + Global share the Premier gold tier (30,000+).
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
  Master: { hex: "#E4AE39", r: 228, g: 174, b: 57 },
  Global: { hex: "#E4AE39", r: 228, g: 174, b: 57 },
};

export class RankService {
  /** Clamp into the allowed rating range. */
  clampRating(rating: number): number {
    if (!Number.isFinite(rating)) return DEFAULT_RATING;
    return Math.min(RATING_MAX, Math.max(0, Math.round(rating)));
  }

  /** Map a numeric rating → display rank (0 → Iron, 15,000 → Gold). */
  rankFromRating(rating: number): RankName {
    const clamped = this.clampRating(rating);
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
   * Scoreboard string: always 5 digits with leading zeros.
   * Examples: "// 00000", "// 00100", "// 01500", "// 15000"
   */
  formatPremierLabel(rating: number): string {
    const n = this.clampRating(rating);
    return `// ${n.toString().padStart(RATING_DIGITS, "0")}`;
  }

  /** Full Premier presentation for plugin / API consumers. */
  toPremierDisplay(rating: number, rank?: RankName): PremierDisplay {
    const clamped = this.clampRating(rating);
    const resolved = rank ?? this.rankFromRating(clamped);
    const color = this.colorForRank(resolved);
    return {
      rating: clamped,
      label: this.formatPremierLabel(clamped),
      color: color.hex,
      colorRgb: { r: color.r, g: color.g, b: color.b },
    };
  }

  /** Convenience: rating → named rank + Premier paint in one call. */
  resolve(rating: number): { rank: RankName; premier: PremierDisplay } {
    const clamped = this.clampRating(rating);
    const rank = this.rankFromRating(clamped);
    return { rank, premier: this.toPremierDisplay(clamped, rank) };
  }
}

export const rankService = new RankService();
