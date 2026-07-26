import "server-only";

import { ratingCalculator } from "@/lib/rating/RatingCalculator";
import {
  DEFAULT_RATING,
  rankService,
} from "@/lib/rating/RankService";
import { RatingRepository } from "@/lib/rating/RatingRepository";
import type {
  MatchResultInput,
  PlayerDoc,
  PlayerRatingResponse,
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
 * Public rating surface for MVP-1.
 * Plugin / admin code should go through this — not the repository directly.
 */
export class RatingService {
  constructor(private readonly repo = new RatingRepository()) {}

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
    return { rating: player.rating, rank, premier };
  }

  /**
   * Only public mutation for MVP-1: apply a completed match result.
   * Upserts players, runs team Elo, updates MongoDB, returns snapshots.
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

    for (const delta of deltas) {
      const prev = bySteam.get(delta.steamId)!;
      const input = matchResult.players.find(
        (p) => p.steamId === delta.steamId,
      )!;
      const peakRating = Math.max(prev.peakRating, delta.ratingAfter);
      const { rank, premier } = rankService.resolve(delta.ratingAfter);

      await this.repo.applyMatchUpdate({
        steamId: delta.steamId,
        rating: delta.ratingAfter,
        peakRating,
        rank,
        won: delta.won,
      });

      updatedPlayers.push({
        steamId: delta.steamId,
        name: input.name?.trim() || prev.name,
        ratingBefore: delta.ratingBefore,
        ratingAfter: delta.ratingAfter,
        delta: delta.delta,
        rank,
        premier,
        won: delta.won,
      });
    }

    return { updatedPlayers };
  }

  /**
   * Re-derive `rank` from stored `rating` for every player.
   * Does not replay Elo — useful after tweaking rank thresholds.
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
