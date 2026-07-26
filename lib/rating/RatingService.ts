import "server-only";

import { ratingCalculator } from "@/lib/rating/RatingCalculator";
import {
  DEFAULT_RATING,
  rankService,
} from "@/lib/rating/RankService";
import { RatingHistoryRepository } from "@/lib/rating/RatingHistoryRepository";
import type { InsertRatingHistoryInput } from "@/lib/rating/RatingHistoryRepository";
import { RatingRepository } from "@/lib/rating/RatingRepository";
import { roundScoreCalculator } from "@/lib/rating/RoundScoreCalculator";
import type {
  MatchResultInput,
  PlayerDoc,
  PlayerRatingResponse,
  RatingEvent,
  UpdatedPlayer,
} from "@/types/rating";

export class RatingError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "RatingError";
  }
}

/**
 * Public rating surface.
 * Controllers normalize into RatingEvent; this service owns persistence.
 *
 * Round path: RoundScoreCalculator → RatingCalculator.apply → repos.
 */
export class RatingService {
  constructor(
    private readonly repo = new RatingRepository(),
    private readonly history = new RatingHistoryRepository(),
  ) {}

  /** GET player rating — creates a default row on first sight. */
  async getPlayerRating(
    steamId: string,
    identity?: { name?: string; avatar?: string },
  ): Promise<PlayerRatingResponse> {
    const player = await this.repo.ensurePlayer(
      { steamId, name: identity?.name, avatar: identity?.avatar },
      {
        rating: DEFAULT_RATING,
        rank: rankService.rankFromRating(DEFAULT_RATING),
      },
    );
    const { rank, premier } = rankService.resolve(player.rating);
    const peakRating = rankService.clampRating(
      Math.max(player.peakRating, premier.rating),
    );

    if (
      player.rating !== premier.rating ||
      player.rank !== rank ||
      player.peakRating !== peakRating
    ) {
      await this.repo.setRatingState({
        steamId,
        rating: premier.rating,
        peakRating,
        rank,
      });
    }

    return { rating: premier.rating, rank, premier };
  }

  /**
   * Primary mutation: process one finished round event.
   * No round document — only player updates + explainable rating_history.
   */
  async processRound(
    event: RatingEvent,
  ): Promise<{ updatedPlayers: UpdatedPlayer[] }> {
    if (event.players.length < 1) {
      throw new RatingError("At least 1 player is required.", 400);
    }

    const steamIds = event.players.map((p) => p.steamId);
    if (new Set(steamIds).size !== steamIds.length) {
      throw new RatingError("Duplicate steamId in players list.", 400);
    }

    const defaultRank = rankService.rankFromRating(DEFAULT_RATING);
    const before: PlayerDoc[] = [];

    for (const p of event.players) {
      const doc = await this.repo.ensurePlayer(
        { steamId: p.steamId, name: p.name, avatar: p.avatar },
        { rating: DEFAULT_RATING, rank: defaultRank },
      );
      before.push(doc);
    }

    const bySteam = new Map(before.map((d) => [d.steamId, d]));
    const updatedPlayers: UpdatedPlayer[] = [];
    const historyRows: InsertRatingHistoryInput[] = [];

    for (const player of event.players) {
      const prev = bySteam.get(player.steamId)!;
      const roundScore = roundScoreCalculator.calculate(
        player,
        event.winner,
      );
      const result = ratingCalculator.apply(prev.rating, roundScore.score);
      const peakRating = Math.max(prev.peakRating, result.after);
      const { rank, premier } = rankService.resolve(result.after);
      const rankChanged = prev.rank !== rank;
      const deaths = roundScore.stats.death ? 1 : 0;

      await this.repo.applyRoundUpdate({
        steamId: player.steamId,
        rating: result.after,
        peakRating,
        rank,
        won: roundScore.won,
        kills: player.kills,
        deaths,
        assists: player.assists,
      });

      historyRows.push({
        steamId: player.steamId,
        reason: "ROUND",
        serverId: event.serverId,
        map: event.map,
        side: player.side,
        won: roundScore.won,
        delta: result.delta,
        ratingBefore: result.before,
        ratingAfter: result.after,
        stats: roundScore.stats,
      });

      updatedPlayers.push({
        steamId: player.steamId,
        name: player.name?.trim() || prev.name,
        ratingBefore: result.before,
        ratingAfter: result.after,
        delta: result.delta,
        rank,
        rankChanged,
        premier,
        won: roundScore.won,
      });
    }

    await this.history.insertMany(historyRows);

    return { updatedPlayers };
  }

