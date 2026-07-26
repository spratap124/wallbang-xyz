import type {
  MatchSide,
  RatingHistoryStats,
  RoundPlayerInput,
} from "@/types/rating";

/**
 * Tunable round score weights — change here without touching RatingCalculator.
 * Never exposed to the plugin.
 */
export const ROUND_POINTS = {
  win: 8,
  kill: 2,
  assist: 1,
  headshot: 1,
  plant: 2,
  defuse: 2,
  death: -1,
} as const;

export type RoundScore = {
  /** Raw point total from combat + outcome (pre-clamp). */
  score: number;
  won: boolean;
  /** Compact facts that explain the score (for rating_history). */
  stats: RatingHistoryStats;
};

/**
 * Maps round combat facts → a numeric score.
 * Isolated so formula weights can change without touching rating apply logic.
 */
export class RoundScoreCalculator {
  calculate(player: RoundPlayerInput, winner: MatchSide): RoundScore {
    const won = player.side === winner;
    const death = !player.survived;

    const score =
      (won ? ROUND_POINTS.win : 0) +
      player.kills * ROUND_POINTS.kill +
      player.assists * ROUND_POINTS.assist +
      player.headshots * ROUND_POINTS.headshot +
      (player.plant ? ROUND_POINTS.plant : 0) +
      (player.defuse ? ROUND_POINTS.defuse : 0) +
      (death ? ROUND_POINTS.death : 0);

    return {
      score,
      won,
      stats: {
        kills: player.kills,
        assists: player.assists,
        headshots: player.headshots,
        plant: player.plant,
        defuse: player.defuse,
        death,
        mvp: player.mvp,
      },
    };
  }
}

export const roundScoreCalculator = new RoundScoreCalculator();
