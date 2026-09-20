import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OFFICIAL_GLOVE_SKINS, resolveGloveSkins } from "./glove-skins";

describe("resolveGloveSkins", () => {
  it("returns no skins for default gloves", () => {
    const result = resolveGloveSkins({
      id: "default",
      defIndex: 0,
      skins: [],
    });
    assert.deepEqual(result, []);
  });

  it("includes 2024+ Sport Gloves paints missing from the curated catalog", () => {
    const result = resolveGloveSkins({
      id: "sport",
      defIndex: 5030,
      skins: [
        { id: "vice", displayName: "Vice", paintKit: 10048 },
        { id: "slingshot", displayName: "Slingshot", paintKit: 10073 },
      ],
    });
    assert.equal(result.length, 19);
    assert.ok(result.some((s) => s.id === "blaze" && s.paintKit === 1407));
    assert.ok(result.some((s) => s.id === "occult" && s.paintKit === 1417));
  });

  it("corrects swapped Driver Gloves paint kits", () => {
    const result = resolveGloveSkins({
      id: "driver",
      defIndex: 5031,
      skins: [
        { id: "black_tie", displayName: "Black Tie", paintKit: 10080 },
        { id: "snow_leopard", displayName: "Snow Leopard", paintKit: 10079 },
      ],
    });
    const blackTie = result.find((s) => s.id === "black_tie");
    const snowLeopard = result.find((s) => s.id === "snow_leopard");
    assert.equal(blackTie?.paintKit, 10072);
    assert.equal(snowLeopard?.paintKit, 10070);
    assert.equal(result.length, 20);
  });
});

describe("OFFICIAL_GLOVE_SKINS", () => {
  it("covers the full economy set per glove family", () => {
    assert.equal(OFFICIAL_GLOVE_SKINS.sport?.length, 19);
    assert.equal(OFFICIAL_GLOVE_SKINS.driver?.length, 20);
    assert.equal(OFFICIAL_GLOVE_SKINS.specialist?.length, 19);
    assert.equal(OFFICIAL_GLOVE_SKINS.handwraps?.length, 12);
    assert.equal(OFFICIAL_GLOVE_SKINS.moto?.length, 12);
    assert.equal(OFFICIAL_GLOVE_SKINS.bloodhound?.length, 4);
    assert.equal(OFFICIAL_GLOVE_SKINS.brokenfang?.length, 4);
    assert.equal(OFFICIAL_GLOVE_SKINS.hydra?.length, 4);
  });
});
