import "server-only";

import { findUsersBySteamIds } from "@/lib/auth/users";
import {
  ensureProfileIndexes,
  playerPresenceCollection,
  playerSessionsCollection,
  presenceStaleMs,
} from "@/lib/profile/collections";
import { getGameServerById } from "@/lib/servers/registry";
import { getLiveServers } from "@/lib/servers/status";
import type {
  PlayerSessionDoc,
  ServerStatsDayBucket,
  ServerStatsRange,
  ServerStatsRecentSession,
  ServerStatsResponse,
  ServerStatsSummary,
} from "@/types/profile";

const RANGE_MS: Record<Exclude<ServerStatsRange, "all">, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function isServerStatsRange(value: string): value is ServerStatsRange {
  return value === "1d" || value === "7d" || value === "30d" || value === "all";
}

function rangeStart(range: ServerStatsRange, now = new Date()): Date | null {
  if (range === "all") return null;
  return new Date(now.getTime() - RANGE_MS[range]);
}

function sessionEndedAt(session: PlayerSessionDoc, now = Date.now()): Date {
  if (session.leftAt) return session.leftAt;
  const staleMs = presenceStaleMs() * 2;
  if (now - session.lastSeenAt.getTime() > staleMs) {
    return session.lastSeenAt;
  }
  return new Date(now);
}

function sessionDurationMs(session: PlayerSessionDoc, now = Date.now()): number {
  const end = sessionEndedAt(session, now).getTime();
  return Math.max(0, end - session.joinedAt.getTime());
}

function isSessionActive(session: PlayerSessionDoc, now = Date.now()): boolean {
  if (session.leftAt) return false;
  return now - session.lastSeenAt.getTime() <= presenceStaleMs() * 2;
}

/** Close any open session whose last heartbeat is older than the presence TTL window. */
async function closeStaleOpenSession(
  steamId: string,
  serverId: string,
  now: Date,
): Promise<void> {
  const col = await playerSessionsCollection();
  const staleBefore = new Date(now.getTime() - presenceStaleMs() * 2);
  const stale = await col.findOne({
    steamId,
    serverId,
    leftAt: null,
    lastSeenAt: { $lt: staleBefore },
  });
  if (!stale) return;
  await col.updateOne(
    { _id: stale._id, leftAt: null },
    { $set: { leftAt: stale.lastSeenAt } },
  );
}

/**
 * Record / extend a connection session from a presence heartbeat.
 * Creates a new session when none is open (or the previous one went stale).
 */
export async function touchPlayerSession(input: {
  steamId: string;
  serverId: string;
  serverName: string;
  map: string | null;
}): Promise<void> {
  await ensureProfileIndexes();
  const now = new Date();
  const col = await playerSessionsCollection();

  // Close open sessions on other servers (player moved / reconnect edge case).
  await col.updateMany(
    {
      steamId: input.steamId,
      serverId: { $ne: input.serverId },
      leftAt: null,
    },
    { $set: { leftAt: now, lastSeenAt: now } },
  );

  await closeStaleOpenSession(input.steamId, input.serverId, now);

  const open = await col.findOne({
    steamId: input.steamId,
    serverId: input.serverId,
    leftAt: null,
  });

  if (open) {
    await col.updateOne(
      { _id: open._id },
      {
        $set: {
          lastSeenAt: now,
          serverName: input.serverName,
          map: input.map,
        },
      },
    );
    return;
  }

  const doc: PlayerSessionDoc = {
    _id: crypto.randomUUID(),
    steamId: input.steamId,
    serverId: input.serverId,
    serverName: input.serverName,
    map: input.map,
    joinedAt: now,
    lastSeenAt: now,
    leftAt: null,
  };
  await col.insertOne(doc);
}

export async function endPlayerSession(
  steamId: string,
  serverId?: string,
): Promise<void> {
  await ensureProfileIndexes();
  const now = new Date();
  const col = await playerSessionsCollection();
  const filter = serverId
    ? { steamId, serverId, leftAt: null }
    : { steamId, leftAt: null };
  await col.updateMany(filter, { $set: { leftAt: now, lastSeenAt: now } });
}

