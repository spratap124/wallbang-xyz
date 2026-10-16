import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  completedIstPeriod,
  computeOverviewConcurrency,
  istDayOfWeekAndHour,
  retentionRate,
  type AnalyticsSession,
} from "./overview-analytics";

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
});
