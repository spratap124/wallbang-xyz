import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  MatchDoc,
  PlayerMapStatsDoc,
  PlayerRatingHistoryDoc,
  PlayerRoundStatsDoc,
  RoundDoc,
} from "@/types/match-stats";
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
const MATCHES = "matches";
const ROUNDS = "rounds";
const PLAYER_ROUND_STATS = "player_round_stats";
const PLAYER_MAP_STATS = "player_map_stats";
const PLAYER_RATING_HISTORY = "player_rating_history";

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

export async function matchesCollection(): Promise<Collection<MatchDoc>> {
  const db = await getDb();
  return db.collection<MatchDoc>(MATCHES);
}

export async function roundsCollection(): Promise<Collection<RoundDoc>> {
  const db = await getDb();
  return db.collection<RoundDoc>(ROUNDS);
}

export async function playerRoundStatsCollection(): Promise<
  Collection<PlayerRoundStatsDoc>
> {
  const db = await getDb();
  return db.collection<PlayerRoundStatsDoc>(PLAYER_ROUND_STATS);
}

export async function playerMapStatsCollection(): Promise<
  Collection<PlayerMapStatsDoc>
> {
  const db = await getDb();
  return db.collection<PlayerMapStatsDoc>(PLAYER_MAP_STATS);
}

export async function playerRatingHistoryCollection(): Promise<
  Collection<PlayerRatingHistoryDoc>
> {
  const db = await getDb();
  return db.collection<PlayerRatingHistoryDoc>(PLAYER_RATING_HISTORY);
}

/** Presence older than this is treated as offline. */
export function presenceStaleMs(): number {
  const secs = Number(process.env.PLAYER_PRESENCE_TTL_SECONDS ?? 90);
  return (Number.isFinite(secs) && secs > 0 ? secs : 90) * 1000;
}

/** How long closed/open session docs are kept (Mongo TTL on joinedAt). */
export function playerSessionRetentionSeconds(): number {
  const days = Number(process.env.PLAYER_SESSION_RETENTION_DAYS ?? 30);
  const capped = Number.isFinite(days) && days > 0 ? days : 30;
  return Math.round(capped * 24 * 60 * 60);
}

async function ensureSessionRetentionIndex(
  sessions: Collection<PlayerSessionDoc>,
): Promise<void> {
  const expireAfterSeconds = playerSessionRetentionSeconds();
  const name = "joinedAt_ttl";
  const existing = await sessions.indexes();
  const current = existing.find(
    (idx) =>
      idx.name === name ||
      (idx.key &&
        Object.keys(idx.key).length === 1 &&
        (idx.key as { joinedAt?: number }).joinedAt === 1),
  );

  if (
    current?.name &&
    (current.expireAfterSeconds !== expireAfterSeconds || current.name !== name)
  ) {
    await sessions.dropIndex(current.name);
  }

  await sessions.createIndex(
    { joinedAt: 1 },
    { expireAfterSeconds, name },
  );
}

export async function ensureProfileIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [
        profiles,
        stats,
        badges,
        settings,
        activity,
        presence,
        sessions,
        matches,
        rounds,
        roundStats,
        mapStats,
        ratingHistory,
      ] = await Promise.all([
        playerProfilesCollection(),
        playerStatsCollection(),
        playerBadgesCollection(),
        playerSettingsCollection(),
        playerActivityCollection(),
        playerPresenceCollection(),
        playerSessionsCollection(),
        matchesCollection(),
        roundsCollection(),
        playerRoundStatsCollection(),
        playerMapStatsCollection(),
        playerRatingHistoryCollection(),
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
        ensureSessionRetentionIndex(sessions),
        matches.createIndex({ serverId: 1, startedAt: -1 }),
        matches.createIndex({ status: 1, startedAt: -1 }),
        rounds.createIndex({ matchId: 1, round: 1 }, { unique: true }),
        roundStats.createIndex(
          { matchId: 1, round: 1, steamId: 1 },
          { unique: true },
        ),
        roundStats.createIndex({ steamId: 1, createdAt: -1 }),
        roundStats.createIndex({ matchId: 1, steamId: 1 }),
        mapStats.createIndex({ steamId: 1, map: 1 }, { unique: true }),
        mapStats.createIndex({ steamId: 1, updatedAt: -1 }),
        ratingHistory.createIndex({ steamId: 1, createdAt: -1 }),
        ratingHistory.createIndex({ matchId: 1, steamId: 1 }, { unique: true }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
