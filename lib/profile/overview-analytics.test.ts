import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  averageDailyReturningPlayers,
  completedIstPeriod,
  computeOverviewConcurrency,
  istDayOfWeekAndHour,
  overviewIstPeriod,
  retentionRate,
  summarizeIstDayPlayers,
  type AnalyticsSession,
} from "./overview-analytics";
import { listRecentIstDayKeys } from "../time/ist";

const session = (
  id: string,
  steamId: string,
  serverId: string,
  joinedAt: string,
  leftAt: string | null,
  lastSeenAt = leftAt ?? joinedAt,
): AnalyticsSession => ({
  _id: id,
  steamId,
  serverId,
  joinedAt: new Date(joinedAt),
  leftAt: leftAt ? new Date(leftAt) : null,
  lastSeenAt: new Date(lastSeenAt),
});

describe("completed IST reporting periods", () => {
  it("uses complete calendar days and excludes the current day", () => {
    const now = new Date("2026-10-16T12:00:00.000Z"); // 17:30 IST
    const period = completedIstPeriod("7d", now);
    assert.equal(period.current.start.toISOString(), "2026-10-08T18:30:00.000Z");
    assert.equal(period.current.end.toISOString(), "2026-10-15T18:30:00.000Z");
    assert.equal(period.previous.start.toISOString(), "2026-10-01T18:30:00.000Z");
    assert.equal(period.label, "2026-10-09 – 2026-10-15 IST");
  });

  it("maps UTC instants to the correct IST weekday and hour at the boundary", () => {
    // 18:29:59 UTC is 23:59:59 IST on Friday; one second later is Saturday.
    assert.deepEqual(istDayOfWeekAndHour(new Date("2026-10-16T18:29:59.000Z")), {
      dayOfWeek: 5,
      hour: 23,
    });
    assert.deepEqual(istDayOfWeekAndHour(new Date("2026-10-16T18:30:00.000Z")), {
      dayOfWeek: 6,
      hour: 0,
    });
  });

  it("supports 90 completed days with a same-length previous period", () => {
    const period = overviewIstPeriod(
      "90d",
      undefined,
      undefined,
      new Date("2026-10-16T12:00:00.000Z"),
    );
    assert.equal(period.dayCount, 90);
    assert.equal(period.current.end.toISOString(), "2026-10-15T18:30:00.000Z");
    assert.equal(period.previous.end.toISOString(), period.current.start.toISOString());
    assert.equal(
      period.previous.start.getTime(),
      period.current.start.getTime() - 90 * 86_400_000,
    );
  });

  it("accepts inclusive custom IST dates only when complete and within 90 days", () => {
    const period = overviewIstPeriod(
      "custom",
      "2026-10-10",
      "2026-10-16",
      new Date("2026-10-17T00:00:00.000Z"), // 05:30 IST, Oct 17
    );
    assert.equal(period.dayCount, 7);
    assert.equal(period.label, "2026-10-10 – 2026-10-16 IST");
    assert.throws(
      () =>
        overviewIstPeriod(
          "custom",
          "2026-10-10",
          "2026-10-17",
          new Date("2026-10-17T00:00:00.000Z"),
        ),
      /completed IST date range/,
    );
  });
});

