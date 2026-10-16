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
import { getDb } from "@/lib/mongo";
import {
  recordLifetimePlayTime,
  recordLifetimeSessionStart,
  getLifetimeSessionStats,
} from "@/lib/profile/session-stats";
import { istDayBounds, istDayKey, listRecentIstDayKeys } from "@/lib/time/ist";
import { playerSessionRetentionSeconds } from "@/lib/profile/collections";
import {
  computeOverviewConcurrency,
  istDayOfWeekAndHour,
  overviewIstPeriod,
  retentionRate,
  MAX_ANALYTICS_SESSION_MS,
  type AnalyticsSession,
} from "@/lib/profile/overview-analytics";
import type {
  AdminAnalyticsRange,
  FleetOverviewRecentSession,
  FleetOverviewResponse,
  FleetAnalyticsComparison,
  FleetMonetizationAnalytics,
  FleetRetentionAnalytics,
  PlayerServerActivity,
  PlayerSessionDoc,
  ServerStatsDayBucket,
  ServerStatsRange,
  ServerStatsRecentSession,
  ServerStatsResponse,
  ServerStatsSummary,
} from "@/types/profile";
import type { Filter } from "mongodb";

/**
 * Retained server activity for one player in a single aggregation:
 * session count, play time, and first/last seen within the session retention
 * window. Returns empty totals for players with no sessions.
 */
export async function getPlayerServerActivity(
  steamId: string,
): Promise<PlayerServerActivity> {
  const windowDays = Math.round(playerSessionRetentionSeconds() / 86_400);
  const empty: PlayerServerActivity = {
    sessions: 0,
    playTimeMs: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    windowDays,
  };
  if (!/^\d{17}$/.test(steamId)) return empty;

  await ensureProfileIndexes();
  const col = await playerSessionsCollection();
  const [row] = await col
    .aggregate<{
      sessions: number;
      firstSeenAt: Date | null;
      lastSeenAt: Date | null;
      playTimeMs: number | null;
    }>([
      { $match: { steamId } },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          firstSeenAt: { $min: "$joinedAt" },
          lastSeenAt: { $max: "$lastSeenAt" },
          playTimeMs: {
            $sum: {
              $subtract: [{ $ifNull: ["$leftAt", "$lastSeenAt"] }, "$joinedAt"],
            },
          },
        },
      },
    ])
    .toArray();

  if (!row) return empty;

  const playTimeMs =
    typeof row.playTimeMs === "number" && Number.isFinite(row.playTimeMs)
      ? Math.max(0, Math.round(row.playTimeMs))
      : 0;

  return {
    sessions: row.sessions ?? 0,
    playTimeMs,
    firstSeenAt: row.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    windowDays,
  };
}

function rangeDayCount(range: ServerStatsRange): number {
  return range === "1d" ? 1 : range === "7d" ? 7 : 30;
}

export function isServerStatsRange(value: string): value is ServerStatsRange {
  return value === "1d" || value === "7d" || value === "30d";
}

