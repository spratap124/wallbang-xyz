import { istDayBounds, istDayKey, IST_UTC_OFFSET } from "@/lib/time/ist";
import type {
  AdminAnalyticsRange,
  ConcurrencyBands,
  ServerStatsRange,
} from "@/types/profile";

export const MAX_ANALYTICS_SESSION_MS = 12 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type AnalyticsSession = {
  _id: string;
  steamId: string;
  serverId: string;
  joinedAt: Date;
  lastSeenAt: Date;
  leftAt: Date | null;
  map?: string | null;
};

export type AnalyticsWindow = {
  start: Date;
  end: Date;
};

export type PeriodWindows = {
  current: AnalyticsWindow;
  previous: AnalyticsWindow;
  label: string;
  dayCount: number;
};

export type IstDayPlayerSummary = {
  /** Distinct SteamIDs with a session overlapping the day, across all servers. */
  uniquePlayers: Set<string>;
  newPlayers: number;
  returningPlayers: number;
  unclassifiedPlayers: number;
};

/**
 * Effective end instant of a session for analytics windows: an explicit leave
 * time, or the last presence ping extended through a staleness grace period.
 */
export function analyticsSessionEndMs(
  session: Pick<AnalyticsSession, "leftAt" | "lastSeenAt">,
  nowMs: number,
  staleAfterMs: number,
): number {
  if (session.leftAt) return session.leftAt.getTime();
  return nowMs - session.lastSeenAt.getTime() <= staleAfterMs
    ? nowMs
    : session.lastSeenAt.getTime();
}

/**
 * Distinct players active during one IST calendar day, split into new
 * (first-ever session inside the day) vs returning (first seen before the
 * day). Sessions are de-duplicated per SteamID, across servers.
 */
export function summarizeIstDayPlayers(input: {
  sessions: AnalyticsSession[];
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  /** Staleness grace period for sessions without an explicit leave. */
  staleAfterMs: number;
  firstSeenBySteam: Map<string, Date>;
}): IstDayPlayerSummary {
  const dayStartMs = input.dayStart.getTime();
  const dayEndMs = input.dayEnd.getTime();
  const uniquePlayers = new Set<string>();
  for (const session of input.sessions) {
    const sessionEnd = analyticsSessionEndMs(
      session,
      input.now.getTime(),
      input.staleAfterMs,
    );
    if (
      sessionEnd - session.joinedAt.getTime() <= MAX_ANALYTICS_SESSION_MS &&
      session.joinedAt.getTime() < dayEndMs &&
      sessionEnd > dayStartMs
    ) {
      uniquePlayers.add(session.steamId);
    }
  }
  let newPlayers = 0;
  let returningPlayers = 0;
  let unclassifiedPlayers = 0;
  for (const steamId of uniquePlayers) {
    const firstSeen = input.firstSeenBySteam.get(steamId);
    if (!firstSeen) {
      unclassifiedPlayers += 1;
    } else if (firstSeen.getTime() >= dayStartMs && firstSeen.getTime() < dayEndMs) {
      newPlayers += 1;
    } else {
      returningPlayers += 1;
    }
  }
  return { uniquePlayers, newPlayers, returningPlayers, unclassifiedPlayers };
}

/** One IST day's returning-player contribution to the daily average. */
export type ReturningPlayersDayInput = {
  date: string;
  /** False when TTL expiry or missing history may have removed part of this day. */
  complete: boolean;
  returningPlayers: number;
};

export type AverageDailyReturningPlayers = {
  /** Null when no complete day qualifies — missing data is never treated as zero. */
  average: number | null;
  /** Sum of distinct returning players over the included days. */
  total: number;
  /** Denominator: number of complete, observed days used for the average. */
  days: number;
  observedFromDay: string | null;
};

