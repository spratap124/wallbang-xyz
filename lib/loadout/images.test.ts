import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSkinImage, resolveSkinPreview } from "./images";

describe("resolveSkinPreview", () => {
  it("keeps the exact Flip Knife Doppler image", () => {
    const exact = resolveSkinImage({ id: "flip", defIndex: 505 }, 415);
    const preview = resolveSkinPreview(
      { id: "flip", defIndex: 505, name: "Flip Knife" },
      415,
      "Doppler",
    );
    assert.ok(exact);
    assert.equal(preview, exact);
  });

  it("fills Survival Knife Gamma Doppler from another knife's paint kit", () => {
    const exact = resolveSkinImage({ id: "survival", defIndex: 518 }, 568);
    const preview = resolveSkinPreview(
      { id: "survival", defIndex: 518, name: "Survival Knife" },
      568,
      "Gamma Doppler",
    );
    assert.equal(exact, undefined);
    assert.ok(preview);
    assert.match(preview, /^https:\/\/community\.akamai\.steamstatic\.com\//);
  });

  it("fills Survival Knife Lore from another knife when the paint kit is shared", () => {
    const preview = resolveSkinPreview(
      { id: "survival", defIndex: 518, name: "Survival Knife" },
      561,
      "Lore",
    );
    assert.ok(preview);
  });

  it("resolves Sport Gloves Blaze from the official paint kit", () => {
    const preview = resolveSkinPreview(
      { id: "sport", defIndex: 5030, name: "Sport Gloves" },
      1407,
      "Blaze",
    );
    assert.ok(preview);
    assert.match(preview, /^https:\/\/community\.akamai\.steamstatic\.com\//);
  });

  it("resolves Driver Gloves Black Tie with the Valve paint kit", () => {
    const exact = resolveSkinImage({ id: "driver", defIndex: 5031 }, 10072);
    const preview = resolveSkinPreview(
      { id: "driver", defIndex: 5031, name: "Driver Gloves" },
      10072,
      "Black Tie",
    );
    assert.ok(exact);
    assert.equal(preview, exact);
  });

  it("does not borrow a knife image for a rifle skin", () => {
    const preview = resolveSkinPreview(
      { id: "ak47", defIndex: 7, name: "AK-47" },
      568,
      "Gamma Doppler",
    );
    assert.equal(preview, undefined);
  });
});
