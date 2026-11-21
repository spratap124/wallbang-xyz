import "server-only";

import type { Collection, UpdateFilter } from "mongodb";

import { getDb } from "@/lib/mongo";
import {
  ensureProfileIndexes,
  playerSessionsCollection,
} from "@/lib/profile/collections";
import type { LifetimeSessionStats } from "@/types/profile";
import {
  FIRST_SEEN_SEED_PIPELINE,
  LIFETIME_SESSION_COUNT_ACCUMULATOR,
  addLifetimeLedgerTotals,
  addPostBaselineUniquePlayers,
  firstSeenUpsert,
  idempotentUpsert,
  seedLeaseClaim,
} from "@/lib/profile/session-stats-logic";

const STATS = "fleet_session_stats";
const UNIQUES = "session_unique_players";
const SESSION_LEDGER = "session_lifetime_ledger";
const LIFETIME_ID = "lifetime";

export type FleetSessionStatsDoc = {
  _id: typeof LIFETIME_ID;
  totalSessions: number;
  totalPlayTimeMs: number;
  uniquePlayers: number;
  updatedAt: Date;
  /** Set once after seeding from existing player_sessions. */
  seededAt?: Date;
  /** Internal lease used to serialize the one-time seed across app instances. */
  seedLockOwner?: string;
  seedLockUntil?: Date;
  /** Present only on a newly-created stats document whose baseline is pending. */
  baselinePending?: boolean;
};

type SessionUniquePlayerDoc = {
  _id: string;
  steamId: string;
  firstSeenAt: Date;
  /** Present only when first observed after the lifetime baseline was seeded. */
  lifetimeUniqueContribution?: true;
};