describe("session-interval concurrency", () => {
  const now = new Date("2026-10-16T04:00:00.000Z");
  const window = {
    start: new Date("2026-10-16T00:00:00.000Z"),
    end: new Date("2026-10-16T04:00:00.000Z"),
  };
  const compute = (
    sessions: AnalyticsSession[],
    capacities = new Map([
      ["a", 10],
      ["b", 10],
    ]),
  ) =>
    computeOverviewConcurrency({
      sessions,
      capacities,
      window,
      now,
      staleAfterMs: 180_000,
    });

  it("is time-weighted, not biased by join-event volume", () => {
    const result = compute([
      session("long", "p1", "a", "2026-10-16T00:00:00.000Z", "2026-10-16T03:50:00.000Z"),
      session("short", "p2", "a", "2026-10-16T00:00:00.000Z", "2026-10-16T00:10:00.000Z"),
    ]);
    assert.equal(result.avgConcurrent, 1);
    assert.equal(result.servers.get("a")?.avgConcurrent, 1);
  });

  it("deduplicates overlapping sessions for one player across servers", () => {
    const result = compute([
      session(
        "old-server",
        "same-player",
        "a",
        "2026-10-16T00:00:00.000Z",
        "2026-10-16T02:00:00.000Z",
      ),
      session(
        "reconnect",
        "same-player",
        "b",
        "2026-10-16T01:00:00.000Z",
        "2026-10-16T02:00:00.000Z",
      ),
    ]);
    assert.equal(result.avgConcurrent, 0.5);
    assert.equal(result.peakConcurrent, 1);
    assert.equal(result.servers.get("a")?.avgConcurrent, 0.3);
    assert.equal(result.servers.get("b")?.avgConcurrent, 0.3);
  });

  it("processes leaves before same-time reconnect joins without inflating peak", () => {
    const result = compute([
      session(
        "before-restart",
        "p1",
        "a",
        "2026-10-16T00:00:00.000Z",
        "2026-10-16T01:00:00.000Z",
      ),
      session(
        "after-restart",
        "p1",
        "a",
        "2026-10-16T01:00:00.000Z",
        "2026-10-16T02:00:00.000Z",
      ),
    ]);
    assert.equal(result.peakConcurrent, 1);
    assert.equal(result.overCapacityIntervals, 0);
  });

  it("ends stale open sessions at their last heartbeat rather than extending them", () => {
    const result = compute([
      session(
        "stale-open",
        "p1",
        "a",
        "2026-10-16T00:00:00.000Z",
        null,
        "2026-10-16T01:00:00.000Z",
      ),
    ]);
    assert.equal(result.avgConcurrent, 0.3);
  });

  it("uses the recorded leave timestamp for server restarts and clips to the report window", () => {
    const result = compute([
      session(
        "restart",
        "p1",
        "a",
        "2026-10-15T23:00:00.000Z",
        "2026-10-16T00:30:00.000Z",
      ),
    ]);
    assert.equal(result.avgConcurrent, 0.1);
  });

  it("capacity-clamps impossible counts and exposes the anomaly", () => {
    const result = compute(
      [
        session("1", "p1", "a", "2026-10-16T00:00:00.000Z", "2026-10-16T01:00:00.000Z"),
        session("2", "p2", "a", "2026-10-16T00:00:00.000Z", "2026-10-16T01:00:00.000Z"),
        session("3", "p3", "a", "2026-10-16T00:00:00.000Z", "2026-10-16T01:00:00.000Z"),
      ],
      new Map([["a", 2]]),
    );
    assert.equal(result.peakConcurrent, 2);
    assert.equal(result.avgConcurrent, 0.5);
    assert.ok(result.overCapacityIntervals > 0);
    assert.equal(result.exact, false);
  });

  it("excludes sessions over the plausibility threshold rather than fabricating a duration", () => {
    const result = compute([
      session(
        "outlier",
        "p1",
        "a",
        "2026-10-15T00:00:00.000Z",
        "2026-10-16T01:00:00.000Z",
      ),
    ]);
    assert.equal(result.excludedLongSessions, 1);
    assert.equal(result.avgConcurrent, 0);
    assert.equal(result.servers.get("a")?.playTimeMs, 0);
  });

  it("reports unknown capacity instead of claiming exact concurrency", () => {
    const result = compute([
      session(
        "unknown",
        "p1",
        "retired-server",
        "2026-10-16T00:00:00.000Z",
        "2026-10-16T01:00:00.000Z",
      ),
    ]);
    assert.equal(result.unknownCapacityServers, 1);
    assert.equal(result.exact, false);
    assert.equal(result.peakConcurrent, 1);
  });

  it("does not treat time before the retained-session horizon as zero activity", () => {
    const result = computeOverviewConcurrency({
      sessions: [
        session(
          "retained",
          "p1",
          "a",
          "2026-10-16T00:00:00.000Z",
          "2026-10-16T04:00:00.000Z",
        ),
      ],
      capacities: new Map([["a", 10]]),
      window,
      now,
      staleAfterMs: 180_000,
      coverageStart: new Date("2026-10-16T02:00:00.000Z"),
    });
    assert.equal(result.avgConcurrent, 1);
    assert.equal(result.utilization.emptyPercent, 0);
  });

  it("starts per-server utilization at its configured creation time", () => {
    const result = computeOverviewConcurrency({
      sessions: [
        session(
          "after-create",
          "p1",
          "a",
          "2026-10-16T02:00:00.000Z",
          "2026-10-16T03:00:00.000Z",
        ),
      ],
      capacities: new Map([["a", 10]]),
      serverAvailableFrom: new Map([["a", new Date("2026-10-16T02:00:00.000Z")]]),
      window,
      now,
      staleAfterMs: 180_000,
    });
    assert.equal(result.servers.get("a")?.avgConcurrent, 0.5);
    assert.equal(result.servers.get("a")?.utilization.emptyPercent, 50);
    assert.equal(result.servers.get("a")?.utilization.oneToFourPercent, 50);
  });
});

