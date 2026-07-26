import type { MatchSide } from "@/types/rating";
import { DEFAULT_RATING } from "@/lib/rating/RankService";

/**
 * Elo K-factor on Premier-scale ratings (~15k start, 5k-wide color bands).
 * Larger than classic chess K so a match moves you within a band.
 */
export const ELO_K = 200;

/**
 * Elo expected-score divisor scaled for Premier magnitudes
 * (classic Elo uses 400 on ~1500 ratings).
 */
export const ELO_DIVISOR = 2_000;

/** Floor matches Premier Gray band (0). */
export const RATING_FLOOR = 0;

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
 * Team Elo: each player's expected score vs opposing team's average rating.
 * Winner side gets S=1, loser S=0.
 */
export class RatingCalculator {
  expectedScore(playerRating: number, opponentAvg: number): number {
    return 1 / (1 + 10 ** ((opponentAvg - playerRating) / ELO_DIVISOR));
  }

  averageRating(ratings: number[]): number {
    if (ratings.length === 0) return DEFAULT_RATING;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }

  clampRating(rating: number): number {
    return Math.max(RATING_FLOOR, Math.round(rating));
  }

  calculate(players: RatedPlayer[], winner: MatchSide): RatingDelta[] {
    const t = players.filter((p) => p.side === "T");
    const ct = players.filter((p) => p.side === "CT");
    const tAvg = this.averageRating(t.map((p) => p.rating));
    const ctAvg = this.averageRating(ct.map((p) => p.rating));

    return players.map((player) => {
      const opponentAvg = player.side === "T" ? ctAvg : tAvg;
      const expected = this.expectedScore(player.rating, opponentAvg);
      const won = player.side === winner;
      const score = won ? 1 : 0;
      const delta = ELO_K * (score - expected);
      const ratingAfter = this.clampRating(player.rating + delta);

      return {
        steamId: player.steamId,
        ratingBefore: player.rating,
        ratingAfter,
        delta: ratingAfter - player.rating,
        won,
      };
    });
  }
}

export const ratingCalculator = new RatingCalculator();