/** Inclusive start of the range as an IST calendar window (not rolling hours). */
function rangeStart(range: ServerStatsRange, now = new Date()): Date {
  const dayCount = rangeDayCount(range);
  const { start: todayStart } = istDayBounds(istDayKey(now));
  return new Date(todayStart.getTime() - (dayCount - 1) * 24 * 60 * 60 * 1000);
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

/** Close matching open sessions and credit completed play time to lifetime stats. */
async function closeOpenSessions(
  filter: Filter<PlayerSessionDoc>,
  leftAt: Date,
  lastSeenAt = leftAt,
): Promise<void> {
  const col = await playerSessionsCollection();
  const open = await col.find({ ...filter, leftAt: null }).toArray();
  if (open.length === 0) return;

  let playTimeMs = 0;
  for (const session of open) {
    playTimeMs += Math.max(0, leftAt.getTime() - session.joinedAt.getTime());
  }

  await col.updateMany(
    { _id: { $in: open.map((s) => s._id) }, leftAt: null },
    { $set: { leftAt, lastSeenAt } },
  );
  await recordLifetimePlayTime(playTimeMs);
}

/** Close any open session whose last heartbeat is older than the presence TTL window. */
async function closeStaleOpenSession(steamId: string, serverId: string): Promise<void> {
  const col = await playerSessionsCollection();
  const staleBefore = new Date(Date.now() - presenceStaleMs() * 2);
  const stale = await col.findOne({
    steamId,
    serverId,
    leftAt: null,
    lastSeenAt: { $lt: staleBefore },
  });
  if (!stale) return;
  await closeOpenSessions({ _id: stale._id }, stale.lastSeenAt, stale.lastSeenAt);
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
  await closeOpenSessions(
    {
      steamId: input.steamId,
      serverId: { $ne: input.serverId },
    },
    now,
  );

  await closeStaleOpenSession(input.steamId, input.serverId);

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

  const playersOnlineAtJoin = await countLivePlayersOnServer(input.serverId);

  const doc: PlayerSessionDoc = {
    _id: crypto.randomUUID(),
    steamId: input.steamId,
    serverId: input.serverId,
    serverName: input.serverName,
    map: input.map,
    joinedAt: now,
    lastSeenAt: now,
    leftAt: null,
    playersOnlineAtJoin: Math.max(1, playersOnlineAtJoin),
  };
  await col.insertOne(doc);
  await recordLifetimeSessionStart(input.steamId);
}

export async function endPlayerSession(
  steamId: string,
  serverId?: string,
): Promise<void> {
  await ensureProfileIndexes();
  const now = new Date();
  const filter: Filter<PlayerSessionDoc> = serverId ? { steamId, serverId } : { steamId };
  await closeOpenSessions(filter, now);
}

export async function endServerSessions(serverId: string): Promise<void> {
  await ensureProfileIndexes();
  const now = new Date();
  await closeOpenSessions({ serverId }, now);
}

function sessionEndedAtMs(session: PlayerSessionDoc, nowMs: number): number {
  return sessionEndedAt(session, nowMs).getTime();
}

/** Whether `session` was still on the server at historical time `atMs`. */
function wasOnlineAt(session: PlayerSessionDoc, atMs: number): boolean {
  if (session.joinedAt.getTime() > atMs) return false;
  if (session.leftAt) return session.leftAt.getTime() > atMs;

  const lastSeen = session.lastSeenAt.getTime();
  // Session continued past this moment.
  if (lastSeen >= atMs) return true;
  // Unclosed but already stale by `atMs` → ghost; do not count.
  const staleMs = presenceStaleMs() * 2;
  return lastSeen + staleMs > atMs;
}

/**
 * Unique players on the same server at `target.joinedAt`.
 * Prefer stored `playersOnlineAtJoin` when present (true live snapshot).
 */
function concurrentAtJoin(target: PlayerSessionDoc, pool: PlayerSessionDoc[]): number {
  if (typeof target.playersOnlineAtJoin === "number" && target.playersOnlineAtJoin >= 1) {
    return target.playersOnlineAtJoin;
  }

  const joinMs = target.joinedAt.getTime();
  const steamIds = new Set<string>();
  for (const other of pool) {
    if (other.serverId !== target.serverId) continue;
    if (!wasOnlineAt(other, joinMs)) continue;
    steamIds.add(other.steamId);
  }
  steamIds.add(target.steamId);
  return steamIds.size;
}

/** Live presence count on a server (fresh heartbeats only). */
async function countLivePlayersOnServer(serverId: string): Promise<number> {
  const presenceCol = await playerPresenceCollection();
  const staleBefore = new Date(Date.now() - presenceStaleMs());
  return presenceCol.countDocuments({
    serverId,
    updatedAt: { $gte: staleBefore },
  });
}

/** Sessions that joined in-range, plus any still overlapping the window (for peak). */
function sessionsOverlappingRangeFilter(start: Date): Filter<PlayerSessionDoc> {
  return {
    $or: [
      { joinedAt: { $gte: start } },
      {
        joinedAt: { $lt: start },
        $or: [{ leftAt: null }, { leftAt: { $gte: start } }],
      },
    ],
  };
}

function sessionsOverlappingWindowFilter(
  start: Date,
  end: Date,
): Filter<PlayerSessionDoc> {
  return {
    joinedAt: { $lt: end },
    $or: [{ leftAt: null }, { leftAt: { $gte: start } }],
  };
}

/** Peak simultaneous players on one server during a day window. */
function peakConcurrentInWindow(
  sessions: PlayerSessionDoc[],
  windowStartMs: number,
  windowEndMs: number,
  nowMs: number,
): number {
  const byServer = new Map<string, PlayerSessionDoc[]>();
  for (const session of sessions) {
    const start = session.joinedAt.getTime();
    const end = sessionEndedAtMs(session, nowMs);
    if (end <= windowStartMs || start >= windowEndMs) continue;
    const list = byServer.get(session.serverId) ?? [];
    list.push(session);
    byServer.set(session.serverId, list);
  }

  let peak = 0;
  for (const list of byServer.values()) {
    const events: Array<{ t: number; delta: number }> = [];
    for (const session of list) {
      const start = Math.max(session.joinedAt.getTime(), windowStartMs);
      const end = Math.min(sessionEndedAtMs(session, nowMs), windowEndMs);
      if (end <= start) continue;
      events.push({ t: start, delta: 1 });
      events.push({ t: end, delta: -1 });
    }
    // Process leaves before joins at the same timestamp so churn doesn't
    // inflate peak; still counts true overlap when joins stack.
    events.sort((a, b) => a.t - b.t || a.delta - b.delta);
    let current = 0;
    for (const event of events) {
      current += event.delta;
      if (current > peak) peak = current;
    }
  }
  return peak;
}

/** Max At-join column value for sessions that joined during the window. */
function peakConcurrentAtJoinInWindow(
  sessions: PlayerSessionDoc[],
  pool: PlayerSessionDoc[],
  windowStartMs: number,
  windowEndMs: number,
): number {
  let peak = 0;
  for (const session of sessions) {
    const joinMs = session.joinedAt.getTime();
    if (joinMs < windowStartMs || joinMs >= windowEndMs) continue;
    peak = Math.max(peak, concurrentAtJoin(session, pool));
  }
  return peak;
}

/** Mean At-join column value for sessions that joined during the window. */
function avgConcurrentAtJoinInWindow(
  sessions: PlayerSessionDoc[],
  pool: PlayerSessionDoc[],
  windowStartMs: number,
  windowEndMs: number,
): number {
  let sum = 0;
  let count = 0;
  for (const session of sessions) {
    const joinMs = session.joinedAt.getTime();
    if (joinMs < windowStartMs || joinMs >= windowEndMs) continue;
    sum += concurrentAtJoin(session, pool);
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((sum / count) * 10) / 10;
}

function buildDailyBuckets(
  sessions: PlayerSessionDoc[],
  range: ServerStatsRange,
  now: Date,
): ServerStatsDayBucket[] {
  const rangeStartMs = rangeStart(range, now).getTime();
  const nowMs = now.getTime();
  const dayKeys = listRecentIstDayKeys(rangeDayCount(range), now);

  const buckets: ServerStatsDayBucket[] = [];
  for (const dayKey of dayKeys) {
    const { start: dayStart, end: dayEnd } = istDayBounds(dayKey);
    if (dayEnd.getTime() <= rangeStartMs) continue;

    const windowStartMs = dayStart.getTime();
    const windowEndMs = dayEnd.getTime();

    const inDay = sessions.filter((s) => {
      const joined = s.joinedAt.getTime();
      return joined >= windowStartMs && joined < windowEndMs;
    });
    const unique = new Set(inDay.map((s) => s.steamId));
    const sweepPeak = peakConcurrentInWindow(sessions, windowStartMs, windowEndMs, nowMs);
    const joinPeak = peakConcurrentAtJoinInWindow(
      sessions,
      sessions,
      windowStartMs,
      windowEndMs,
    );
    buckets.push({
      date: dayKey,
      complete: true,
      uniquePlayers: unique.size,
      sessions: inDay.length,
      newPlayers: 0,
      returningPlayers: 0,
      unclassifiedPlayers: unique.size,
      playTimeMs: 0,
      // Match Sessions "Online" column (max at join) and true overlap peak.
      peakConcurrent: Math.max(sweepPeak, joinPeak),
      avgConcurrent: avgConcurrentAtJoinInWindow(
        sessions,
        sessions,
        windowStartMs,
        windowEndMs,
      ),
      primeTimeAvgConcurrent: 0,
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

  const filter: Filter<PlayerSessionDoc> = {
    serverId: input.serverId,
    ...sessionsOverlappingRangeFilter(start),
  };

  const [allSessions, presenceCol, live] = await Promise.all([
    col.find(filter).sort({ joinedAt: -1 }).toArray(),
    playerPresenceCollection(),
    getLiveServers().catch(() => []),
  ]);

  // Summary / recent use in-range joins only; overlap pool is for peak concurrent.
  const sessions = allSessions.filter((s) => s.joinedAt.getTime() >= start.getTime());

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
  const users = await findUsersBySteamIds(recentSessions.map((s) => s.steamId));
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
      concurrentAtJoin: concurrentAtJoin(s, allSessions),
    };
  });

  return {
    summary,
    recent,
    daily: buildDailyBuckets(allSessions, input.range, now),
  };
}

function sessionEndForAnalytics(session: PlayerSessionDoc, nowMs: number): number {
  if (session.leftAt) return session.leftAt.getTime();
  return nowMs - session.lastSeenAt.getTime() <= presenceStaleMs() * 2
    ? nowMs
    : session.lastSeenAt.getTime();
}

function summarizePlayers(input: {
  sessions: PlayerSessionDoc[];
  firstSeenBySteam: Map<string, Date>;
  start: Date;
  end: Date;
  now: Date;
}): {
  players: Set<string>;
  newPlayers: number;
  returningPlayers: number;
  unclassifiedPlayers: number;
  sessions: PlayerSessionDoc[];
} {
  const sessions = input.sessions.filter(
    (session) => session.joinedAt >= input.start && session.joinedAt < input.end,
  );
  const activeSessions = input.sessions.filter((session) => {
    const endMs = sessionEndForAnalytics(session, input.now.getTime());
    return (
      endMs - session.joinedAt.getTime() <= MAX_ANALYTICS_SESSION_MS &&
      session.joinedAt < input.end &&
      endMs > input.start.getTime()
    );
  });
  const players = new Set(activeSessions.map((session) => session.steamId));
  let newPlayers = 0;
  let returningPlayers = 0;
  let unclassifiedPlayers = 0;
  for (const steamId of players) {
    const firstSeen = input.firstSeenBySteam.get(steamId);
    if (!firstSeen) {
      unclassifiedPlayers += 1;
    } else if (firstSeen >= input.start && firstSeen < input.end) {
      newPlayers += 1;
    } else {
      returningPlayers += 1;
    }
  }
  return {
    players,
    newPlayers,
    returningPlayers,
    unclassifiedPlayers,
    sessions,
  };
}

function calculateRetention(input: {
  firstSeenBySteam: Map<string, Date>;
  activityByPlayer: Map<string, Set<string>>;
  window: { start: Date; end: Date };
  todayStart: Date;
  coverageStart: Date;
  multiDayPlayers: number;
}): FleetRetentionAnalytics {
  const cohorts = [...input.firstSeenBySteam.entries()].filter(
    ([, firstSeen]) => firstSeen >= input.window.start && firstSeen < input.window.end,
  );
  const rate = (offset: 1 | 7 | 30) => {
    const mature = cohorts.filter(([, firstSeen]) => {
      const cohortDay = istDayBounds(istDayKey(firstSeen)).start;
      const returnDay = new Date(cohortDay.getTime() + offset * 86_400_000);
      return (
        returnDay.getTime() + 86_400_000 <= input.todayStart.getTime() &&
        returnDay >= input.coverageStart
      );
    });
    if (mature.length === 0) return { percent: null, count: 0 };
    const retained = mature.filter(([steamId, firstSeen]) =>
      retentionRate({
        firstSeenAt: firstSeen,
        activityByPlayer: input.activityByPlayer,
        steamId,
        dayOffset: offset,
      }),
    ).length;
    return {
      percent: Math.round((retained / mature.length) * 1000) / 10,
      count: mature.length,
    };
  };
  const d1 = rate(1);
  const d7 = rate(7);
  const d30 = rate(30);
  const cohortsByDay = new Map<string, Array<[string, Date]>>();
  for (const [steamId, firstSeen] of cohorts) {
    const date = istDayKey(firstSeen);
    const rows = cohortsByDay.get(date) ?? [];
    rows.push([steamId, firstSeen]);
    cohortsByDay.set(date, rows);
  }
  const cohortRows = [...cohortsByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, players]) => {
      const cohortDay = istDayBounds(date).start;
      const retainedCount = (offset: 1 | 7 | 30) => {
        const returnDay = new Date(cohortDay.getTime() + offset * 86_400_000);
        const mature =
          returnDay.getTime() + 86_400_000 <= input.todayStart.getTime() &&
          returnDay >= input.coverageStart;
        if (!mature) return null;
        return players.filter(([steamId, firstSeen]) =>
          retentionRate({
            firstSeenAt: firstSeen,
            activityByPlayer: input.activityByPlayer,
            steamId,
            dayOffset: offset,
          }),
        ).length;
      };
      const d1Retained = retainedCount(1);
      const d7Retained = retainedCount(7);
      const d30Retained = retainedCount(30);
      return {
        date,
        players: players.length,
        d1Retained,
        d1Percent:
          d1Retained == null
            ? null
            : Math.round((d1Retained / players.length) * 1000) / 10,
        d7Retained,
        d7Percent:
          d7Retained == null
            ? null
            : Math.round((d7Retained / players.length) * 1000) / 10,
        d30Retained,
        d30Percent:
          d30Retained == null
            ? null
            : Math.round((d30Retained / players.length) * 1000) / 10,
      };
    });
  const now = new Date();
  const coverageDays = Math.max(
    0,
    Math.floor((now.getTime() - input.coverageStart.getTime()) / 86_400_000),
  );
  return {
    d1Percent: d1.percent,
    d1CohortPlayers: d1.count,
    d7Percent: d7.percent,
    d7CohortPlayers: d7.count,
    d30Percent: d30.percent,
    d30CohortPlayers: d30.count,
    multiDayPlayers: input.multiDayPlayers,
    coverageStart: input.coverageStart.toISOString(),
    coverageDays,
    incompleteHistory: input.window.start < input.coverageStart,
    cohorts: cohortRows,
  };
}

