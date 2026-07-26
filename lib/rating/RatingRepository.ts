import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type { PlayerDoc, RankName } from "@/types/rating";

const PLAYERS = "players";

let indexesReady: Promise<void> | null = null;

export async function playersCollection(): Promise<Collection<PlayerDoc>> {
  const db = await getDb();
  return db.collection<PlayerDoc>(PLAYERS);
}

export async function ensurePlayerIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await playersCollection();
      await Promise.all([
        col.createIndex({ steamId: 1 }, { unique: true }),
        col.createIndex({ rating: -1 }),
        col.createIndex({ rank: 1, rating: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

export type UpsertPlayerIdentity = {
  steamId: string;
  name?: string;
  avatar?: string;
};

export class RatingRepository {
  async findBySteamId(steamId: string): Promise<PlayerDoc | null> {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    return col.findOne({ steamId });
  }

  async findManyBySteamIds(steamIds: string[]): Promise<PlayerDoc[]> {
    if (steamIds.length === 0) return [];
    await ensurePlayerIndexes();
    const col = await playersCollection();
    return col.find({ steamId: { $in: steamIds } }).toArray();
  }

  async findAll(): Promise<PlayerDoc[]> {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    return col.find({}).toArray();
  }

  /**
   * Ensure a player row exists. Creates at default rating when missing.
   * Updates name/avatar when provided.
   */
  async ensurePlayer(
    identity: UpsertPlayerIdentity,
    defaults: { rating: number; rank: RankName },
  ): Promise<PlayerDoc> {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    const now = new Date();
    const name = identity.name?.trim() || "Unknown";
    const avatar = identity.avatar?.trim() || "";

    const existing = await col.findOne({ steamId: identity.steamId });
    if (existing) {
      const set: Partial<PlayerDoc> = { updatedAt: now };
      if (identity.name?.trim()) set.name = name;
      if (identity.avatar?.trim()) set.avatar = avatar;
      if (Object.keys(set).length > 1) {
        await col.updateOne({ steamId: identity.steamId }, { $set: set });
        return { ...existing, ...set };
      }
      return existing;
    }

    const doc: PlayerDoc = {
      _id: crypto.randomUUID(),
      steamId: identity.steamId,
      name,
      avatar,
      rating: defaults.rating,
      peakRating: defaults.rating,
      rank: defaults.rank,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await col.insertOne(doc);
      return doc;
    } catch {
      // Race on unique steamId — re-read.
      const raced = await col.findOne({ steamId: identity.steamId });
      if (raced) return raced;
      throw new Error(`Failed to create player ${identity.steamId}`);
    }
  }

  async applyMatchUpdate(input: {
    steamId: string;
    rating: number;
    peakRating: number;
    rank: RankName;
    won: boolean;
  }): Promise<void> {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    const now = new Date();
    await col.updateOne(
      { steamId: input.steamId },
      {
        $set: {
          rating: input.rating,
          peakRating: input.peakRating,
          rank: input.rank,
          updatedAt: now,
        },
        $inc: {
          matchesPlayed: 1,
          wins: input.won ? 1 : 0,
          losses: input.won ? 0 : 1,
        },
      },
    );
  }

  async updateRank(steamId: string, rank: RankName): Promise<void> {
    await ensurePlayerIndexes();
    const col = await playersCollection();
    await col.updateOne(
      { steamId },
      { $set: { rank, updatedAt: new Date() } },
    );
  }
}