describe("retention day assignment", () => {
  it("counts a return on the next IST calendar day, including UTC midnight crossings", () => {
    const firstSeenAt = new Date("2026-10-15T18:29:59.000Z"); // Oct 15 23:59:59 IST
    const activityByPlayer = new Map([["p1", new Set(["2026-10-15", "2026-10-16"])]]);
    assert.equal(
      retentionRate({ firstSeenAt, activityByPlayer, steamId: "p1", dayOffset: 1 }),
      true,
    );
    assert.equal(
      retentionRate({ firstSeenAt, activityByPlayer, steamId: "p1", dayOffset: 7 }),
      false,
    );
  });

  it("assigns D30 returns to the exact thirtieth IST day", () => {
    const firstSeenAt = new Date("2026-10-01T18:30:00.000Z"); // Oct 2 IST
    const activityByPlayer = new Map([["p1", new Set(["2026-10-02", "2026-11-01"])]]);
    assert.equal(
      retentionRate({ firstSeenAt, activityByPlayer, steamId: "p1", dayOffset: 30 }),
      true,
    );
  });
});

describe("per-day new vs returning classification", () => {
  const dayStartOct10 = new Date("2026-10-10T00:00:00.000+05:30");
  const dayEndOct10 = new Date("2026-10-11T00:00:00.000+05:30");
  const now = new Date("2026-10-15T12:00:00.000Z");

  const summarize = (
    sessions: AnalyticsSession[],
    firstSeenBySteam: Map<string, Date>,
    dayStart = dayStartOct10,
    dayEnd = dayEndOct10,
  ) =>
    summarizeIstDayPlayers({
      sessions,
      dayStart,
      dayEnd,
      now,
      staleAfterMs: 3_600_000,
      firstSeenBySteam,
    });

  it("does not count a first-time player as returning on their first recorded day", () => {
    const summary = summarize(
      [
        session(
          "s1",
          "p1",
          "srv",
          "2026-10-10T04:30:00.000Z", // 10:00 IST
          "2026-10-10T05:00:00.000Z",
        ),
      ],
      new Map([["p1", new Date("2026-10-10T04:30:00.000Z")]]),
    );
    assert.equal(summary.uniquePlayers.size, 1);
    assert.equal(summary.newPlayers, 1);
    assert.equal(summary.returningPlayers, 0);
  });

  it("counts a returning player once per day across reconnects", () => {
    const summary = summarize(
      [
        session(
          "s1",
          "p1",
          "srv",
          "2026-10-10T04:30:00.000Z",
          "2026-10-10T05:00:00.000Z",
        ),
        session(
          "s2",
          "p1",
          "srv",
          "2026-10-10T14:00:00.000Z",
          "2026-10-10T14:30:00.000Z",
        ),
      ],
      new Map([["p1", new Date("2026-10-09T04:30:00.000Z")]]),
    );
    assert.equal(summary.uniquePlayers.size, 1);
    assert.equal(summary.returningPlayers, 1);
    assert.equal(summary.newPlayers, 0);
  });

  it("counts the same returning player on each distinct later day", () => {
    const firstSeen = new Map([["p1", new Date("2026-10-09T04:30:00.000Z")]]);
    const first = summarize(
      [
        session(
          "s1",
          "p1",
          "srv",
          "2026-10-10T04:30:00.000Z",
          "2026-10-10T05:00:00.000Z",
        ),
      ],
      firstSeen,
    );
    const second = summarize(
      [
        session(
          "s2",
          "p1",
          "srv",
          "2026-10-11T04:30:00.000Z",
          "2026-10-11T05:00:00.000Z",
        ),
      ],
      firstSeen,
      new Date("2026-10-11T00:00:00.000+05:30"),
      new Date("2026-10-12T00:00:00.000+05:30"),
    );
    assert.equal(first.returningPlayers, 1);
    assert.equal(second.returningPlayers, 1);
  });

  it("de-duplicates a player who joined multiple servers in one day", () => {
    const summary = summarize(
      [
        session(
          "s1",
          "p1",
          "srv-a",
          "2026-10-10T04:30:00.000Z",
          "2026-10-10T05:00:00.000Z",
        ),
        session(
          "s2",
          "p1",
          "srv-b",
          "2026-10-10T04:45:00.000Z",
          "2026-10-10T05:15:00.000Z",
        ),
      ],
      new Map([["p1", new Date("2026-10-09T04:30:00.000Z")]]),
    );
    assert.equal(summary.uniquePlayers.size, 1);
    assert.equal(summary.returningPlayers, 1);
  });

  it("classifies sessions crossing the IST midnight boundary on the later day", () => {
    const firstSeen = new Map([["p1", new Date("2026-10-09T06:30:00.000Z")]]); // Oct 9 12:00 IST
    const wholeSession = session(
      "s1",
      "p1",
      "srv",
      "2026-10-09T18:29:59.000Z", // Oct 9 23:59:59 IST, crosses into Oct 10
      "2026-10-09T19:00:00.000Z",
    );
    const oct9 = summarize(
      [wholeSession],
      firstSeen,
      new Date("2026-10-09T00:00:00.000+05:30"),
      new Date("2026-10-10T00:00:00.000+05:30"),
    );
    const oct10 = summarize([wholeSession], firstSeen);
    // First seen mid-day Oct 9, the pair of players spans exactly one day each side.
    assert.equal(oct9.newPlayers, 1);
    assert.equal(oct10.returningPlayers, 1);
    assert.equal(oct10.newPlayers, 0);
  });

  it("keeps an untracked identity unclassified instead of returning", () => {
    const summary = summarize(
      [
        session(
          "s1",
          "p2",
          "srv",
          "2026-10-10T04:30:00.000Z",
          "2026-10-10T05:00:00.000Z",
        ),
      ],
      new Map(), // no first-seen record for p2
    );
    assert.equal(summary.unclassifiedPlayers, 1);
    assert.equal(summary.returningPlayers, 0);
    assert.equal(summary.newPlayers, 0);
  });
});

