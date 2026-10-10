import assert from "node:assert/strict";
import test from "node:test";

import { isBanCurrentlyActive, isValidSteamId64 } from "@/lib/moderation/validation";

test("accepts only decimal SteamID64 values", () => {
  assert.equal(isValidSteamId64("76561198000000000"), true);
  assert.equal(isValidSteamId64("7656119800000000"), false);
  assert.equal(isValidSteamId64("76561198000000000x"), false);
});

test("permanent bans remain active until revoked", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  assert.equal(
    isBanCurrentlyActive(
      {
        status: "active",
        startsAt: new Date("2026-10-10T11:00:00.000Z"),
        expiresAt: null,
      },
      now,
    ),
    true,
  );
  assert.equal(
    isBanCurrentlyActive(
      {
        status: "revoked",
        startsAt: new Date("2026-10-10T11:00:00.000Z"),
        expiresAt: null,
      },
      now,
    ),
    false,
  );
});

test("timed bans expire at their expiry timestamp", () => {
  const expiry = new Date("2026-10-10T12:00:00.000Z");
  assert.equal(
    isBanCurrentlyActive(
      {
        status: "active",
        startsAt: new Date("2026-10-10T11:00:00.000Z"),
        expiresAt: expiry,
      },
      new Date("2026-10-10T11:59:59.999Z"),
    ),
    true,
  );
  assert.equal(
    isBanCurrentlyActive(
      {
        status: "active",
        startsAt: new Date("2026-10-10T11:00:00.000Z"),
        expiresAt: expiry,
      },
      expiry,
    ),
    false,
  );
});
