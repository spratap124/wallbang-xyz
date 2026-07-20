import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type { PlayerLoadoutDoc } from "@/types/player-loadout";

const COLLECTION = "player_loadouts";

let indexesReady: Promise<void> | null = null;

export async function playerLoadoutsCollection(): Promise<
  Collection<PlayerLoadoutDoc>
> {
  const db = await getDb();
  return db.collection<PlayerLoadoutDoc>(COLLECTION);
}

export async function ensureLoadoutIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await playerLoadoutsCollection();
      await Promise.all([
        col.createIndex({ steamId: 1 }, { unique: true }),
        col.createIndex({ userId: 1 }, { unique: true }),
        col.createIndex({ updatedAt: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
