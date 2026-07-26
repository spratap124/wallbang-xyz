import type { MatchSide } from "@/types/rating";

/** Elo K-factor — moderate movement for retake match volume. */
export const ELO_K = 32;

/** Soft floor so ratings never collapse to nonsense. */
export const RATING_FLOOR = 100;

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
    return 1 / (1 + 10 ** ((opponentAvg - playerRating) / 400));
  }

  averageRating(ratings: number[]): number {
    if (ratings.length === 0) return 1500;
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
