import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAllowedPlayerTag,
  parsePlayerTag,
  PLAYER_TAG_MAX_LENGTH,
} from "./player-tags";

describe("parsePlayerTag", () => {
  it("returns null for empty values", () => {
    assert.equal(parsePlayerTag(null), null);
    assert.equal(parsePlayerTag(undefined), null);
    assert.equal(parsePlayerTag(""), null);
    assert.equal(parsePlayerTag("   "), null);
  });

  it("trims and collapses whitespace", () => {
    assert.equal(parsePlayerTag("  VIP  "), "VIP");
    assert.equal(parsePlayerTag("[ WB ]"), "[ WB ]");
  });

  it("accepts role-style tags", () => {
    assert.equal(parsePlayerTag("[VIP]"), "[VIP]");
    assert.equal(parsePlayerTag("[WallBang]"), "[WallBang]");
    assert.equal(parsePlayerTag("FOUNDER"), "FOUNDER");
  });

  it("rejects invalid characters and oversize tags", () => {
    assert.throws(() => parsePlayerTag("VIP<script>"), /letters/);
    assert.throws(() => parsePlayerTag("a".repeat(PLAYER_TAG_MAX_LENGTH + 1)), /fewer/);
    assert.throws(() => parsePlayerTag(12), /string/);
  });

  it("allows only the selectable catalog, plus clearing to the role default", () => {
    assert.equal(isAllowedPlayerTag("chat", null), true);
    assert.equal(isAllowedPlayerTag("chat", "[VIP]"), true);
    assert.equal(isAllowedPlayerTag("chat", "[OWNER]"), true);
    assert.equal(isAllowedPlayerTag("name", "WallBang"), true);
    assert.equal(isAllowedPlayerTag("chat", "FOUNDER"), false);
    assert.equal(isAllowedPlayerTag("name", "[VIP]"), false);
  });
});
