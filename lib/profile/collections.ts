import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  PlayerActivityDoc,
  PlayerBadgeDoc,
  PlayerPresenceDoc,
  PlayerProfileDoc,
  PlayerSessionDoc,
  PlayerSettingsDoc,
  PlayerStatsDoc,
} from "@/types/profile";

const PROFILES = "player_profiles";
const STATS = "player_stats";
const BADGES = "player_badges";
const SETTINGS = "player_settings";
const ACTIVITY = "player_activity";
const PRESENCE = "player_presence";
const SESSIONS = "player_sessions";

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

export async function playerPresenceCollection(): Promise<
  Collection<PlayerPresenceDoc>
> {
  const db = await getDb();
  return db.collection<PlayerPresenceDoc>(PRESENCE);
}

export async function playerSessionsCollection(): Promise<
  Collection<PlayerSessionDoc>
> {
  const db = await getDb();
  return db.collection<PlayerSessionDoc>(SESSIONS);
}

/** Presence older than this is treated as offline. */
export function presenceStaleMs(): number {
  const secs = Number(process.env.PLAYER_PRESENCE_TTL_SECONDS ?? 90);
  return (Number.isFinite(secs) && secs > 0 ? secs : 90) * 1000;
}

export async function ensureProfileIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [profiles, stats, badges, settings, activity, presence, sessions] =
        await Promise.all([
          playerProfilesCollection(),
          playerStatsCollection(),
          playerBadgesCollection(),
          playerSettingsCollection(),
          playerActivityCollection(),
          playerPresenceCollection(),
          playerSessionsCollection(),
        ]);

      await Promise.all([
        profiles.createIndex({ steamId: 1 }, { unique: true }),
        profiles.createIndex({ userId: 1 }, { unique: true }),
        stats.createIndex({ steamId: 1 }, { unique: true }),
        badges.createIndex({ steamId: 1, badgeType: 1 }, { unique: true }),
        badges.createIndex({ steamId: 1, grantedAt: -1 }),
        settings.createIndex({ steamId: 1 }, { unique: true }),
        activity.createIndex({ steamId: 1, createdAt: -1 }),
        presence.createIndex({ steamId: 1 }, { unique: true }),
        presence.createIndex({ serverId: 1, updatedAt: -1 }),
        // Auto-expire stale presence docs (Atlas TTL).
        presence.createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: Math.ceil(presenceStaleMs() / 1000) * 2 },
        ),
        sessions.createIndex({ serverId: 1, joinedAt: -1 }),
        sessions.createIndex({ steamId: 1, serverId: 1, leftAt: 1 }),
        sessions.createIndex({ serverId: 1, leftAt: 1, lastSeenAt: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