type SessionLifetimeLedgerDoc = {
  _id: string;
  steamId: string;
  startedAt: Date;
  sessionStarted?: true;
  playTimeMs?: number;
  closedAt?: Date;
  updatedAt: Date;
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

async function sessionLedgerCollection(): Promise<
  Collection<SessionLifetimeLedgerDoc>
> {
  const db = await getDb();
  return db.collection<SessionLifetimeLedgerDoc>(SESSION_LEDGER);
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

const SEED_LOCK_MS = 30_000;
const SEED_WAIT_MS = 50;
const SEED_WAIT_ATTEMPTS = 1_200;

/** Seed lifetime counters from currently retained sessions, once. */
export async function ensureLifetimeSessionStats(): Promise<void> {
  await ensureProfileIndexes();
  const stats = await statsCollection();
  const now = new Date();

  // Create a recognizable empty seed target. The marker distinguishes this
  // fresh document from any pre-existing, unseeded counters that must not be
  // overwritten.
  await stats.updateOne(
    { _id: LIFETIME_ID },
    {
      $setOnInsert: {
        ...emptyStats(now),
        baselinePending: true,
      },
    },
    { upsert: true },
  );

  for (let attempt = 0; attempt < SEED_WAIT_ATTEMPTS; attempt += 1) {
    const current = await stats.findOne({ _id: LIFETIME_ID });
    if (current?.seededAt) return;

    const token = crypto.randomUUID();
    const lockNow = new Date();
    const claim = seedLeaseClaim(lockNow, token, SEED_LOCK_MS);
    const claimed = await stats.findOneAndUpdate(claim.filter, claim.update, {
      returnDocument: "after",
    });
    if (!claimed) {
      await new Promise((resolve) => setTimeout(resolve, SEED_WAIT_MS));
      continue;
    }

    try {
      const sessionsCol = await playerSessionsCollection();
      const uniques = await uniquesCollection();
      const seededAt = new Date();
      const [totalSessions, playAgg, firstSeenRows] = await Promise.all([
        sessionsCol.countDocuments({}),
        // Open rows are deliberately excluded: their full duration will be
        // credited when they are finalized, so including them here would count
        // their current elapsed time twice.
        sessionsCol
          .aggregate<{ totalPlayTimeMs: number }>([
            { $match: { leftAt: { $type: "date" } } },
            {
              $project: {
                durationMs: {
                  $max: [0, { $subtract: ["$leftAt", "$joinedAt"] }],
                },
              },
            },
            { $group: { _id: null, totalPlayTimeMs: { $sum: "$durationMs" } } },
          ])
          .toArray(),
        sessionsCol
          .aggregate<{ _id: string; firstSeenAt: Date }>([
            ...FIRST_SEEN_SEED_PIPELINE,
          ])
          .toArray(),
      ]);

      if (firstSeenRows.length > 0) {
        await uniques.bulkWrite(
          firstSeenRows.map(({ _id, firstSeenAt }) => ({
            updateOne: {
              ...firstSeenUpsert(_id, firstSeenAt),
            },
          })),
          { ordered: false },
        );
      }
      const uniquePlayers = await uniques.countDocuments({});

      const update: UpdateFilter<FleetSessionStatsDoc> = current?.baselinePending
        ? {
            $set: {
              totalSessions,
              totalPlayTimeMs: Math.round(playAgg[0]?.totalPlayTimeMs ?? 0),
              uniquePlayers,
              updatedAt: seededAt,
              seededAt,
            },
            $unset: { baselinePending: "", seedLockOwner: "", seedLockUntil: "" },
          }
        : {
            // Preserve any pre-existing counter values when an older or
            // partially initialized stats document has no fresh-baseline mark.
            $set: { seededAt, updatedAt: seededAt },
            $unset: { seedLockOwner: "", seedLockUntil: "" },
          };

      const finalized = await stats.updateOne(
        { _id: LIFETIME_ID, seedLockOwner: token, seededAt: { $exists: false } },
        update,
      );
      if (finalized.modifiedCount === 1) return;
    } catch (error) {
      await stats.updateOne(
        { _id: LIFETIME_ID, seedLockOwner: token, seededAt: { $exists: false } },
        { $unset: { seedLockOwner: "", seedLockUntil: "" } },
      );
      throw error;
    }
  }

  throw new Error("Timed out waiting for lifetime session stats initialization.");
}

export async function getLifetimeSessionStats(): Promise<LifetimeSessionStats> {
  await ensureLifetimeSessionStats();
  const [stats, ledger, uniques] = await Promise.all([
    statsCollection(),
    sessionLedgerCollection(),
    uniquesCollection(),
  ]);
  const [doc, [ledgerTotals], postBaselineUniqueRows] = await Promise.all([
    stats.findOne({ _id: LIFETIME_ID }),
    ledger
      .aggregate<{
        totalSessions: number;
        totalPlayTimeMs: number;
        updatedAt: Date | null;
      }>([
        {
          $group: {
            _id: null,
            totalSessions: LIFETIME_SESSION_COUNT_ACCUMULATOR,
            totalPlayTimeMs: { $sum: { $ifNull: ["$playTimeMs", 0] } },
            updatedAt: { $max: "$updatedAt" },
          },
        },
      ])
      .toArray(),
    uniques.countDocuments({ lifetimeUniqueContribution: true }),
  ]);
  const base = doc ?? emptyStats();
  const totals = addLifetimeLedgerTotals(base, ledgerTotals ?? {});
  return {
    // Existing counters remain the immutable historical baseline. New session
    // starts and finalized playtime are represented by one durable row per
    // session, so retries do not mutate that baseline more than once.
    totalSessions: totals.totalSessions,
    totalPlayTimeMs: totals.totalPlayTimeMs,
    uniquePlayers: addPostBaselineUniquePlayers(
      base.uniquePlayers,
      postBaselineUniqueRows,
    ),
    updatedAt: (ledgerTotals?.updatedAt ?? base.updatedAt).toISOString(),
  };
}

/** Persist the idempotent lifetime start record for a session. */
export async function recordLifetimeSessionStart(
  sessionId: string,
  steamId: string,
  joinedAt = new Date(),
): Promise<void> {
  await ensureLifetimeSessionStats();
  const now = new Date();
  const uniques = await uniquesCollection();
  const [ledger, sessionsCol] = await Promise.all([
    sessionLedgerCollection(),
    playerSessionsCollection(),
  ]);

  await idempotentUpsert(async () => {
    await ledger.updateOne(
      { _id: sessionId },
      {
        $set: { sessionStarted: true },
        $setOnInsert: {
          _id: sessionId,
          steamId,
          startedAt: joinedAt,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  });

  const firstSeen = firstSeenUpsert(steamId, joinedAt, true);
  try {
    await uniques.updateOne(firstSeen.filter, firstSeen.update, {
      upsert: true,
    });
  } catch (error) {
    // A concurrent first-seen upsert may lose on _id. The winning row carries
    // the durable contribution marker counted by getLifetimeSessionStats.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  await sessionsCol.updateOne(
    { _id: sessionId },
    { $set: { lifetimeSessionCountedAt: now } },
  );
}

/** Record finalized duration once per session, even when closure retries. */
export async function recordLifetimePlayTime(input: {
  sessionId: string;
  steamId: string;
  joinedAt: Date;
  leftAt: Date;
}): Promise<void> {
  await ensureLifetimeSessionStats();
  const ledger = await sessionLedgerCollection();
  const updatedAt = new Date();
  const playTimeMs = Math.max(
    0,
    Math.round(input.leftAt.getTime() - input.joinedAt.getTime()),
  );
  await idempotentUpsert(async () => {
    await ledger.updateOne(
      { _id: input.sessionId, playTimeMs: { $exists: false } },
      {
        $setOnInsert: {
          _id: input.sessionId,
          steamId: input.steamId,
          startedAt: input.joinedAt,
        },
        $set: { playTimeMs, closedAt: input.leftAt, updatedAt },
      },
      { upsert: true },
    );
  });
}
