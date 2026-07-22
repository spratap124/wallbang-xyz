import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import {
  ensureProfileIndexes,
  playerSessionsCollection,
} from "@/lib/profile/collections";
import type { LifetimeSessionStats } from "@/types/profile";

const STATS = "fleet_session_stats";
const UNIQUES = "session_unique_players";
const LIFETIME_ID = "lifetime";

export type FleetSessionStatsDoc = {
  _id: typeof LIFETIME_ID;
  totalSessions: number;
  totalPlayTimeMs: number;
  uniquePlayers: number;
  updatedAt: Date;
  /** Set once after seeding from existing player_sessions. */
  seededAt?: Date;
};

type SessionUniquePlayerDoc = {
  _id: string;
  steamId: string;
  firstSeenAt: Date;
};

async function statsCollection(): Promise<Collection<FleetSessionStatsDoc>> {
  const db = await getDb();
  return db.collection<FleetSessionStatsDoc>(STATS);
}

async function uniquesCollection(): Promise<
  Collection<SessionUniquePlayerDoc>
> {
  const db = await getDb();
  return db.collection<SessionUniquePlayerDoc>(UNIQUES);
}

function emptyStats(now = new Date()): FleetSessionStatsDoc {
  return {
    _id: LIFETIME_ID,
    totalSessions: 0,
    totalPlayTimeMs: 0,
    uniquePlayers: 0,
    updatedAt: now,
  };
}

/** Seed lifetime counters from current sessions if missing (one-time). */
export async function ensureLifetimeSessionStats(): Promise<void> {
  await ensureProfileIndexes();
  const stats = await statsCollection();
  const existing = await stats.findOne({ _id: LIFETIME_ID });
  if (existing?.seededAt) return;

  const sessionsCol = await playerSessionsCollection();
  const uniques = await uniquesCollection();
  const now = new Date();

  const [totalSessions, playAgg, distinct] = await Promise.all([
    sessionsCol.countDocuments({}),
    sessionsCol
      .aggregate<{ totalPlayTimeMs: number }>([
        {
          $project: {
            durationMs: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$leftAt", "$lastSeenAt"] },
                    "$joinedAt",
                  ],
                },
              ],
            },
          },
        },
        { $group: { _id: null, totalPlayTimeMs: { $sum: "$durationMs" } } },
      ])
      .toArray(),
    sessionsCol.distinct("steamId"),
  ]);

  const totalPlayTimeMs = Math.round(playAgg[0]?.totalPlayTimeMs ?? 0);
  const uniquePlayers = distinct.length;

  if (distinct.length > 0) {
    await uniques.bulkWrite(
      distinct.map((steamId) => ({
        updateOne: {
          filter: { _id: steamId },
          update: {
            $setOnInsert: {
              _id: steamId,
              steamId,
              firstSeenAt: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  await stats.updateOne(
    { _id: LIFETIME_ID },
    {
      $set: {
        totalSessions,
        totalPlayTimeMs,
        uniquePlayers,
        updatedAt: now,
        seededAt: now,
      },
      $setOnInsert: { _id: LIFETIME_ID },
    },
    { upsert: true },
  );
}

export async function getLifetimeSessionStats(): Promise<LifetimeSessionStats> {
  await ensureLifetimeSessionStats();
  const stats = await statsCollection();
  const doc = (await stats.findOne({ _id: LIFETIME_ID })) ?? emptyStats();
  return {
    totalSessions: doc.totalSessions,
    totalPlayTimeMs: doc.totalPlayTimeMs,
    uniquePlayers: doc.uniquePlayers,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Call when a new player_sessions row is created. */
export async function recordLifetimeSessionStart(steamId: string): Promise<void> {
  await ensureLifetimeSessionStats();
  const now = new Date();
  const [stats, uniques] = await Promise.all([
    statsCollection(),
    uniquesCollection(),
  ]);

  const inserted = await uniques.updateOne(
    { _id: steamId },
    {
      $setOnInsert: {
        _id: steamId,
        steamId,
        firstSeenAt: now,
      },
    },
    { upsert: true },
  );

  const uniqueInc = inserted.upsertedCount > 0 ? 1 : 0;
  await stats.updateOne(
    { _id: LIFETIME_ID },
    {
      $inc: { totalSessions: 1, uniquePlayers: uniqueInc },
      $set: { updatedAt: now },
      $setOnInsert: {
        _id: LIFETIME_ID,
        totalPlayTimeMs: 0,
        seededAt: now,
      },
    },
    { upsert: true },
  );
}

/** Call when open session(s) are closed; credits completed play time. */
export async function recordLifetimePlayTime(playTimeMs: number): Promise<void> {
  const ms = Math.max(0, Math.round(playTimeMs));
  if (ms <= 0) return;
  await ensureLifetimeSessionStats();
  const stats = await statsCollection();
  await stats.updateOne(
    { _id: LIFETIME_ID },
    {
      $inc: { totalPlayTimeMs: ms },
      $set: { updatedAt: new Date() },
      $setOnInsert: {
        _id: LIFETIME_ID,
        totalSessions: 0,
        uniquePlayers: 0,
        seededAt: new Date(),
      },
    },
    { upsert: true },
  );
}