type AnalyticsPayment = {
  userId: string;
  steamId: string;
  status: string;
  amount: number;
  durationDays: number;
  plan: string;
  accessType?: string;
  serverId?: string | null;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  createdAt: Date;
};

function summarizeMonetization(input: {
  payments: AnalyticsPayment[];
  start: Date;
  end: Date;
  now: Date;
  freeVipUsers: number;
  activePlayerSteamIds: Set<string>;
  playerConversionAvailable: boolean;
}): FleetMonetizationAnalytics {
  const captured = input.payments.filter(
    (payment) =>
      (payment.status === "captured" || payment.status === "refunded") &&
      payment.paidAt != null &&
      payment.paidAt >= input.start &&
      payment.paidAt < input.end,
  );
  const refunds = input.payments.filter(
    (payment) =>
      payment.status === "refunded" &&
      payment.refundedAt != null &&
      payment.refundedAt >= input.start &&
      payment.refundedAt < input.end,
  );
  const grossCapturedPaise = captured.reduce((sum, payment) => sum + payment.amount, 0);
  const refundsPaise = refunds.reduce((sum, payment) => sum + payment.amount, 0);
  const monthlyEquivalentPaise =
    captured.reduce(
      (sum, payment) => sum + (payment.amount * 30) / Math.max(1, payment.durationDays),
      0,
    ) -
    refunds.reduce(
      (sum, payment) => sum + (payment.amount * 30) / Math.max(1, payment.durationDays),
      0,
    );
  const nonRefundedCaptures = captured.filter((payment) => payment.status === "captured");
  const payingCustomers = new Set(nonRefundedCaptures.map((payment) => payment.userId));
  const payingActivePlayers = new Set(
    nonRefundedCaptures
      .filter((payment) => input.activePlayerSteamIds.has(payment.steamId))
      .map((payment) => payment.steamId),
  );
  const checkoutPayments = input.payments.filter(
    (payment) => payment.createdAt >= input.start && payment.createdAt < input.end,
  );
  const checkoutUsers = new Set(checkoutPayments.map((payment) => payment.userId));
  const convertedUsers = new Set(
    checkoutPayments
      .filter((payment) => payment.status === "captured" && payment.paidAt != null)
      .map((payment) => payment.userId),
  );
  const abandonedCheckouts = input.payments.filter(
    (payment) =>
      payment.status === "created" &&
      payment.createdAt >= input.start &&
      payment.createdAt < input.end &&
      input.now.getTime() - payment.createdAt.getTime() >= 30 * 60_000,
  ).length;

  const plans = new Map<
    string,
    {
      plan: string;
      accessType: string;
      purchases: number;
      grossPaise: number;
      monthlyEquivalentPaise: number;
    }
  >();
  for (const payment of captured) {
    const accessType =
      payment.accessType ?? (payment.serverId ? "INDIVIDUAL_SERVER" : "ALL_RETAKES");
    const key = `${payment.plan}:${accessType}`;
    const row = plans.get(key) ?? {
      plan: payment.plan,
      accessType,
      purchases: 0,
      grossPaise: 0,
      monthlyEquivalentPaise: 0,
    };
    row.purchases += 1;
    row.grossPaise += payment.amount;
    row.monthlyEquivalentPaise +=
      (payment.amount * 30) / Math.max(1, payment.durationDays);
    plans.set(key, row);
  }
  for (const payment of refunds) {
    const accessType =
      payment.accessType ?? (payment.serverId ? "INDIVIDUAL_SERVER" : "ALL_RETAKES");
    const row = plans.get(`${payment.plan}:${accessType}`);
    if (row) {
      row.monthlyEquivalentPaise -=
        (payment.amount * 30) / Math.max(1, payment.durationDays);
    }
  }

  return {
    grossCapturedPaise,
    refundsPaise,
    netRevenuePaise: grossCapturedPaise - refundsPaise,
    monthlyEquivalentPaise,
    payingCustomers: payingCustomers.size,
    successfulPurchases: captured.length,
    abandonedCheckouts,
    checkoutUsers: checkoutUsers.size,
    checkoutConversionPercent:
      checkoutUsers.size > 0
        ? Math.round((convertedUsers.size / checkoutUsers.size) * 1000) / 10
        : null,
    playerToPayingPercent:
      input.playerConversionAvailable && input.activePlayerSteamIds.size > 0
        ? Math.round(
            (payingActivePlayers.size / input.activePlayerSteamIds.size) * 1000,
          ) / 10
        : null,
    payingActivePlayers: payingActivePlayers.size,
    freeVipUsers: input.freeVipUsers,
    feesPaise: null,
    revenueByPlan: [...plans.values()],
  };
}

