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

  it("does not show another knife as Nomad Lore or Gamma Doppler", () => {
    const lore = resolveSkinPreview(
      { id: "nomad", defIndex: 521, name: "Nomad Knife" },
      561,
      "Lore",
    );
    const gamma = resolveSkinPreview(
      { id: "nomad", defIndex: 521, name: "Nomad Knife" },
      568,
      "Gamma Doppler",
    );
    assert.equal(lore, undefined);
    assert.equal(gamma, undefined);
  });

  it("keeps Flip Knife Gamma Doppler on the Flip model", () => {
    const preview = resolveSkinPreview(
      { id: "flip", defIndex: 505, name: "Flip Knife" },
      568,
      "Gamma Doppler",
    );
    assert.ok(preview);
    assert.match(preview, /^https:\/\/community\.akamai\.steamstatic\.com\//);
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
