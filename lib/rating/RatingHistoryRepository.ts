import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  MatchSide,
  RatingHistoryDoc,
  RatingHistoryReason,
  RatingHistoryStats,
} from "@/types/rating";

const RATING_HISTORY = "rating_history";

let indexesReady: Promise<void> | null = null;

export async function ratingHistoryCollection(): Promise<
  Collection<RatingHistoryDoc>
> {
  const db = await getDb();
  return db.collection<RatingHistoryDoc>(RATING_HISTORY);
}

export async function ensureRatingHistoryIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await ratingHistoryCollection();
      await Promise.all([
        col.createIndex({ steamId: 1, createdAt: -1 }),
        col.createIndex({ createdAt: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

export type InsertRatingHistoryInput = {
  steamId: string;
  reason: RatingHistoryReason;
  serverId: string;
  map: string;
  side?: MatchSide;
  won?: boolean;
  delta: number;
  ratingBefore: number;
  ratingAfter: number;
  stats?: RatingHistoryStats;
};

export class RatingHistoryRepository {
  async insert(input: InsertRatingHistoryInput): Promise<RatingHistoryDoc> {
    await ensureRatingHistoryIndexes();
    const col = await ratingHistoryCollection();
    const doc: RatingHistoryDoc = {
      _id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    await col.insertOne(doc);
    return doc;
  }

  async insertMany(inputs: InsertRatingHistoryInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await ensureRatingHistoryIndexes();
    const col = await ratingHistoryCollection();
    const now = new Date();
    await col.insertMany(
      inputs.map((input) => ({
        _id: crypto.randomUUID(),
        ...input,
        createdAt: now,
      })),
    );
  }

  async findBySteamId(
    steamId: string,
    limit = 50,
  ): Promise<RatingHistoryDoc[]> {
    await ensureRatingHistoryIndexes();
    const col = await ratingHistoryCollection();
    return col
      .find({ steamId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
