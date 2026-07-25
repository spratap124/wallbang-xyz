import "server-only";

import { z } from "zod";

import {
  ensureProfileIndexes,
  matchesCollection,
  playerMapStatsCollection,
  playerRatingHistoryCollection,
  playerRoundStatsCollection,
  playerStatsCollection,
  roundsCollection,
} from "@/lib/profile/collections";
import {
  DEFAULT_RATING,
  emptyStats,
  ROUND_LOSS_RATING_DELTA,
  ROUND_WIN_RATING_DELTA,
} from "@/lib/profile/stats";
import type {
  MatchDoc,
  MatchSide,
  PlayerRoundStatsDoc,
  RoundDoc,
} from "@/types/match-stats";
const STEAM_ID = z.string().regex(/^\d{17}$/);
const SIDE = z.enum(["T", "CT"]);
const SITE = z.enum(["A", "B"]);

const weaponKillsSchema = z
  .record(z.string().min(1).max(32), z.number().int().min(0).max(10))
  .optional();

export const matchStartSchema = z.object({
  matchId: z.string().uuid(),
  serverId: z.string().min(1).max(64),
  serverName: z.string().trim().max(128).optional(),
  map: z.string().trim().min(1).max(64),
  startedAt: z.string().datetime().optional(),
});

export const playerRoundIngestSchema = z.object({
  steamId: STEAM_ID,
  side: SIDE,
  site: SITE.nullable().optional(),
  kills: z.number().int().min(0).max(10).optional(),
  deaths: z.number().int().min(0).max(1).optional(),
  assists: z.number().int().min(0).max(10).optional(),
  headshots: z.number().int().min(0).max(10).optional(),
  damage: z.number().int().min(0).max(2000).optional(),
  damageTaken: z.number().int().min(0).max(2000).optional(),
  survived: z.boolean().optional(),
  won: z.boolean(),
  mvp: z.boolean().optional(),
  planted: z.boolean().optional(),
  defused: z.boolean().optional(),
  plantAttempted: z.boolean().optional(),
  defuseAttempted: z.boolean().optional(),
  openingKill: z.boolean().optional(),
  openingDeath: z.boolean().optional(),
  weapons: weaponKillsSchema,
});

export const matchRoundSchema = z.object({
  matchId: z.string().uuid(),
  round: z.number().int().min(1).max(128),
  winner: SIDE,
  site: SITE.nullable().optional(),
  bombPlanted: z.boolean().optional(),
  bombDefused: z.boolean().optional(),
  durationMs: z.number().int().min(0).max(600_000).nullable().optional(),
  endedAt: z.string().datetime().optional(),
  serverId: z.string().min(1).max(64).optional(),
  map: z.string().trim().min(1).max(64).optional(),
  players: z.array(playerRoundIngestSchema).min(1).max(20),
});

export const matchEndSchema = z.object({
  matchId: z.string().uuid(),
  scoreT: z.number().int().min(0).max(128).optional(),
  scoreCT: z.number().int().min(0).max(128).optional(),
  winner: SIDE.nullable().optional(),
  endedAt: z.string().datetime().optional(),
  status: z.enum(["completed", "abandoned"]).optional(),
});

export type MatchStartInput = z.infer<typeof matchStartSchema>;
export type MatchRoundInput = z.infer<typeof matchRoundSchema>;
export type MatchEndInput = z.infer<typeof matchEndSchema>;

async function ensureLifetimeStats(steamId: string): Promise<void> {
  const col = await playerStatsCollection();
  await col.updateOne(
    { steamId },
    {
      $setOnInsert: {
        _id: crypto.randomUUID(),
        ...emptyStats(steamId),
      },
    },
    { upsert: true },
  );
  // Backfill rating on docs created before the stats pipeline.
  await col.updateOne(
    { steamId, rating: { $exists: false } },
    { $set: { rating: DEFAULT_RATING } },
  );
}

/**
 * Start (or re-assert) a match. Idempotent on matchId.
 */
export async function startMatch(
  input: MatchStartInput,
): Promise<{ match: MatchDoc; created: boolean }> {
  await ensureProfileIndexes();
  const col = await matchesCollection();
  const now = new Date();
  const startedAt = input.startedAt ? new Date(input.startedAt) : now;

  const existing = await col.findOne({ _id: input.matchId });
  if (existing) {
    return { match: existing, created: false };
  }

  const doc: MatchDoc = {
    _id: input.matchId,
    matchId: input.matchId,
    serverId: input.serverId,
    serverName: input.serverName?.trim() || null,
    map: input.map,
    mode: "retakes",
    status: "in_progress",
    startedAt,
    endedAt: null,
    scoreT: null,
    scoreCT: null,
    winner: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await col.insertOne(doc);
    return { match: doc, created: true };
  } catch (err) {
    // Race: another writer inserted the same matchId.
    const raced = await col.findOne({ _id: input.matchId });
    if (raced) return { match: raced, created: false };
    throw err;
  }
}

type RoundPlayerResult = {
  steamId: string;
  rolledUp: boolean;
  ratingDelta: number;
};