  /**
   * @deprecated Prefer processRound for public retakes.
   * Kept for future ranked match mode (team Elo).
   */
  async updateRatings(
    matchResult: MatchResultInput,
  ): Promise<{ updatedPlayers: UpdatedPlayer[] }> {
    if (matchResult.players.length < 2) {
      throw new RatingError("At least 2 players are required.", 400);
    }

    const sides = new Set(matchResult.players.map((p) => p.side));
    if (!sides.has("T") || !sides.has("CT")) {
      throw new RatingError("Both T and CT sides are required.", 400);
    }

    const steamIds = matchResult.players.map((p) => p.steamId);
    if (new Set(steamIds).size !== steamIds.length) {
      throw new RatingError("Duplicate steamId in players list.", 400);
    }

    const defaultRank = rankService.rankFromRating(DEFAULT_RATING);
    const before: PlayerDoc[] = [];

    for (const p of matchResult.players) {
      const doc = await this.repo.ensurePlayer(
        { steamId: p.steamId, name: p.name, avatar: p.avatar },
        { rating: DEFAULT_RATING, rank: defaultRank },
      );
      before.push(doc);
    }

    const bySteam = new Map(before.map((d) => [d.steamId, d]));
    const deltas = ratingCalculator.calculate(
      matchResult.players.map((p) => {
        const doc = bySteam.get(p.steamId)!;
        return { steamId: p.steamId, rating: doc.rating, side: p.side };
      }),
      matchResult.winner,
    );

    const updatedPlayers: UpdatedPlayer[] = [];
    const historyRows: InsertRatingHistoryInput[] = [];

    for (const delta of deltas) {
      const prev = bySteam.get(delta.steamId)!;
      const input = matchResult.players.find(
        (p) => p.steamId === delta.steamId,
      )!;
      const peakRating = Math.max(prev.peakRating, delta.ratingAfter);
      const { rank, premier } = rankService.resolve(delta.ratingAfter);
      const rankChanged = prev.rank !== rank;

      await this.repo.applyMatchUpdate({
        steamId: delta.steamId,
        rating: delta.ratingAfter,
        peakRating,
        rank,
        won: delta.won,
      });

      historyRows.push({
        steamId: delta.steamId,
        reason: "MATCH",
        serverId: matchResult.serverId,
        map: matchResult.map,
        side: input.side,
        won: delta.won,
        delta: delta.delta,
        ratingBefore: delta.ratingBefore,
        ratingAfter: delta.ratingAfter,
      });

      updatedPlayers.push({
        steamId: delta.steamId,
        name: input.name?.trim() || prev.name,
        ratingBefore: delta.ratingBefore,
        ratingAfter: delta.ratingAfter,
        delta: delta.delta,
        rank,
        rankChanged,
        premier,
        won: delta.won,
      });
    }

    await this.history.insertMany(historyRows);

    return { updatedPlayers };
  }

  /**
   * Re-derive `rank` from stored `rating` for every player.
   * Does not replay events — useful after tweaking rank thresholds.
   */
  async recalculateRanks(): Promise<{ updated: number; scanned: number }> {
    const players = await this.repo.findAll();
    let updated = 0;

    for (const player of players) {
      const rank = rankService.rankFromRating(player.rating);
      if (rank !== player.rank) {
        await this.repo.updateRank(player.steamId, rank);
        updated += 1;
      }
    }

    return { updated, scanned: players.length };
  }
}

export const ratingService = new RatingService();
