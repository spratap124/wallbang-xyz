import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  PlayerActivityDoc,
  PlayerBadgeDoc,
  PlayerProfileDoc,
  PlayerSettingsDoc,
  PlayerStatsDoc,
} from "@/types/profile";

const PROFILES = "player_profiles";
const STATS = "player_stats";
const BADGES = "player_badges";
const SETTINGS = "player_settings";
const ACTIVITY = "player_activity";

let indexesReady: Promise<void> | null = null;

export async function playerProfilesCollection(): Promise<
  Collection<PlayerProfileDoc>
> {
  const db = await getDb();
  return db.collection<PlayerProfileDoc>(PROFILES);
}

export async function playerStatsCollection(): Promise<
  Collection<PlayerStatsDoc>
> {
  const db = await getDb();
  return db.collection<PlayerStatsDoc>(STATS);
}

export async function playerBadgesCollection(): Promise<
  Collection<PlayerBadgeDoc>
> {
  const db = await getDb();
  return db.collection<PlayerBadgeDoc>(BADGES);
}

export async function playerSettingsCollection(): Promise<
  Collection<PlayerSettingsDoc>
> {
  const db = await getDb();
  return db.collection<PlayerSettingsDoc>(SETTINGS);
}

export async function playerActivityCollection(): Promise<
  Collection<PlayerActivityDoc>
> {
  const db = await getDb();
  return db.collection<PlayerActivityDoc>(ACTIVITY);
}

export async function ensureProfileIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [profiles, stats, badges, settings, activity] = await Promise.all([
        playerProfilesCollection(),
        playerStatsCollection(),
        playerBadgesCollection(),
        playerSettingsCollection(),
        playerActivityCollection(),
      ]);

      await Promise.all([
        profiles.createIndex({ steamId: 1 }, { unique: true }),
        profiles.createIndex({ userId: 1 }, { unique: true }),
        stats.createIndex({ steamId: 1 }, { unique: true }),
        badges.createIndex({ steamId: 1, badgeType: 1 }, { unique: true }),
        badges.createIndex({ steamId: 1, grantedAt: -1 }),
        settings.createIndex({ steamId: 1 }, { unique: true }),
        activity.createIndex({ steamId: 1, createdAt: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
