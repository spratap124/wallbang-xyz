import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_SEEN_SEED_PIPELINE,
  LIFETIME_SESSION_COUNT_ACCUMULATOR,
  addLifetimeLedgerTotals,
  addPostBaselineUniquePlayers,
  finalizeSessionOnce,
  firstSeenSetOnInsert,
  firstSeenUpsert,
  idempotentUpsert,
  insertOrRefreshOpenSession,
  seedLeaseClaim,
} from "./session-stats-logic";

test("seed pipeline chooses each player's earliest retained session", () => {
  assert.deepEqual(FIRST_SEEN_SEED_PIPELINE, [
    {
      $group: {
        _id: "$steamId",
        firstSeenAt: { $min: "$joinedAt" },
      },
    },
  ]);
});

test("first-seen writes are insert-only and use the observed session time", () => {
  const joinedAt = new Date("2026-11-21T10:00:00.000Z");
  const values = firstSeenSetOnInsert("76561198000000000", joinedAt);

  assert.deepEqual(values, {
    _id: "76561198000000000",
    steamId: "76561198000000000",
    firstSeenAt: joinedAt,
  });
  assert.equal(values.firstSeenAt, joinedAt);

  const update = firstSeenUpsert("76561198000000000", joinedAt).update;
  assert.ok(update.$setOnInsert);
  assert.equal("$set" in update, false);
});

test("post-baseline unique contribution is insert-only and counted from its row", () => {
  const joinedAt = new Date("2026-11-21T10:00:00.000Z");
  const update = firstSeenUpsert("76561198000000000", joinedAt, true).update;

  assert.equal(update.$setOnInsert.lifetimeUniqueContribution, true);
  assert.equal("$inc" in update, false);
  assert.equal(addPostBaselineUniquePlayers(100, 3), 103);
});

test("existing first-seen rows do not gain a post-baseline contribution", () => {
  const joinedAt = new Date("2026-11-21T10:00:00.000Z");
  const update = firstSeenUpsert("76561198000000000", joinedAt, true).update;

  // MongoDB applies this only on insert, so a pre-existing player row is not
  // modified or counted as a new lifetime unique player.
  assert.ok(update.$setOnInsert.lifetimeUniqueContribution);
  assert.equal("$set" in update, false);
});

test("concurrent duplicate heartbeat inserts reuse the winning open session", async () => {
  type Session = { _id: string; steamId: string; serverId: string };
  const openByPlayerServer = new Map<string, Session>();
  let inserts = 0;
  let refreshes = 0;
  let countedStarts = 0;

  const create = (document: Session) =>
    insertOrRefreshOpenSession({
      document,
      insert: async (candidate) => {
        inserts += 1;
        const key = `${candidate.steamId}:${candidate.serverId}`;
        if (openByPlayerServer.has(key)) {
          throw Object.assign(new Error("duplicate open session"), { code: 11000 });
        }
        openByPlayerServer.set(key, candidate);
      },
      findOpen: async () =>
        openByPlayerServer.get(`${document.steamId}:${document.serverId}`) ?? null,
      refresh: async () => {
        refreshes += 1;
      },
    });

  const created = await Promise.all([
    create({ _id: "session-a", steamId: "p1", serverId: "s1" }),
    create({ _id: "session-b", steamId: "p1", serverId: "s1" }),
  ]);
  countedStarts += created.filter(Boolean).length;

  assert.equal(inserts, 2);
  assert.equal(openByPlayerServer.size, 1);
  assert.equal(refreshes, 1);
  assert.equal(countedStarts, 1);
});

test("concurrent lifetime-stat initializers acquire only one seed lease", async () => {
  const now = new Date("2026-11-21T10:00:00.000Z");
  let state: { seededAt?: Date; seedLockOwner?: string; seedLockUntil?: Date } = {};
  let initialized = 0;

  const claim = async (token: string) => {
    const operation = seedLeaseClaim(now, token, 30_000);
    const expired = !state.seedLockUntil || state.seedLockUntil <= now;
    if (state.seededAt || !expired) return false;
    state = { ...state, ...operation.update.$set };
    return true;
  };

  await Promise.all(
    ["initializer-a", "initializer-b"].map(async (token) => {
      if (!(await claim(token))) return;
      initialized += 1;
      state.seededAt = now;
      state.seedLockOwner = undefined;
      state.seedLockUntil = undefined;
    }),
  );

  assert.equal(initialized, 1);
  assert.ok(state.seededAt);
});

test("initial session baseline is not counted again after its session starts", () => {
  const totals = addLifetimeLedgerTotals(
    { totalSessions: 5, totalPlayTimeMs: 120_000 },
    { totalSessions: 1, totalPlayTimeMs: 0 },
  );
  assert.deepEqual(totals, { totalSessions: 6, totalPlayTimeMs: 120_000 });
});

test("playtime-only ledger rows for legacy sessions do not add a session", () => {
  assert.deepEqual(LIFETIME_SESSION_COUNT_ACCUMULATOR, {
    $sum: { $cond: [{ $eq: ["$sessionStarted", true] }, 1, 0] },
  });
});

test("concurrent closure attempts credit only the successful finalization", async () => {
  let open = true;
  let credits = 0;
  const close = () =>
    finalizeSessionOnce({
      finalize: async () => {
        if (!open) return false;
        open = false;
        return true;
      },
      credit: async () => {
        credits += 1;
      },
    });

  const results = await Promise.all([close(), close()]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(credits, 1);
});

test("idempotent session-ledger writes tolerate retries and duplicate keys", async () => {
  const ledger = new Set<string>();
  let credited = 0;
  const write = () =>
    idempotentUpsert(async () => {
      if (ledger.has("session-1")) {
        throw Object.assign(new Error("duplicate ledger key"), { code: 11000 });
      }
      ledger.add("session-1");
      credited += 1;
    });

  await Promise.all([write(), write()]);
  await write();
  assert.equal(ledger.size, 1);
  assert.equal(credited, 1);
});
