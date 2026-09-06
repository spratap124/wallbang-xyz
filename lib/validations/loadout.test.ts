import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { putLoadoutSchema } from "./loadout";
import { sanitizeUserLoadout } from "@/types/player-loadout";

const item = {
  weapon: "ak47",
  paintKit: 639,
  skinId: "ak47:gs_ak47_bloodsport",
  skinName: "Ak47 Bloodsport",
  rarity: "Covert",
  wear: 0.01,
  wearName: "Factory New",
  stattrak: false,
  seed: 265,
  image:
    "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiVI0POlPPNSIvycAWOD0eFkpN5lRi67gVN15mmDw9egci_EPFAkDMQlTeZe4EXplNa0Yrvr5wbd345GyHioiC4b8G81tFuqg_k_",
  updatedAt: "2026-09-05T17:32:51.800Z",
};

const knife = {
  weapon: "survival",
  paintKit: 415,
  skinId: "survival:doppler",
  skinName: "Doppler",
  rarity: "Covert",
  wear: 0.01,
  wearName: "Factory New",
  stattrak: false,
  seed: 0,
  image: item.image,
  updatedAt: "2026-09-02T17:59:17.095Z",
};

describe("putLoadoutSchema", () => {
  it("accepts a CT/T loadout with weapons and knives on both sides", () => {
    const parsed = putLoadoutSchema.safeParse({
      ct: {
        weapons: { m4a1: { ...item, weapon: "m4a1" } },
        knife,
        gloves: null,
        agent: null,
      },
      t: {
        weapons: { ak47: item },
        knife,
        gloves: null,
        agent: null,
      },
      favorites: [],
      recentlyEquipped: [item],
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.ct.weapons.m4a1?.skinId, "ak47:gs_ak47_bloodsport");
    assert.equal(parsed.data.t.weapons.ak47?.paintKit, 639);
    assert.equal(parsed.data.ct.knife?.weapon, "survival");
    assert.equal(parsed.data.t.knife?.weapon, "survival");
  });

  it("round-trips saved docs that stored image: null on recently equipped skins", () => {
    const parsed = putLoadoutSchema.safeParse({
      ct: {
        weapons: { ak47: item },
        knife,
        gloves: null,
        agent: null,
      },
      t: {
        weapons: { ak47: item },
        knife,
        gloves: null,
        agent: null,
      },
      favorites: ["ak47:gs_ak47_empress"],
      recentlyEquipped: [
        knife,
        {
          ...knife,
          paintKit: 568,
          skinId: "survival:gamma_doppler",
          skinName: "Gamma Doppler",
          image: null,
          updatedAt: "2026-09-01T15:25:21.816Z",
        },
      ],
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.t.knife?.skinId, "survival:doppler");
    assert.equal(parsed.data.recentlyEquipped.length, 2);
    assert.equal(parsed.data.recentlyEquipped[1]?.image, undefined);
  });

  it("migrates a legacy flat loadout without dropping equipped skins", () => {
    const parsed = putLoadoutSchema.safeParse({
      weapons: { ak47: item },
      knife,
      gloves: null,
      agentCT: null,
      agentT: null,
      favorites: [],
      recentlyEquipped: [{ ...knife, image: null }],
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.ct.weapons.ak47?.paintKit, 639);
    assert.equal(parsed.data.t.weapons.ak47?.paintKit, 639);
    assert.equal(parsed.data.ct.knife?.weapon, "survival");
  });

  it("accepts GET-shaped state after sanitizeUserLoadout", () => {
    const fromGet = sanitizeUserLoadout({
      weapons: { ak47: item, glock: { ...item, weapon: "glock" } },
      knife,
      gloves: null,
      recentlyEquipped: [{ ...item, image: null }],
    });
    const parsed = putLoadoutSchema.safeParse(fromGet);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(Object.keys(parsed.data.ct.weapons).length, 2);
    assert.equal(parsed.data.recentlyEquipped[0]?.image, undefined);
  });

  it("rejects a payload that is not a loadout", () => {
    const parsed = putLoadoutSchema.safeParse({ hello: true });
    assert.equal(parsed.success, false);
  });
});