/**
 * Average distinct returning players per complete IST day:
 * sum of daily distinct returning players / number of complete days.
 * Days before `observedFromDay` (before tracking existed) are excluded so
 * missing historical data is not counted as zero; a null `observedFromDay`
 * means there is no tracking data at all, making the average unavailable.
 */
export function averageDailyReturningPlayers(
  days: ReturningPlayersDayInput[],
  options: { observedFromDay?: string | null } = {},
): AverageDailyReturningPlayers {
  const observedFromDay = options.observedFromDay ?? null;
  if (!observedFromDay) {
    return { average: null, total: 0, days: 0, observedFromDay: null };
  }
  const included = days.filter((day) => day.complete && day.date >= observedFromDay);
  if (included.length === 0) {
    return { average: null, total: 0, days: 0, observedFromDay };
  }
  const total = included.reduce((sum, day) => sum + day.returningPlayers, 0);
  const average = Math.round((total / included.length) * 10) / 10;
  return { average, total, days: included.length, observedFromDay };
}

export type ConcurrencyPoint = {
  date: string;
  peakConcurrent: number;
  avgConcurrent: number;
  primeTimeAvgConcurrent: number;
  playTimeMs: number;
};

export type ServerConcurrencyPoint = {
  observedMs: number;
  avgConcurrent: number;
  primeTimeAvgConcurrent: number;
  peakConcurrent: number;
  utilization: ConcurrencyBands;
  overCapacityMs: number;
  playTimeMs: number;
};

export type OverviewConcurrency = {
  avgConcurrent: number;
  primeTimeAvgConcurrent: number;
  peakConcurrent: number;
  utilization: ConcurrencyBands;
  daily: Map<string, ConcurrencyPoint>;
  hourly: Map<string, { playerMs: number; elapsedMs: number }>;
  servers: Map<string, ServerConcurrencyPoint>;
  overCapacityIntervals: number;
  overCapacityMs: number;
  overlappingSessions: number;
  excludedLongSessions: number;
  unknownCapacityServers: number;
  exact: boolean;
};

export function completedIstPeriod(
  range: ServerStatsRange,
  now = new Date(),
): PeriodWindows {
  return overviewIstPeriod(range, undefined, undefined, now);
}