export async function endServerSessions(serverId: string): Promise<void> {
  await ensureProfileIndexes();
  const now = new Date();
  const col = await playerSessionsCollection();
  await col.updateMany(
    { serverId, leftAt: null },
    { $set: { leftAt: now, lastSeenAt: now } },
  );
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDailyBuckets(
  sessions: PlayerSessionDoc[],
  range: ServerStatsRange,
  now: Date,
): ServerStatsDayBucket[] {
  const start = rangeStart(range, now);
  const dayMs = 24 * 60 * 60 * 1000;
  const endDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  let days: number;
  if (range === "1d") days = 1;
  else if (range === "7d") days = 7;
  else if (range === "30d") days = 30;
  else {
    if (sessions.length === 0) return [];
    const earliest = sessions.reduce(
      (min, s) => (s.joinedAt < min ? s.joinedAt : min),
      sessions[0].joinedAt,
    );
    const span = endDay.getTime() - Date.UTC(
      earliest.getUTCFullYear(),
      earliest.getUTCMonth(),
      earliest.getUTCDate(),
    );
    days = Math.min(90, Math.max(1, Math.floor(span / dayMs) + 1));
  }

  const buckets: ServerStatsDayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(endDay.getTime() - i * dayMs);
    const dayEnd = new Date(dayStart.getTime() + dayMs);
    if (start && dayEnd <= start) continue;

    const inDay = sessions.filter((s) => {
      const joined = s.joinedAt.getTime();
      return joined >= dayStart.getTime() && joined < dayEnd.getTime();
    });
    const unique = new Set(inDay.map((s) => s.steamId));
    buckets.push({
      date: utcDayKey(dayStart),
      uniquePlayers: unique.size,
      sessions: inDay.length,
    });
  }
  return buckets;
}

export async function getServerConnectionStats(input: {
  serverId: string;
  range: ServerStatsRange;
  recentLimit?: number;
}): Promise<ServerStatsResponse | null> {
  const def = await getGameServerById(input.serverId, {
    includeDisabled: true,
  });
  if (!def) return null;

  await ensureProfileIndexes();
  const now = new Date();
  const start = rangeStart(input.range, now);
  const col = await playerSessionsCollection();

  const filter = start
    ? { serverId: input.serverId, joinedAt: { $gte: start } }
    : { serverId: input.serverId };

  const [sessions, presenceCol, live] = await Promise.all([
    col.find(filter).sort({ joinedAt: -1 }).toArray(),
    playerPresenceCollection(),
    getLiveServers().catch(() => []),
  ]);

  const unique = new Set(sessions.map((s) => s.steamId));
  const totalPlayTimeMs = sessions.reduce(
    (sum, s) => sum + sessionDurationMs(s, now.getTime()),
    0,
  );
  const totalSessions = sessions.length;
  const avgSessionMs =
    totalSessions > 0 ? Math.round(totalPlayTimeMs / totalSessions) : 0;

  const staleBefore = new Date(now.getTime() - presenceStaleMs());
  const currentlyOnline = await presenceCol.countDocuments({
    serverId: input.serverId,
    updatedAt: { $gte: staleBefore },
  });

  const liveMatch = live.find((s) => s.id === input.serverId);

  const summary: ServerStatsSummary = {
    range: input.range,
    serverId: input.serverId,
    serverName: def.name,
    uniquePlayers: unique.size,
    totalSessions,
    totalPlayTimeMs,
    avgSessionMs,
    currentlyOnline,
    livePlayers: liveMatch?.players ?? null,
    liveMaxPlayers: liveMatch?.maxPlayers ?? null,
    online: liveMatch?.online ?? false,
  };

  const recentLimit = input.recentLimit ?? 40;
  const recentSessions = sessions.slice(0, recentLimit);
  const users = await findUsersBySteamIds(
    recentSessions.map((s) => s.steamId),
  );
  const userBySteam = new Map(users.map((u) => [u.steamId, u]));

  const recent: ServerStatsRecentSession[] = recentSessions.map((s) => {
    const user = userBySteam.get(s.steamId);
    const active = isSessionActive(s, now.getTime());
    return {
      id: s._id,
      steamId: s.steamId,
      personaName: user?.personaName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      map: s.map,
      joinedAt: s.joinedAt.toISOString(),
      leftAt: s.leftAt?.toISOString() ?? null,
      lastSeenAt: s.lastSeenAt.toISOString(),
      durationMs: sessionDurationMs(s, now.getTime()),
      active,
    };
  });

  return {
    summary,
    recent,
    daily: buildDailyBuckets(sessions, input.range, now),
  };
}
