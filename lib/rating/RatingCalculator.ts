import type { MatchSide, RatingResult } from "@/types/rating";
import {
  DEFAULT_RATING,
  RATING_MAX,
} from "@/lib/rating/RankService";

/**
 * Elo K-factor on Premier-scale ratings (match / ranked path).
 * @deprecated Prefer RoundScoreCalculator for public retakes.
 */
export const ELO_K = 200;

/**
 * Elo expected-score divisor scaled for Premier magnitudes.
 * @deprecated Prefer RoundScoreCalculator for public retakes.
 */
export const ELO_DIVISOR = 2_000;

export const RATING_FLOOR = 0;
export const RATING_CEILING = RATING_MAX;

export type RatedPlayer = {
  steamId: string;
  rating: number;
  side: MatchSide;
};

export type RatingDelta = {
  steamId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  won: boolean;
};

/**
 * Applies a numeric score to a rating. Never touches Mongo.
 * Round formula lives in RoundScoreCalculator; this only clamps + diffs.
 */
export class RatingCalculator {
  clampRating(rating: number): number {
    if (!Number.isFinite(rating)) return DEFAULT_RATING;
    return Math.min(RATING_CEILING, Math.max(RATING_FLOOR, Math.round(rating)));
  }

  /**
   * Apply a round (or any) score to the player's current rating.
   * `score` comes from RoundScoreCalculator — not hardcoded here.
   */
  apply(ratingBefore: number, score: number): RatingResult {
    const after = this.clampRating(ratingBefore + score);
    return {
      before: ratingBefore,
      after,
      delta: after - ratingBefore,
    };
  }

  /** @deprecated Team Elo for POST /api/matches (future ranked). */
  expectedScore(playerRating: number, opponentAvg: number): number {
    return 1 / (1 + 10 ** ((opponentAvg - playerRating) / ELO_DIVISOR));
  }

  /** @deprecated */
  averageRating(ratings: number[]): number {
    if (ratings.length === 0) return DEFAULT_RATING;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }

  /** @deprecated Team Elo for POST /api/matches (future ranked). */
  calculate(players: RatedPlayer[], winner: MatchSide): RatingDelta[] {
    const t = players.filter((p) => p.side === "T");
    const ct = players.filter((p) => p.side === "CT");
    const tAvg = this.averageRating(t.map((p) => p.rating));
    const ctAvg = this.averageRating(ct.map((p) => p.rating));

    return players.map((player) => {
      const opponentAvg = player.side === "T" ? ctAvg : tAvg;
      const expected = this.expectedScore(player.rating, opponentAvg);
      const won = player.side === winner;
      const eloDelta = ELO_K * ((won ? 1 : 0) - expected);
      const result = this.apply(player.rating, eloDelta);

      return {
        steamId: player.steamId,
        ratingBefore: result.before,
        ratingAfter: result.after,
        delta: result.delta,
        won,
      };
    });
  }
}

export const ratingCalculator = new RatingCalculator();