/** Resolves complete IST calendar windows for the Analytics page. */
export function overviewIstPeriod(
  range: AdminAnalyticsRange,
  customStart?: string,
  customEnd?: string,
  now = new Date(),
): PeriodWindows {
  const today = istDayBounds(istDayKey(now)).start;
  let start: Date;
  let end: Date;
  let dayCount: number;
  if (range === "custom") {
    if (
      !customStart ||
      !customEnd ||
      !/^\d{4}-\d{2}-\d{2}$/.test(customStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(customEnd)
    ) {
      throw new Error("Custom date range requires valid YYYY-MM-DD start and end dates.");
    }
    start = istDayBounds(customStart).start;
    const customLastDay = istDayBounds(customEnd);
    end = customLastDay.end;
    dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (
      istDayKey(start) !== customStart ||
      istDayKey(customLastDay.start) !== customEnd ||
      start >= end ||
      end > today ||
      dayCount > 90
    ) {
      throw new Error("Choose a completed IST date range of 1–90 days.");
    }
  } else {
    dayCount = range === "1d" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    end = today;
    start = new Date(today.getTime() - dayCount * 86_400_000);
  }
  const previousStart = new Date(start.getTime() - dayCount * 86_400_000);
  const label = `${istDayKey(start)} – ${istDayKey(new Date(end.getTime() - 1))} IST`;
  return {
    current: { start, end },
    previous: { start: previousStart, end: start },
    label,
    dayCount,
  };
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyBands(): ConcurrencyBands {
  return {
    emptyPercent: 0,
    oneToFourPercent: 0,
    fiveToNinePercent: 0,
    tenPlusPercent: 0,
  };
}

function bandsFromMs(
  values: { empty: number; oneToFour: number; fiveToNine: number; tenPlus: number },
  totalMs: number,
): ConcurrencyBands {
  if (totalMs <= 0) return emptyBands();
  const emptyPercent = rounded((values.empty / totalMs) * 100);
  const oneToFourPercent = rounded((values.oneToFour / totalMs) * 100);
  const fiveToNinePercent = rounded((values.fiveToNine / totalMs) * 100);
  return {
    emptyPercent,
    oneToFourPercent,
    fiveToNinePercent,
    tenPlusPercent: rounded(
      Math.max(0, 100 - emptyPercent - oneToFourPercent - fiveToNinePercent),
    ),
  };
}

function rangeOf<T extends { start: Date; end: Date }>(
  range: T,
  coverageStart: Date | undefined,
): T {
  if (!coverageStart || coverageStart <= range.start) return range;
  if (coverageStart >= range.end) return { ...range, start: range.end };
  return { ...range, start: coverageStart };
}

/**
 * Reconstructs concurrency from player-session intervals, never join-time
 * snapshots. Open stale sessions end at their last observed heartbeat; they
 * are not extended by the stale-presence grace interval. Duplicate SteamIDs
 * active on multiple servers count once, assigned to their latest join.
 * Counts above known capacity are capacity-clamped and surfaced as anomalies.
 * Session intervals over 12h are excluded from duration/concurrency totals and
 * counted as data-quality outliers rather than being assigned invented time.
 */
export function computeOverviewConcurrency(input: {
  sessions: AnalyticsSession[];
  capacities: Map<string, number | null>;
  serverAvailableFrom?: Map<string, Date>;
  window: AnalyticsWindow;
  now: Date;
  staleAfterMs: number;
  coverageStart?: Date;
}): OverviewConcurrency {
  const window = rangeOf(input.window, input.coverageStart);
  const elapsedMs = Math.max(0, window.end.getTime() - window.start.getTime());
  const intervals: Array<{
    id: string;
    steamId: string;
    serverId: string;
    joinedAtMs: number;
    startMs: number;
    endMs: number;
  }> = [];
  const playTimeByServer = new Map<string, number>();
  let excludedLongSessions = 0;

  for (const session of input.sessions) {
    const joinedAtMs = session.joinedAt.getTime();
    let rawEndMs: number;
    if (session.leftAt) {
      rawEndMs = session.leftAt.getTime();
    } else if (input.now.getTime() - session.lastSeenAt.getTime() <= input.staleAfterMs) {
      rawEndMs = input.now.getTime();
    } else {
      rawEndMs = session.lastSeenAt.getTime();
    }

    if (rawEndMs - joinedAtMs > MAX_ANALYTICS_SESSION_MS) {
      excludedLongSessions += 1;
      continue;
    }
    const startMs = Math.max(joinedAtMs, window.start.getTime());
    const endMs = Math.min(rawEndMs, window.end.getTime(), input.now.getTime());
    if (endMs <= startMs) continue;
    intervals.push({
      id: session._id,
      steamId: session.steamId,
      serverId: session.serverId,
      joinedAtMs,
      startMs,
      endMs,
    });
  }

  const byPlayer = new Map<string, (typeof intervals)[number][]>();
  for (const interval of intervals) {
    const rows = byPlayer.get(interval.steamId) ?? [];
    rows.push(interval);
    byPlayer.set(interval.steamId, rows);
  }
  let overlappingSessions = 0;
  for (const rows of byPlayer.values()) {
    rows.sort((a, b) => a.startMs - b.startMs || a.joinedAtMs - b.joinedAtMs);
    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index]!;
      const next = rows[index + 1]!;
      if (current.endMs > next.startMs) {
        current.endMs = next.startMs;
        overlappingSessions += 1;
      }
    }
  }
  const validIntervals = intervals.filter(
    (interval) => interval.endMs > interval.startMs,
  );
  intervals.splice(0, intervals.length, ...validIntervals);

  const serverIds = new Set([
    ...input.capacities.keys(),
    ...intervals.map((interval) => interval.serverId),
  ]);
  const observedServerIds = new Set(intervals.map((interval) => interval.serverId));
  const unknownCapacityServers = [...observedServerIds].filter(
    (serverId) =>
      !input.capacities.has(serverId) || input.capacities.get(serverId) == null,
  ).length;
  const serverCapacity = (serverId: string) => input.capacities.get(serverId) ?? null;
  const allKnownCapacity = [...observedServerIds].every(
    (serverId) => serverCapacity(serverId) != null,
  );
  const fleetCapacity = [...observedServerIds].reduce(
    (sum, serverId) => sum + (serverCapacity(serverId) ?? 0),
    0,
  );

  const boundaries = new Set<number>([window.start.getTime(), window.end.getTime()]);
  for (const serverId of serverIds) {
    const availableAt = input.serverAvailableFrom?.get(serverId)?.getTime();
    if (
      availableAt != null &&
      availableAt > window.start.getTime() &&
      availableAt < window.end.getTime()
    ) {
      boundaries.add(availableAt);
    }
  }
  const events = new Map<number, { starts: typeof intervals; ends: typeof intervals }>();
  const eventAt = (at: number) => {
    let event = events.get(at);
    if (!event) {
      event = { starts: [], ends: [] };
      events.set(at, event);
    }
    return event;
  };

  for (const interval of intervals) {
    boundaries.add(interval.startMs);
    boundaries.add(interval.endMs);
    eventAt(interval.startMs).starts.push(interval);
    eventAt(interval.endMs).ends.push(interval);
  }

  // Hour boundaries ensure day/hour activity and prime-time totals use exact
  // IST clock hours even when no player event occurred at the boundary.
  const offsetMs = 5.5 * HOUR_MS;
  let hourBoundary =
    Math.floor((window.start.getTime() + offsetMs) / HOUR_MS) * HOUR_MS - offsetMs;
  if (hourBoundary < window.start.getTime()) hourBoundary += HOUR_MS;
  while (hourBoundary < window.end.getTime()) {
    boundaries.add(hourBoundary);
    hourBoundary += HOUR_MS;
  }

  const times = [...boundaries].sort((a, b) => a - b);
  const active = new Map<string, (typeof intervals)[number]>();
  const daily = new Map<
    string,
    {
      playerMs: number;
      elapsedMs: number;
      peak: number;
      primePlayerMs: number;
      primeElapsedMs: number;
      playTimeMs: number;
    }
  >();
  const hourly = new Map<string, { playerMs: number; elapsedMs: number }>();
  const serverTotals = new Map<
    string,
    {
      playerMs: number;
      elapsedMs: number;
      peak: number;
      primePlayerMs: number;
      primeElapsedMs: number;
      overCapacityMs: number;
      bands: { empty: number; oneToFour: number; fiveToNine: number; tenPlus: number };
    }
  >();
  for (const serverId of serverIds) {
    serverTotals.set(serverId, {
      playerMs: 0,
      elapsedMs: 0,
      peak: 0,
      primePlayerMs: 0,
      primeElapsedMs: 0,
      overCapacityMs: 0,
      bands: { empty: 0, oneToFour: 0, fiveToNine: 0, tenPlus: 0 },
    });
  }
  const fleetBands = { empty: 0, oneToFour: 0, fiveToNine: 0, tenPlus: 0 };
  let fleetPlayerMs = 0;
  let fleetPrimePlayerMs = 0;
  let fleetPrimeElapsedMs = 0;
  let peakConcurrent = 0;
  let overCapacityMs = 0;
  let overCapacityIntervals = 0;

  for (let index = 0; index < times.length - 1; index += 1) {
    const at = times[index]!;
    const next = times[index + 1]!;
    const event = events.get(at);
    for (const interval of event?.ends ?? []) active.delete(interval.id);
    for (const interval of event?.starts ?? []) active.set(interval.id, interval);
    const spanMs = next - at;
    if (spanMs <= 0) continue;

    const latestByPlayer = new Map<string, (typeof intervals)[number]>();
    for (const interval of active.values()) {
      const current = latestByPlayer.get(interval.steamId);
      if (!current || interval.joinedAtMs > current.joinedAtMs) {
        latestByPlayer.set(interval.steamId, interval);
      }
    }
    const counts = new Map<string, number>();
    for (const interval of latestByPlayer.values()) {
      counts.set(interval.serverId, (counts.get(interval.serverId) ?? 0) + 1);
      const availableAt = input.serverAvailableFrom?.get(interval.serverId)?.getTime();
      if (availableAt == null || at >= availableAt) {
        playTimeByServer.set(
          interval.serverId,
          (playTimeByServer.get(interval.serverId) ?? 0) + spanMs,
        );
      }
    }

    let fleetCount = 0;
    let hadOverCapacity = false;
    for (const serverId of serverIds) {
      const observed = counts.get(serverId) ?? 0;
      const capacity = serverCapacity(serverId);
      const over = capacity != null && observed > capacity;
      const availableAt = input.serverAvailableFrom?.get(serverId)?.getTime();
      const serverSpanMs =
        availableAt != null && at < availableAt
          ? Math.max(0, next - availableAt)
          : spanMs;
      if (over) {
        hadOverCapacity = true;
        overCapacityMs += serverSpanMs;
        const totals = serverTotals.get(serverId)!;
        totals.overCapacityMs += serverSpanMs;
      }
      const count = capacity == null ? observed : Math.min(observed, capacity);
      fleetCount += count;
      const totals = serverTotals.get(serverId)!;
      totals.elapsedMs += serverSpanMs;
      totals.playerMs += count * serverSpanMs;
      totals.peak = Math.max(totals.peak, count);
      if (count === 0) totals.bands.empty += serverSpanMs;
      else if (count <= 4) totals.bands.oneToFour += serverSpanMs;
      else if (count <= 9) totals.bands.fiveToNine += serverSpanMs;
      else totals.bands.tenPlus += serverSpanMs;
    }
    if (hadOverCapacity) overCapacityIntervals += 1;
    if (allKnownCapacity && fleetCount > fleetCapacity) {
      fleetCount = fleetCapacity;
      hadOverCapacity = true;
    }
    fleetPlayerMs += fleetCount * spanMs;
    peakConcurrent = Math.max(peakConcurrent, fleetCount);
    if (fleetCount === 0) fleetBands.empty += spanMs;
    else if (fleetCount <= 4) fleetBands.oneToFour += spanMs;
    else if (fleetCount <= 9) fleetBands.fiveToNine += spanMs;
    else fleetBands.tenPlus += spanMs;

    const local = new Date(at + offsetMs);
    const day = local.toISOString().slice(0, 10);
    const hour = local.getUTCHours();
    const dayRow = daily.get(day) ?? {
      playerMs: 0,
      elapsedMs: 0,
      peak: 0,
      primePlayerMs: 0,
      primeElapsedMs: 0,
      playTimeMs: 0,
    };
    dayRow.playerMs += fleetCount * spanMs;
    dayRow.playTimeMs += latestByPlayer.size * spanMs;
    dayRow.elapsedMs += spanMs;
    dayRow.peak = Math.max(dayRow.peak, fleetCount);
    const isPrime = hour >= 17 && hour < 22;
    if (isPrime) {
      dayRow.primePlayerMs += fleetCount * spanMs;
      dayRow.primeElapsedMs += spanMs;
      fleetPrimePlayerMs += fleetCount * spanMs;
      fleetPrimeElapsedMs += spanMs;
      for (const serverId of serverIds) {
        const totals = serverTotals.get(serverId)!;
        const count = counts.get(serverId) ?? 0;
        const capacity = serverCapacity(serverId);
        const availableAt = input.serverAvailableFrom?.get(serverId)?.getTime();
        const serverPrimeSpanMs =
          availableAt != null && at < availableAt
            ? Math.max(0, next - availableAt)
            : spanMs;
        totals.primePlayerMs +=
          (capacity == null ? count : Math.min(count, capacity)) * serverPrimeSpanMs;
        totals.primeElapsedMs += serverPrimeSpanMs;
      }
    }
    daily.set(day, dayRow);

    const hourKey = `${local.getUTCDay()}:${hour}`;
    const hourRow = hourly.get(hourKey) ?? { playerMs: 0, elapsedMs: 0 };
    hourRow.playerMs += fleetCount * spanMs;
    hourRow.elapsedMs += spanMs;
    hourly.set(hourKey, hourRow);
  }

  const dailyPoints = new Map<string, ConcurrencyPoint>();
  for (const [date, row] of daily) {
    dailyPoints.set(date, {
      date,
      peakConcurrent: row.peak,
      avgConcurrent: row.elapsedMs ? rounded(row.playerMs / row.elapsedMs) : 0,
      primeTimeAvgConcurrent: row.primeElapsedMs
        ? rounded(row.primePlayerMs / row.primeElapsedMs)
        : 0,
      playTimeMs: row.playTimeMs,
    });
  }

  const serverPoints = new Map<string, ServerConcurrencyPoint>();
  for (const [serverId, row] of serverTotals) {
    serverPoints.set(serverId, {
      observedMs: row.elapsedMs,
      avgConcurrent: row.elapsedMs ? rounded(row.playerMs / row.elapsedMs) : 0,
      primeTimeAvgConcurrent: row.primeElapsedMs
        ? rounded(row.primePlayerMs / row.primeElapsedMs)
        : 0,
      peakConcurrent: row.peak,
      utilization: bandsFromMs(row.bands, row.elapsedMs),
      overCapacityMs: row.overCapacityMs,
      playTimeMs: playTimeByServer.get(serverId) ?? 0,
    });
  }

  return {
    avgConcurrent: elapsedMs ? rounded(fleetPlayerMs / elapsedMs) : 0,
    primeTimeAvgConcurrent: fleetPrimeElapsedMs
      ? rounded(fleetPrimePlayerMs / fleetPrimeElapsedMs)
      : 0,
    peakConcurrent,
    utilization: bandsFromMs(fleetBands, elapsedMs),
    daily: dailyPoints,
    hourly,
    servers: serverPoints,
    overCapacityIntervals,
    overCapacityMs,
    overlappingSessions,
    excludedLongSessions,
    unknownCapacityServers,
    exact:
      overCapacityIntervals === 0 &&
      unknownCapacityServers === 0 &&
      overlappingSessions === 0 &&
      excludedLongSessions === 0,
  };
}

export function retentionRate(input: {
  firstSeenAt: Date;
  activityByPlayer: Map<string, Set<string>>;
  steamId: string;
  dayOffset: 1 | 7 | 30;
}): boolean {
  const cohortDay = istDayKey(input.firstSeenAt);
  const { start } = istDayBounds(cohortDay);
  const targetDay = istDayKey(new Date(start.getTime() + input.dayOffset * 86_400_000));
  return input.activityByPlayer.get(input.steamId)?.has(targetDay) ?? false;
}

export function istDayOfWeekAndHour(date: Date): { dayOfWeek: number; hour: number } {
  const local = new Date(date.getTime() + 5.5 * HOUR_MS);
  return { dayOfWeek: local.getUTCDay(), hour: local.getUTCHours() };
}

/** Returns the UTC offset formatted for displaying an IST range. */
export function istRangeDate(date: Date): string {
  return `${istDayKey(date)}T00:00:00${IST_UTC_OFFSET}`;
}
