import type { PremierDisplay, RankName } from "@/types/rating";
import { RANK_NAMES } from "@/types/rating";

/**
 * Starting WallBang Rating — CS2 Premier scale.
 * 15,000 lands in Purple / named rank Gold.
 */
export const DEFAULT_RATING = 15_000;

/**
 * CS2 Premier rating bands → WallBang named ranks.
 * Color tiers match Valve Premier (5,000-point steps).
 *
 * | Color      | Range        | Named rank |
 * |------------|--------------|------------|
 * | Gray       | 0–4,999      | Iron       |
 * | Light Blue | 5,000–9,999  | Bronze     |
 * | Blue       | 10,000–14,999| Silver     |
 * | Purple     | 15,000–19,999| Gold       |
 * | Pink       | 20,000–24,999| Platinum   |
 * | Red        | 25,000–29,999| Diamond    |
 * | Gold       | 30,000+      | Master     |
 * | Gold       | 35,000+      | Global     |
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
  /** Map a numeric rating → display rank (15,000 → Gold). */
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
   * Scoreboard string in CS2 Premier style: "// 15,000"
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
