import "server-only";

import { findUsersBySteamIds } from "@/lib/auth/users";
import {
  ensureProfileIndexes,
  playerPresenceCollection,
  playerSessionsCollection,
  presenceStaleMs,
} from "@/lib/profile/collections";
import { getGameServerById, getGameServers } from "@/lib/servers/registry";
import { getLiveServers } from "@/lib/servers/status";
import type {
  FleetOverviewRecentSession,
  FleetOverviewResponse,
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

export async function getFleetConnectionStats(input: {
  range: ServerStatsRange;
  recentLimit?: number;
}): Promise<FleetOverviewResponse> {
  await ensureProfileIndexes();

  const now = new Date();
  const start = rangeStart(input.range, now);
  const col = await playerSessionsCollection();
  const filter = start ? { joinedAt: { $gte: start } } : {};

  const [fleet, sessions, presenceCol, live] = await Promise.all([
    getGameServers({ includeDisabled: true }),
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
    updatedAt: { $gte: staleBefore },
  });

  const enabled = fleet.filter((s) => s.enabled);
  const onlineServers = live.filter((s) => s.online).length;
  const livePlayers = live.reduce((sum, s) => sum + (s.players ?? 0), 0);
  const liveMaxPlayers = live.reduce((sum, s) => sum + (s.maxPlayers ?? 0), 0);
  const liveById = new Map(live.map((s) => [s.id, s]));

  const recentLimit = input.recentLimit ?? 12;
  const recentSessions = sessions.slice(0, recentLimit);
  const users = await findUsersBySteamIds(
    recentSessions.map((s) => s.steamId),
  );
  const userBySteam = new Map(users.map((u) => [u.steamId, u]));

  const recent: FleetOverviewRecentSession[] = recentSessions.map((s) => {
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
      serverId: s.serverId,
      serverName: s.serverName,
    };
  });

  return {
    summary: {
      range: input.range,
      uniquePlayers: unique.size,
      totalSessions,
      totalPlayTimeMs,
      avgSessionMs,
      currentlyOnline,
      livePlayers,
      liveMaxPlayers,
      onlineServers,
      totalServers: fleet.length,
      enabledServers: enabled.length,
    },
    recent,
    daily: buildDailyBuckets(sessions, input.range, now),
    servers: fleet.map((s) => {
      const match = liveById.get(s.id);
      return {
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        host: s.host,
        port: s.port,
        mode: s.mode,
        map: match?.map ?? s.map,
        region: s.region,
        city: s.city,
        enabled: s.enabled,
        featured: s.featured,
        players: match?.players ?? null,
        maxPlayers: match?.maxPlayers ?? s.maxPlayers,
        online: match?.online ?? false,
      };
    }),
  };
}

export async function listAdminSessions(input: {
  range: ServerStatsRange;
  serverId?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<FleetOverviewRecentSession[]> {
  await ensureProfileIndexes();
  const now = new Date();
  const start = rangeStart(input.range, now);
  const col = await playerSessionsCollection();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const filter: Record<string, unknown> = {};
  if (input.serverId) filter.serverId = input.serverId;
  if (start) filter.joinedAt = { $gte: start };
  if (input.activeOnly) {
    filter.leftAt = null;
    filter.lastSeenAt = {
      $gte: new Date(now.getTime() - presenceStaleMs() * 2),
    };
  }

  const sessions = await col
    .find(filter)
    .sort({ joinedAt: -1 })
    .limit(limit)
    .toArray();

  const users = await findUsersBySteamIds(sessions.map((s) => s.steamId));
  const userBySteam = new Map(users.map((u) => [u.steamId, u]));

  return sessions.map((s) => {
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
      serverId: s.serverId,
      serverName: s.serverName,
    };
  });
}