describe("average daily returning players", () => {
  it("averages over complete days only and counts genuine zero days in the denominator", () => {
    const result = averageDailyReturningPlayers(
      [
        { date: "2026-10-10", complete: true, returningPlayers: 0 },
        { date: "2026-10-11", complete: true, returningPlayers: 10 },
        { date: "2026-10-12", complete: false, returningPlayers: 50 },
      ],
      { observedFromDay: "2026-10-01" },
    );
    assert.equal(result.average, 5);
    assert.equal(result.total, 10);
    assert.equal(result.days, 2);
  });

  it("excludes days before the observation start so missing history is not zero", () => {
    const result = averageDailyReturningPlayers(
      [
        { date: "2026-10-10", complete: true, returningPlayers: 10 },
        { date: "2026-10-11", complete: true, returningPlayers: 10 },
        { date: "2026-10-12", complete: true, returningPlayers: 0 },
      ],
      { observedFromDay: "2026-10-12" },
    );
    assert.equal(result.average, 0);
    assert.equal(result.days, 1);
  });

  it("returns null when no complete day qualifies", () => {
    const result = averageDailyReturningPlayers(
      [{ date: "2026-10-10", complete: false, returningPlayers: 10 }],
      { observedFromDay: "2026-10-01" },
    );
    assert.equal(result.average, null);
    assert.equal(result.days, 0);
  });

  it("returns null when there is no tracking data at all", () => {
    const result = averageDailyReturningPlayers(
      [{ date: "2026-10-10", complete: true, returningPlayers: 10 }],
      { observedFromDay: null },
    );
    assert.equal(result.average, null);
    assert.equal(result.days, 0);
  });

  it("supports every analytics range denominator", () => {
    for (const range of ["1d", "7d", "30d", "90d"] as const) {
      const period = overviewIstPeriod(
        range,
        undefined,
        undefined,
        new Date("2026-10-16T12:00:00.000Z"),
      );
      const result = averageDailyReturningPlayers(
        Array.from({ length: period.dayCount }, (_, i) => {
          const day = new Date(
            new Date("2026-07-01T00:00:00.000+05:30").getTime() + (i + 1) * 86_400_000,
          );
          return {
            date: day.toISOString().slice(0, 10),
            complete: true,
            returningPlayers: 3,
          };
        }),
        { observedFromDay: "2026-07-01" },
      );
      assert.equal(result.days, period.dayCount, range);
      assert.equal(result.average, 3, range);
    }
  });
});

describe("previous equivalent period for the daily average", () => {
  it("uses the preceding window's days and excludes the current incomplete day", () => {
    const now = new Date("2026-10-16T12:00:00.000Z"); // 17:30 IST
    const period = completedIstPeriod("7d", now);
    const dailyFor = (window: { start: Date; end: Date }, perDay: number[]) =>
      listRecentIstDayKeys(perDay.length, new Date(window.end.getTime() - 1)).map(
        (date, i) => ({ date, complete: true, returningPlayers: perDay[i] }),
      );
    const current = averageDailyReturningPlayers(
      dailyFor(period.current, [2, 3, 1, 2, 1, 2, 3]),
      { observedFromDay: "2026-09-01" },
    );
    const previous = averageDailyReturningPlayers(
      dailyFor(period.previous, [1, 1, 1, 1, 1, 1, 1]),
      { observedFromDay: "2026-09-01" },
    );
    assert.equal(current.days, 7);
    assert.equal(current.average, 2);
    assert.equal(previous.days, 7);
    assert.equal(previous.average, 1);

    // Buckets are chronological: first is the window's oldest day, last is
    // yesterday — the running day is never included.
    const keys = listRecentIstDayKeys(7, new Date(period.current.end.getTime() - 1));
    assert.equal(keys[0], "2026-10-09");
    assert.equal(keys[keys.length - 1], "2026-10-15");
    assert.ok(!keys.includes("2026-10-16"));
  });
});
