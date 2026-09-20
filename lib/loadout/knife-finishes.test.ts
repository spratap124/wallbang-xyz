import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandKnifeFinishRows, resolveKnifeFinishes } from "./knife-finishes";
import type { KnifeFinish } from "@/types/catalog";

const finishes: Record<string, KnifeFinish> = {
  vanilla: { id: "vanilla", displayName: "Vanilla", paintKit: 0, skipWear: true },
  doppler: { id: "doppler", displayName: "Doppler", paintKit: 415 },
  gamma_doppler: {
    id: "gamma_doppler",
    displayName: "Gamma Doppler",
    paintKit: 568,
  },
  lore: { id: "lore", displayName: "Lore", paintKit: 561 },
};

const finishSets = {
  chroma: ["vanilla", "doppler"],
  modern: ["vanilla", "doppler", "gamma_doppler", "lore"],
};

describe("expandKnifeFinishRows", () => {
  it("expands Doppler phases into separate rows with Valve paint kits", () => {
    const rows = expandKnifeFinishRows({
      id: "doppler",
      displayName: "Doppler",
      paintKit: 415,
      variants: [
        { id: "phase1", displayName: "Phase 1", paintKit: 415 },
        { id: "ruby", displayName: "Ruby", paintKit: 419 },
      ],
    });
    assert.deepEqual(
      rows.map((r) => [r.displayName, r.paintKit]),
      [
        ["Doppler | Phase 1", 418],
        ["Doppler | Ruby", 415],
      ],
    );
  });

  it("expands Fade seed variants", () => {
    const rows = expandKnifeFinishRows({
      id: "fade",
      displayName: "Fade",
      paintKit: 38,
      variants: [
        { id: "random", displayName: "Random", seed: -1 },
        { id: "100", displayName: "100% (Max)", seed: 412 },
      ],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[1]?.seed, 412);
    assert.equal(rows[1]?.displayName, "Fade | 100% (Max)");
  });
});

describe("resolveKnifeFinishes", () => {
  it("returns no finishes for the default knife", () => {
    const result = resolveKnifeFinishes(
      { finishSet: null },
      { finishes, finishSets },
    );
    assert.deepEqual(result, []);
  });

  it("keeps Gamma Doppler and Lore for Flip Knife", () => {
    const result = resolveKnifeFinishes(
      { finishSet: "chroma", displayName: "Flip Knife" },
      { finishes, finishSets },
    );
    assert.deepEqual(
      result.map((f) => f.id),
      ["vanilla", "doppler", "gamma_doppler", "lore"],
    );
  });

  it("does not put Flip-only finishes on Nomad Knife", () => {
    const result = resolveKnifeFinishes(
      { finishSet: "chroma", displayName: "Nomad Knife" },
      { finishes, finishSets },
    );
    assert.deepEqual(
      result.map((f) => f.id),
      ["vanilla", "doppler"],
    );
  });
});