/**
 * Ingest one round for all players. Round facts + lifetime/map rollups are
 * idempotent on (matchId, round, steamId).
 */
export async function ingestMatchRound(input: MatchRoundInput): Promise<{
  matchId: string;
  round: number;
  players: RoundPlayerResult[];
  roundCreated: boolean;
}> {
  await ensureProfileIndexes();

  const matches = await matchesCollection();
  let match = await matches.findOne({ _id: input.matchId });

  if (!match) {
    if (!input.serverId || !input.map) {
      throw new MatchIngestError(
        "Unknown matchId. Call /matches/start first, or include serverId and map.",
        400,
      );
    }
    const started = await startMatch({
      matchId: input.matchId,
      serverId: input.serverId,
      map: input.map,
    });
    match = started.match;
  }

  if (match.status !== "in_progress") {
    throw new MatchIngestError(
      `Match is ${match.status}; rounds can only be ingested while in_progress.`,
      409,
    );
  }

  const now = new Date();
  const endedAt = input.endedAt ? new Date(input.endedAt) : now;
  const rounds = await roundsCollection();

  const roundDoc: RoundDoc = {
    _id: crypto.randomUUID(),
    matchId: input.matchId,
    round: input.round,
    winner: input.winner,
    site: input.site ?? null,
    bombPlanted: input.bombPlanted ?? false,
    bombDefused: input.bombDefused ?? false,
    durationMs: input.durationMs ?? null,
    endedAt,
    createdAt: now,
  };

  let roundCreated = true;
  try {
    await rounds.insertOne(roundDoc);
  } catch {
    roundCreated = false;
  }

  await matches.updateOne(
    { _id: input.matchId },
    { $set: { updatedAt: now } },
  );

  const results: RoundPlayerResult[] = [];
  for (const player of input.players) {
    const result = await ingestPlayerRound({
      match,
      round: input.round,
      player,
      roundSite: input.site ?? null,
      endedAt,
    });
    results.push(result);
  }

  return {
    matchId: input.matchId,
    round: input.round,
    players: results,
    roundCreated,
  };
}

async function ingestPlayerRound(args: {
  match: MatchDoc;
  round: number;
  player: z.infer<typeof playerRoundIngestSchema>;
  roundSite: "A" | "B" | null;
  endedAt: Date;
}): Promise<RoundPlayerResult> {
  const { match, round, player, roundSite, endedAt } = args;
  const now = endedAt;
  const kills = player.kills ?? 0;
  const deaths = player.deaths ?? 0;
  const assists = player.assists ?? 0;
  const headshots = player.headshots ?? 0;
  const damage = player.damage ?? 0;
  const planted = player.planted ?? false;
  const defused = player.defused ?? false;
  const plantAttempted = player.plantAttempted ?? planted;
  const defuseAttempted = player.defuseAttempted ?? defused;
  const mvp = player.mvp ?? false;
  const ratingDelta = player.won
    ? ROUND_WIN_RATING_DELTA
    : ROUND_LOSS_RATING_DELTA;

  const fact: PlayerRoundStatsDoc = {
    _id: crypto.randomUUID(),
    matchId: match.matchId,
    round,
    steamId: player.steamId,
    serverId: match.serverId,
    map: match.map,
    side: player.side,
    site: player.site ?? roundSite,
    kills,
    deaths,
    assists,
    headshots,
    damage,
    damageTaken: player.damageTaken ?? 0,
    survived: player.survived ?? deaths === 0,
    won: player.won,
    mvp,
    planted,
    defused,
    plantAttempted,
    defuseAttempted,
    openingKill: player.openingKill ?? false,
    openingDeath: player.openingDeath ?? false,
    weapons: player.weapons ?? {},
    rolledUp: false,
    rolledUpAt: null,
    createdAt: now,
  };

  const roundStats = await playerRoundStatsCollection();
  await roundStats.updateOne(
    { matchId: match.matchId, round, steamId: player.steamId },
    { $setOnInsert: fact },
    { upsert: true },
  );

  const claimed = await roundStats.findOneAndUpdate(
    {
      matchId: match.matchId,
      round,
      steamId: player.steamId,
      rolledUp: false,
    },
    { $set: { rolledUp: true, rolledUpAt: now } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    return { steamId: player.steamId, rolledUp: false, ratingDelta: 0 };
  }

  await applyRoundRollup(claimed, ratingDelta);
  return { steamId: player.steamId, rolledUp: true, ratingDelta };
}

async function applyRoundRollup(
  fact: PlayerRoundStatsDoc,
  ratingDelta: number,
): Promise<void> {
  await ensureLifetimeStats(fact.steamId);
  const now = new Date();
  const stats = await playerStatsCollection();
  const mapStats = await playerMapStatsCollection();

  await stats.updateOne(
    { steamId: fact.steamId },
    {
      $inc: {
        kills: fact.kills,
        deaths: fact.deaths,
        assists: fact.assists,
        headshots: fact.headshots,
        damage: fact.damage,
        roundsPlayed: 1,
        roundsWon: fact.won ? 1 : 0,
        roundsLost: fact.won ? 0 : 1,
        plants: fact.planted ? 1 : 0,
        plantAttempts: fact.plantAttempted ? 1 : 0,
        defuses: fact.defused ? 1 : 0,
        defuseAttempts: fact.defuseAttempted ? 1 : 0,
        mvps: fact.mvp ? 1 : 0,
        rating: ratingDelta,
      },
      $set: { updatedAt: now },
    },
  );

  await stats.updateOne(
    { steamId: fact.steamId, rating: { $lt: 0 } },
    { $set: { rating: 0 } },
  );

  // $setOnInsert must not overlap $inc paths.
  await mapStats.updateOne(
    { steamId: fact.steamId, map: fact.map },
    {
      $inc: {
        kills: fact.kills,
        deaths: fact.deaths,
        assists: fact.assists,
        headshots: fact.headshots,
        damage: fact.damage,
        roundsPlayed: 1,
        roundsWon: fact.won ? 1 : 0,
        roundsLost: fact.won ? 0 : 1,
        plants: fact.planted ? 1 : 0,
        defuses: fact.defused ? 1 : 0,
        mvps: fact.mvp ? 1 : 0,
      },
      $set: { updatedAt: now },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        steamId: fact.steamId,
        map: fact.map,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
      },
    },
    { upsert: true },
  );
}