export async function getFleetConnectionStats(input: {
  range: AdminAnalyticsRange;
  customStart?: string;
  customEnd?: string;
  recentLimit?: number;
}): Promise<FleetOverviewResponse> {
  await ensureProfileIndexes();

  const now = new Date();
  const todayStart = istDayBounds(istDayKey(now)).start;
  const periods = overviewIstPeriod(input.range, input.customStart, input.customEnd, now);
  const coverageStart = new Date(now.getTime() - playerSessionRetentionSeconds() * 1000);
  const col = await playerSessionsCollection();
  const db = await getDb();
  const sessionsStart = new Date(
    Math.max(
      coverageStart.getTime(),
      Math.min(periods.previous.start.getTime(), periods.current.start.getTime()),
    ),
  );
  const paymentsStart = new Date(
    Math.min(periods.previous.start.getTime(), periods.current.start.getTime()),
  );
  const [
    fleet,
    allSessions,
    presenceCol,
    live,
    lifetime,
    firstSeenRows,
    payments,
    freeVipRows,
    serverCreationRows,
  ] = await Promise.all([
    getGameServers({ includeDisabled: true }),
    col
      .find(sessionsOverlappingWindowFilter(sessionsStart, now))
      .sort({ joinedAt: -1 })
      .toArray(),
    playerPresenceCollection(),
    getLiveServers().catch(() => []),
    getLifetimeSessionStats(),
    db
      .collection<{ steamId: string; firstSeenAt: Date }>("session_unique_players")
      .find({}, { projection: { _id: 0, steamId: 1, firstSeenAt: 1 } })
      .toArray(),
    db
      .collection<AnalyticsPayment>("payments")
      .find(
        {
          $or: [
            { paidAt: { $gte: paymentsStart, $lt: now } },
            { refundedAt: { $gte: paymentsStart, $lt: now } },
            { createdAt: { $gte: paymentsStart, $lt: now } },
          ],
        },
        {
          projection: {
            userId: 1,
            steamId: 1,
            status: 1,
            amount: 1,
            durationDays: 1,
            plan: 1,
            accessType: 1,
            serverId: 1,
            paidAt: 1,
            refundedAt: 1,
            createdAt: 1,
          },
        },
      )
      .toArray(),
    db
      .collection<{ userId: string }>("user_roles")
      .find(
        {
          roleCode: { $in: ["VIP", "FOUNDING_MEMBER"] },
          active: true,
          source: { $ne: "PURCHASE" },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        },
        { projection: { _id: 0, userId: 1 } },
      )
      .toArray(),
    db
      .collection<{ id: string; createdAt: Date }>("game_servers")
      .find({}, { projection: { _id: 0, id: 1, createdAt: 1 } })
      .toArray(),
  ]);

  const firstSeenBySteam = new Map(
    firstSeenRows.map((row) => [row.steamId, row.firstSeenAt]),
  );
  const currentPlayers = summarizePlayers({
    sessions: allSessions,
    firstSeenBySteam,
    start: periods.current.start,
    end: periods.current.end,
    now,
  });
  const previousPlayers = summarizePlayers({
    sessions: allSessions,
    firstSeenBySteam,
    start: periods.previous.start,
    end: periods.previous.end,
    now,
  });
  const capacities = new Map(
    fleet.map((server) => [
      server.id,
      server.maxPlayersOverride ?? server.maxPlayers ?? null,
    ]),
  );
  const serverAvailableFrom = new Map(
    serverCreationRows.map((server) => [server.id, server.createdAt]),
  );
  const sessionInputs = allSessions as AnalyticsSession[];
  const currentConcurrency = computeOverviewConcurrency({
    sessions: sessionInputs,
    capacities,
    serverAvailableFrom,
    window: periods.current,
    now,
    staleAfterMs: presenceStaleMs() * 2,
    coverageStart,
  });
  const previousConcurrency = computeOverviewConcurrency({
    sessions: sessionInputs,
    capacities,
    serverAvailableFrom,
    window: periods.previous,
    now,
    staleAfterMs: presenceStaleMs() * 2,
    coverageStart,
  });
  const totalAttributedPlayTime = (concurrency: typeof currentConcurrency) =>
    [...concurrency.servers.values()].reduce((sum, server) => sum + server.playTimeMs, 0);
  const currentPlayTimeMs = totalAttributedPlayTime(currentConcurrency);
  const previousPlayTimeMs = totalAttributedPlayTime(previousConcurrency);
  const currentTotalSessions = currentPlayers.sessions.length;
  const previousTotalSessions = previousPlayers.sessions.length;
  const observedDurations: number[] = [];
  const durationBuckets = [
    { key: "under-2m", label: "< 2 min", count: 0 },
    { key: "2-5m", label: "2–5 min", count: 0 },
    { key: "5-10m", label: "5–10 min", count: 0 },
    { key: "10-20m", label: "10–20 min", count: 0 },
    { key: "20-30m", label: "20–30 min", count: 0 },
    { key: "over-30m", label: "> 30 min", count: 0 },
  ];
  for (const session of currentPlayers.sessions) {
    const endMs = Math.min(
      sessionEndForAnalytics(session, now.getTime()),
      periods.current.end.getTime(),
    );
    const elapsedMs = endMs - session.joinedAt.getTime();
    if (elapsedMs < 0 || elapsedMs > MAX_ANALYTICS_SESSION_MS) continue;
    observedDurations.push(elapsedMs);
    const bucket =
      elapsedMs < 2 * 60_000
        ? durationBuckets[0]
        : elapsedMs < 5 * 60_000
          ? durationBuckets[1]
          : elapsedMs < 10 * 60_000
            ? durationBuckets[2]
            : elapsedMs < 20 * 60_000
              ? durationBuckets[3]
              : elapsedMs < 30 * 60_000
                ? durationBuckets[4]
                : durationBuckets[5];
    bucket!.count += 1;
  }
  const currentAvgSessionMs = observedDurations.length
    ? Math.round(
        observedDurations.reduce((sum, duration) => sum + duration, 0) /
          observedDurations.length,
      )
    : 0;
  const previousObservedDurations = previousPlayers.sessions
    .map(
      (session) =>
        Math.min(
          sessionEndForAnalytics(session, now.getTime()),
          periods.previous.end.getTime(),
        ) - session.joinedAt.getTime(),
    )
    .filter((duration) => duration >= 0 && duration <= MAX_ANALYTICS_SESSION_MS);
  const previousAvgSessionMs = previousObservedDurations.length
    ? Math.round(
        previousObservedDurations.reduce((sum, duration) => sum + duration, 0) /
          previousObservedDurations.length,
      )
    : 0;

  const staleBefore = new Date(now.getTime() - presenceStaleMs());
  const currentlyOnline = await presenceCol.countDocuments({
    updatedAt: { $gte: staleBefore },
  });

  const enabled = fleet.filter((s) => s.enabled);
  const onlineServers = live.filter((s) => s.online).length;
  const livePlayers = live.reduce((sum, s) => sum + (s.players ?? 0), 0);
  const liveMaxPlayers = live.reduce((sum, s) => sum + (s.maxPlayers ?? 0), 0);
  const liveById = new Map(live.map((s) => [s.id, s]));

  const recentLimit = Math.min(Math.max(input.recentLimit ?? 100, 1), 200);
  const recentSessions = currentPlayers.sessions.slice(0, recentLimit);
  const users = await findUsersBySteamIds(recentSessions.map((s) => s.steamId));
  const userBySteam = new Map(users.map((u) => [u.steamId, u]));
  const serverNameById = new Map(fleet.map((s) => [s.id, s.name]));
  const activitySince = (start: Date) => {
    const activity = new Map<string, Set<string>>();
    for (const session of allSessions) {
      if (session.joinedAt < start || session.joinedAt >= now) continue;
      const days = activity.get(session.steamId) ?? new Set<string>();
      days.add(istDayKey(session.joinedAt));
      activity.set(session.steamId, days);
    }
    return activity;
  };
  const currentActivityByPlayer = activitySince(periods.current.start);
  const previousActivityByPlayer = activitySince(periods.previous.start);
  const sessionsByDay = new Map<string, PlayerSessionDoc[]>();
  for (const session of currentPlayers.sessions) {
    const day = istDayKey(session.joinedAt);
    const items = sessionsByDay.get(day) ?? [];
    items.push(session);
    sessionsByDay.set(day, items);
  }
  const currentDailyActiveByPlayer = new Map<string, Set<string>>();
  const dayBuckets = listRecentIstDayKeys(
    periods.dayCount,
    new Date(periods.current.end.getTime() - 1),
  ).map((date) => {
    const { start: dayStart, end: dayEnd } = istDayBounds(date);
    const daySessions = sessionsByDay.get(date) ?? [];
    const uniquePlayers = new Set<string>();
    for (const session of allSessions) {
      const sessionEnd = sessionEndForAnalytics(session, now.getTime());
      if (
        sessionEnd - session.joinedAt.getTime() <= MAX_ANALYTICS_SESSION_MS &&
        session.joinedAt.getTime() < dayEnd.getTime() &&
        sessionEnd > dayStart.getTime()
      ) {
        uniquePlayers.add(session.steamId);
        const activeDays =
          currentDailyActiveByPlayer.get(session.steamId) ?? new Set<string>();
        activeDays.add(date);
        currentDailyActiveByPlayer.set(session.steamId, activeDays);
      }
    }
    let newPlayers = 0;
    let returningPlayers = 0;
    let unclassifiedPlayers = 0;
    for (const steamId of uniquePlayers) {
      const firstSeen = firstSeenBySteam.get(steamId);
      if (!firstSeen) {
        unclassifiedPlayers += 1;
        continue;
      }
      if (
        firstSeen >= dayStart &&
        firstSeen < new Date(dayStart.getTime() + 86_400_000)
      ) {
        newPlayers += 1;
      } else {
        returningPlayers += 1;
      }
    }
    const concurrency = currentConcurrency.daily.get(date);
    return {
      date,
      complete: dayStart >= coverageStart,
      uniquePlayers: uniquePlayers.size,
      sessions: daySessions.length,
      newPlayers,
      returningPlayers,
      unclassifiedPlayers,
      playTimeMs: concurrency?.playTimeMs ?? 0,
      peakConcurrent: concurrency?.peakConcurrent ?? 0,
      avgConcurrent: concurrency?.avgConcurrent ?? 0,
      primeTimeAvgConcurrent: concurrency?.primeTimeAvgConcurrent ?? 0,
    };
  });

  const multiDayPlayers = [...currentDailyActiveByPlayer.values()].filter(
    (days) => days.size > 1,
  ).length;
  const previousMultiDayPlayers = [...previousActivityByPlayer.values()].filter(
    (days) => days.size > 1,
  ).length;
  const retention = calculateRetention({
    firstSeenBySteam,
    activityByPlayer: currentActivityByPlayer,
    window: periods.current,
    todayStart,
    coverageStart,
    multiDayPlayers,
  });
  const previousRetention = calculateRetention({
    firstSeenBySteam,
    activityByPlayer: previousActivityByPlayer,
    window: periods.previous,
    todayStart,
    coverageStart,
    multiDayPlayers: previousMultiDayPlayers,
  });
  const freeVipUsers = new Set(freeVipRows.map((row) => row.userId)).size;
  const monetization = summarizeMonetization({
    payments,
    start: periods.current.start,
    end: periods.current.end,
    now,
    freeVipUsers,
    activePlayerSteamIds: currentPlayers.players,
    playerConversionAvailable: periods.current.start >= coverageStart,
  });
  const previousMonetization = summarizeMonetization({
    payments,
    start: periods.previous.start,
    end: periods.previous.end,
    now,
    freeVipUsers,
    activePlayerSteamIds: previousPlayers.players,
    playerConversionAvailable: periods.previous.start >= coverageStart,
  });
  const currentJoinedUnique = currentPlayers.players.size;
  const previousJoinedUnique = previousPlayers.players.size;
  const previousPeriod: FleetAnalyticsComparison = {
    available: periods.previous.start >= coverageStart,
    uniquePlayers: previousJoinedUnique,
    newPlayers: previousPlayers.newPlayers,
    returningPlayers: previousPlayers.returningPlayers,
    totalSessions: previousTotalSessions,
    totalPlayTimeMs: previousPlayTimeMs,
    avgSessionMs: previousAvgSessionMs,
    avgConcurrent: previousConcurrency.avgConcurrent,
    payingCustomers: previousMonetization.payingCustomers,
    netRevenuePaise: previousMonetization.netRevenuePaise,
    d1RetentionPercent: previousRetention.d1Percent,
    d7RetentionPercent: previousRetention.d7Percent,
    d30RetentionPercent: previousRetention.d30Percent,
  };

  const sessionsByPlayer = new Map<string, PlayerSessionDoc[]>();
  for (const session of allSessions) {
    const rows = sessionsByPlayer.get(session.steamId) ?? [];
    rows.push(session);
    sessionsByPlayer.set(session.steamId, rows);
  }
  const acquiredByServer = new Map<string, Set<string>>();
  for (const [steamId, firstSeen] of firstSeenBySteam) {
    if (firstSeen < periods.current.start || firstSeen >= periods.current.end) continue;
    const cohortDate = istDayKey(firstSeen);
    const cohortStart = istDayBounds(cohortDate).start;
    const firstSession = (sessionsByPlayer.get(steamId) ?? [])
      .filter(
        (session) =>
          istDayKey(session.joinedAt) === cohortDate && session.joinedAt >= cohortStart,
      )
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
    if (!firstSession) continue;
    const players = acquiredByServer.get(firstSession.serverId) ?? new Set<string>();
    players.add(steamId);
    acquiredByServer.set(firstSession.serverId, players);
  }
  const retentionForServerCohort = (serverId: string, dayOffset: 1 | 7) => {
    const cohortPlayers = [...(acquiredByServer.get(serverId) ?? [])].filter(
      (steamId) => {
        const firstSeen = firstSeenBySteam.get(steamId);
        if (!firstSeen) return false;
        const targetDay = new Date(
          istDayBounds(istDayKey(firstSeen)).start.getTime() + dayOffset * 86_400_000,
        );
        return (
          targetDay.getTime() + 86_400_000 <= todayStart.getTime() &&
          targetDay >= coverageStart
        );
      },
    );
    if (cohortPlayers.length === 0) return { count: 0, percent: null };
    const returned = cohortPlayers.filter((steamId) => {
      const firstSeen = firstSeenBySteam.get(steamId)!;
      return retentionRate({
        firstSeenAt: firstSeen,
        activityByPlayer: currentActivityByPlayer,
        steamId,
        dayOffset,
      });
    }).length;
    return {
      count: cohortPlayers.length,
      percent: Math.round((returned / cohortPlayers.length) * 1000) / 10,
    };
  };

  const serverAnalytics = fleet.map((server) => {
    const serverSessions = currentPlayers.sessions.filter(
      (session) => session.serverId === server.id,
    );
    const serverUnique = new Set(serverSessions.map((session) => session.steamId));
    const serverNewPlayers = [...serverUnique].filter((steamId) => {
      const firstSeen = firstSeenBySteam.get(steamId);
      return (
        firstSeen && firstSeen >= periods.current.start && firstSeen < periods.current.end
      );
    }).length;
    const serverReturningPlayers = [...serverUnique].filter((steamId) => {
      const firstSeen = firstSeenBySteam.get(steamId);
      return firstSeen && firstSeen < periods.current.start;
    }).length;
    const serverD1 = retentionForServerCohort(server.id, 1);
    const serverD7 = retentionForServerCohort(server.id, 7);
    const concurrent = currentConcurrency.servers.get(server.id);
    return {
      id: server.id,
      sessions: serverSessions.length,
      uniquePlayers: serverUnique.size,
      newPlayers: serverNewPlayers,
      returningPlayers: serverReturningPlayers,
      unclassifiedPlayers: serverUnique.size - serverNewPlayers - serverReturningPlayers,
      d1RetentionPercent: serverD1.percent,
      d1CohortPlayers: serverD1.count,
      d7RetentionPercent: serverD7.percent,
      d7CohortPlayers: serverD7.count,
      totalPlayTimeMs: concurrent?.playTimeMs ?? 0,
      observedMs: concurrent?.observedMs ?? 0,
      avgConcurrent: concurrent?.avgConcurrent ?? 0,
      primeTimeAvgConcurrent: concurrent?.primeTimeAvgConcurrent ?? 0,
      peakConcurrent: concurrent?.peakConcurrent ?? 0,
      utilization: concurrent?.utilization ?? {
        emptyPercent: 100,
        oneToFourPercent: 0,
        fiveToNinePercent: 0,
        tenPlusPercent: 0,
      },
      capacity: server.maxPlayersOverride ?? server.maxPlayers ?? null,
      overCapacityMinutes: Math.round((concurrent?.overCapacityMs ?? 0) / 60_000),
    };
  });
  const sessionStartsByHour = new Map<string, { count: number; players: Set<string> }>();
  for (const session of currentPlayers.sessions) {
    const { dayOfWeek, hour } = istDayOfWeekAndHour(session.joinedAt);
    const key = `${dayOfWeek}:${hour}`;
    const row = sessionStartsByHour.get(key) ?? { count: 0, players: new Set<string>() };
    row.count += 1;
    row.players.add(session.steamId);
    sessionStartsByHour.set(key, row);
  }
  const occurrencesByDayOfWeek = new Map<number, number>();
  for (const date of listRecentIstDayKeys(
    periods.dayCount,
    new Date(periods.current.end.getTime() - 1),
  )) {
    const dayStart = istDayBounds(date).start;
    if (dayStart < coverageStart) continue;
    const dayOfWeek = istDayOfWeekAndHour(dayStart).dayOfWeek;
    occurrencesByDayOfWeek.set(
      dayOfWeek,
      (occurrencesByDayOfWeek.get(dayOfWeek) ?? 0) + 1,
    );
  }
  const activityHeatmap = Array.from({ length: 7 * 24 }, (_, index) => {
    const dayOfWeek = Math.floor(index / 24);
    const hour = index % 24;
    const sums = currentConcurrency.hourly.get(`${dayOfWeek}:${hour}`);
    const starts = sessionStartsByHour.get(`${dayOfWeek}:${hour}`);
    return {
      dayOfWeek,
      hour,
      avgConcurrent:
        sums && sums.elapsedMs > 0
          ? Math.round((sums.playerMs / sums.elapsedMs) * 10) / 10
          : 0,
      sessionStarts: starts?.count ?? 0,
      distinctPlayers: starts?.players.size ?? 0,
      occurrenceDays: occurrencesByDayOfWeek.get(dayOfWeek) ?? 0,
    };
  });

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
      durationMs: Math.max(
        0,
        Math.min(
          sessionEndForAnalytics(s, now.getTime()),
          periods.current.end.getTime(),
        ) - s.joinedAt.getTime(),
      ),
      active,
      concurrentAtJoin: concurrentAtJoin(s, allSessions),
      serverId: s.serverId,
      serverName: s.serverName || serverNameById.get(s.serverId) || s.serverId,
      role: user?.role ?? null,
      firstEverPlayer: firstSeenBySteam.has(s.steamId)
        ? firstSeenBySteam.get(s.steamId)! >= periods.current.start &&
          firstSeenBySteam.get(s.steamId)! < periods.current.end
        : null,
    };
  });

  return {
    summary: {
      range: input.range,
      uniquePlayers: currentJoinedUnique,
      newPlayers: currentPlayers.newPlayers,
      returningPlayers: currentPlayers.returningPlayers,
      unclassifiedPlayers: currentPlayers.unclassifiedPlayers,
      totalSessions: currentTotalSessions,
      totalPlayTimeMs: currentPlayTimeMs,
      avgSessionMs: currentAvgSessionMs,
      avgConcurrent: currentConcurrency.avgConcurrent,
      primeTimeAvgConcurrent: currentConcurrency.primeTimeAvgConcurrent,
      peakConcurrent: currentConcurrency.peakConcurrent,
      overCapacityMinutes: Math.round(currentConcurrency.overCapacityMs / 60_000),
      currentlyOnline,
      livePlayers,
      liveMaxPlayers,
      onlineServers,
      totalServers: fleet.length,
      enabledServers: enabled.length,
    },
    lifetime,
    period: {
      range: input.range,
      start: periods.current.start.toISOString(),
      endExclusive: periods.current.end.toISOString(),
      label: periods.label,
      includesCurrentDay: false,
    },
    previousPeriod,
    retention,
    monetization,
    activityHeatmap,
    utilization: currentConcurrency.utilization,
    durationBuckets,
    serverAnalytics,
    dataQuality: {
      concurrencyExact: currentConcurrency.exact,
      overCapacityIntervals: currentConcurrency.overCapacityIntervals,
      overlappingSessions: currentConcurrency.overlappingSessions,
      excludedLongSessions: currentConcurrency.excludedLongSessions,
      unknownCapacityServers: currentConcurrency.unknownCapacityServers,
      sessionRetentionDays: Math.round(playerSessionRetentionSeconds() / 86_400),
      sessionCoverageStart: coverageStart.toISOString(),
      sessionCoverageDays: Math.min(
        periods.dayCount,
        Math.max(
          0,
          Math.floor(
            (periods.current.end.getTime() -
              Math.max(periods.current.start.getTime(), coverageStart.getTime())) /
              86_400_000,
          ),
        ),
      ),
      sessionCoverageAvailable:
        Math.max(periods.current.start.getTime(), coverageStart.getTime()) <
        periods.current.end.getTime(),
      sessionCoverageComplete: periods.current.start >= coverageStart,
      attributionAvailable: false,
      mapPlaytimeAvailable: false,
      uptimeHistoryAvailable: false,
      operatingCostsConfigured: false,
    },
    recent,
    daily: dayBuckets,
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

  const filter: Record<string, unknown> = {
    joinedAt: { $gte: start },
  };
  if (input.serverId) filter.serverId = input.serverId;
  if (input.activeOnly) {
    filter.leftAt = null;
    filter.lastSeenAt = {
      $gte: new Date(now.getTime() - presenceStaleMs() * 2),
    };
  }

  const sessions = await col.find(filter).sort({ joinedAt: -1 }).limit(limit).toArray();

  let overlapPool = sessions;
  if (sessions.length > 0) {
    const newestJoin = sessions[0]!.joinedAt;
    const oldestJoin = sessions[sessions.length - 1]!.joinedAt;
    const overlapFilter: Record<string, unknown> = {
      joinedAt: { $lte: newestJoin },
      $or: [{ leftAt: null }, { leftAt: { $gte: oldestJoin } }],
    };
    if (input.serverId) overlapFilter.serverId = input.serverId;
    overlapPool = await col.find(overlapFilter).limit(2000).toArray();
  }

  const [users, fleet] = await Promise.all([
    findUsersBySteamIds(sessions.map((s) => s.steamId)),
    getGameServers({ includeDisabled: true }).catch(() => []),
  ]);
  const userBySteam = new Map(users.map((u) => [u.steamId, u]));
  const serverNameById = new Map(fleet.map((s) => [s.id, s.name]));

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
      concurrentAtJoin: concurrentAtJoin(s, overlapPool),
      serverId: s.serverId,
      serverName: s.serverName || serverNameById.get(s.serverId) || s.serverId,
      role: user?.role ?? null,
    };
  });
}