/**
 * Complete a match: increment matchesPlayed / wins / losses, snapshot rating.
 * Idempotent — second call is a no-op once status is no longer in_progress.
 */
export async function endMatch(input: MatchEndInput): Promise<{
  match: MatchDoc;
  finalized: boolean;
  players: Array<{
    steamId: string;
    won: boolean;
    ratingBefore: number;
    ratingAfter: number;
  }>;
}> {
  await ensureProfileIndexes();
  const matches = await matchesCollection();
  const match = await matches.findOne({ _id: input.matchId });
  if (!match) {
    throw new MatchIngestError("Match not found.", 404);
  }

  if (match.status !== "in_progress") {
    return { match, finalized: false, players: [] };
  }

  const now = new Date();
  const endedAt = input.endedAt ? new Date(input.endedAt) : now;
  const status = input.status ?? "completed";

  const claimed = await matches.findOneAndUpdate(
    { _id: input.matchId, status: "in_progress" },
    {
      $set: {
        status,
        endedAt,
        scoreT: input.scoreT ?? null,
        scoreCT: input.scoreCT ?? null,
        winner: (input.winner ?? null) as MatchSide | null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const current = await matches.findOne({ _id: input.matchId });
    return { match: current ?? match, finalized: false, players: [] };
  }

  const roundStats = await playerRoundStatsCollection();
  const perPlayer = await roundStats
    .aggregate<{
      _id: string;
      roundsWon: number;
      roundsLost: number;
    }>([
      { $match: { matchId: input.matchId } },
      {
        $group: {
          _id: "$steamId",
          roundsWon: { $sum: { $cond: ["$won", 1, 0] } },
          roundsLost: { $sum: { $cond: ["$won", 0, 1] } },
        },
      },
    ])
    .toArray();

  const statsCol = await playerStatsCollection();
  const mapStatsCol = await playerMapStatsCollection();
  const historyCol = await playerRatingHistoryCollection();
  const players: Array<{
    steamId: string;
    won: boolean;
    ratingBefore: number;
    ratingAfter: number;
  }> = [];

  for (const row of perPlayer) {
    const steamId = row._id;
    const won = row.roundsWon > row.roundsLost;
    await ensureLifetimeStats(steamId);

    const beforeDoc = await statsCol.findOne({ steamId });
    const ratingAfter = beforeDoc?.rating ?? DEFAULT_RATING;
    // Rating already moved per-round; snapshot current value as "after".
    // Reconstruct before ≈ after − per-round deltas for this match.
    const ratingBefore =
      ratingAfter -
      (row.roundsWon * ROUND_WIN_RATING_DELTA +
        row.roundsLost * ROUND_LOSS_RATING_DELTA);

    await statsCol.updateOne(
      { steamId },
      {
        $inc: {
          matchesPlayed: 1,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
        },
        $set: { updatedAt: now },
      },
    );

    await mapStatsCol.updateOne(
      { steamId, map: claimed.map },
      {
        $inc: {
          matchesPlayed: 1,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
        },
        $set: { updatedAt: now },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          steamId,
          map: claimed.map,
          kills: 0,
          deaths: 0,
          assists: 0,
          headshots: 0,
          damage: 0,
          roundsPlayed: 0,
          roundsWon: 0,
          roundsLost: 0,
          plants: 0,
          defuses: 0,
          mvps: 0,
        },
      },
      { upsert: true },
    );

    await historyCol.updateOne(
      { matchId: input.matchId, steamId },
      {
        $setOnInsert: {
          _id: crypto.randomUUID(),
          steamId,
          matchId: input.matchId,
          ratingBefore,
          ratingAfter,
          delta: ratingAfter - ratingBefore,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    players.push({ steamId, won, ratingBefore, ratingAfter });
  }

  return { match: claimed, finalized: true, players };
}

export class MatchIngestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MatchIngestError";
    this.status = status;
  }
}
