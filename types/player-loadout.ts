/**
 * Persisted player loadout — UI state + game-facing projection for CS2 plugins.
 */

import type {
  EquippedAgent,
  EquippedItem,
  LoadoutSide,
  SideLoadout,
  UserLoadoutState,
} from "@/types/loadout";

/** Plugin-facing weapon skin (WallBang.Skins SkinSelection). */
export type GameWeaponSkin = {
  weaponId: string;
  skinId: string;
  paintKit: number;
  patternSeed: number;
  wear: number;
  statTrak: boolean;
};

/** Plugin-facing knife (WallBang.Knife KnifeSelection). */
export type GameKnifeSkin = {
  knifeId: string;
  finishId?: string;
  paintKit: number;
  patternSeed: number;
  wear: number;
  statTrak: boolean;
};

/** Plugin-facing gloves (WallBang.Gloves GloveSelection). */
export type GameGloveSkin = {
  gloveId: string;
  skinId?: string;
  paintKit: number;
  patternSeed: number;
  wear: number;
};

/** Plugin-facing agent selection. */
export type GameAgent = {
  agentId: string;
  name: string;
  faction: "CT" | "T";
};

/** Per-side plugin projection. */
export type GameSideLoadout = {
  weapons: Record<string, GameWeaponSkin>;
  knife: GameKnifeSkin | null;
  gloves: GameGloveSkin | null;
  agent: GameAgent | null;
};

/** Returned on GET /api/v1/player/:steamId as `loadout`. */
export type GameLoadout = {
  weapons: Record<string, GameWeaponSkin>;
  knife: GameKnifeSkin | null;
  gloves: GameGloveSkin | null;
  agentCT: GameAgent | null;
  agentT: GameAgent | null;
  sides: {
    CT: GameSideLoadout;
    T: GameSideLoadout;
  };
  updatedAt: string;
};

export type PlayerLoadoutDoc = {
  steamId: string;
  userId: string;
  loadout: UserLoadoutState;
  updatedAt: Date;
};

export type PlayerLoadoutResponse = {
  loadout: UserLoadoutState;
  game: GameLoadout;
  updatedAt: string;
};

function catalogSkinId(skinId: string, weaponId: string): string {
  const prefix = `${weaponId}:`;
  if (skinId.startsWith(prefix)) return skinId.slice(prefix.length);
  const idx = skinId.indexOf(":");
  return idx >= 0 ? skinId.slice(idx + 1) : skinId;
}

export function emptySideLoadout(): SideLoadout {
  return {
    weapons: {},
    knife: null,
    gloves: null,
    agent: null,
  };
}

export function emptyUserLoadout(): UserLoadoutState {
  return {
    ct: emptySideLoadout(),
    t: emptySideLoadout(),
    favorites: [],
    recentlyEquipped: [],
  };
}

function gameWeaponsFromSide(
  weapons: Record<string, EquippedItem>,
): Record<string, GameWeaponSkin> {
  const out: Record<string, GameWeaponSkin> = {};
  for (const [weaponId, item] of Object.entries(weapons)) {
    if (!item || item.paintKit <= 0) continue;
    out[weaponId] = {
      weaponId,
      skinId: catalogSkinId(item.skinId, weaponId),
      paintKit: item.paintKit,
      patternSeed: Math.max(0, Math.min(999, Math.floor(item.seed))),
      wear: item.wear,
      statTrak: item.stattrak,
    };
  }
  return out;
}

function gameKnifeFromItem(item: EquippedItem | null): GameKnifeSkin | null {
  if (!item) return null;
  const knifeId = item.weapon;
  return {
    knifeId,
    finishId: catalogSkinId(item.skinId, knifeId) || undefined,
    paintKit: item.paintKit,
    patternSeed: Math.max(0, Math.min(999, Math.floor(item.seed))),
    wear: item.wear,
    statTrak: item.stattrak,
  };
}

function gameGlovesFromItem(item: EquippedItem | null): GameGloveSkin | null {
  if (!item || item.paintKit <= 0) return null;
  const gloveId = item.weapon;
  return {
    gloveId,
    skinId: catalogSkinId(item.skinId, gloveId) || undefined,
    paintKit: item.paintKit,
    patternSeed: Math.max(0, Math.min(999, Math.floor(item.seed))),
    wear: item.wear,
  };
}

function gameAgentFromItem(agent: EquippedAgent | null): GameAgent | null {
  if (!agent) return null;
  return {
    agentId: agent.agentId,
    name: agent.name,
    faction: agent.faction,
  };
}

function toGameSide(side: SideLoadout): GameSideLoadout {
  return {
    weapons: gameWeaponsFromSide(side.weapons),
    knife: gameKnifeFromItem(side.knife),
    gloves: gameGlovesFromItem(side.gloves),
    agent: gameAgentFromItem(side.agent),
  };
}

export function toGameLoadout(
  state: UserLoadoutState,
  updatedAt: Date | string,
): GameLoadout {
  const ct = toGameSide(state.ct);
  const t = toGameSide(state.t);
  return {
    // Legacy flat fields: CT weapons/knife/gloves so older plugins still apply a loadout.
    weapons: ct.weapons,
    knife: ct.knife,
    gloves: ct.gloves,
    agentCT: ct.agent,
    agentT: t.agent,
    sides: { CT: ct, T: t },
    updatedAt:
      typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString(),
  };
}

export function sanitizeEquippedItem(item: EquippedItem): EquippedItem {
  return {
    weapon: item.weapon,
    paintKit: Math.max(0, Math.floor(item.paintKit)),
    skinId: item.skinId,
    skinName: item.skinName,
    rarity: item.rarity,
    wear: Math.min(1, Math.max(0, item.wear)),
    wearName: item.wearName,
    stattrak: Boolean(item.stattrak),
    seed: Math.max(0, Math.min(999, Math.floor(item.seed))),
    image: item.image,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

export function sanitizeEquippedAgent(agent: EquippedAgent): EquippedAgent {
  return {
    agentId: agent.agentId,
    name: agent.name,
    faction: agent.faction,
    updatedAt: agent.updatedAt || new Date().toISOString(),
  };
}

function sanitizeWeapons(
  input: Record<string, EquippedItem> | undefined,
): Record<string, EquippedItem> {
  const weapons: Record<string, EquippedItem> = {};
  for (const [id, item] of Object.entries(input ?? {})) {
    if (!item?.skinId) continue;
    weapons[id] = sanitizeEquippedItem(item);
  }
  return weapons;
}

function sanitizeSide(input: Partial<SideLoadout> | undefined): SideLoadout {
  return {
    weapons: sanitizeWeapons(input?.weapons),
    knife: input?.knife ? sanitizeEquippedItem(input.knife) : null,
    gloves: input?.gloves ? sanitizeEquippedItem(input.gloves) : null,
    agent: input?.agent ? sanitizeEquippedAgent(input.agent) : null,
  };
}

function isSidedInput(
  input: unknown,
): input is { ct: SideLoadout; t: SideLoadout } {
  if (!input || typeof input !== "object") return false;
  const rec = input as Record<string, unknown>;
  return (
    rec.ct != null &&
    typeof rec.ct === "object" &&
    rec.t != null &&
    typeof rec.t === "object"
  );
}

export function sanitizeUserLoadout(input: unknown): UserLoadoutState {
  const rec = (input ?? {}) as Record<string, unknown> &
    Partial<UserLoadoutState> & {
      weapons?: Record<string, EquippedItem>;
      knife?: EquippedItem | null;
      gloves?: EquippedItem | null;
      agentCT?: EquippedAgent | null;
      agentT?: EquippedAgent | null;
    };

  const favorites = Array.isArray(rec.favorites)
    ? rec.favorites.filter((f) => typeof f === "string").slice(0, 100)
    : [];
  const recentlyEquipped = Array.isArray(rec.recentlyEquipped)
    ? rec.recentlyEquipped
        .filter((i) => i?.skinId)
        .slice(0, 8)
        .map(sanitizeEquippedItem)
    : [];

  if (isSidedInput(rec)) {
    return {
      ct: sanitizeSide(rec.ct),
      t: sanitizeSide(rec.t),
      favorites,
      recentlyEquipped,
    };
  }

  const weapons = sanitizeWeapons(rec.weapons);
  const knife = rec.knife ? sanitizeEquippedItem(rec.knife) : null;
  const gloves = rec.gloves ? sanitizeEquippedItem(rec.gloves) : null;

  return {
    ct: {
      weapons: { ...weapons },
      knife,
      gloves,
      agent: rec.agentCT ? sanitizeEquippedAgent(rec.agentCT) : null,
    },
    t: {
      weapons: { ...weapons },
      knife,
      gloves,
      agent: rec.agentT ? sanitizeEquippedAgent(rec.agentT) : null,
    },
    favorites,
    recentlyEquipped,
  };
}

export function getSideLoadout(
  state: UserLoadoutState,
  side: LoadoutSide,
): SideLoadout {
  return side === "CT" ? state.ct : state.t;
}

export function updateSideLoadout(
  state: UserLoadoutState,
  side: LoadoutSide,
  updater: (current: SideLoadout) => SideLoadout,
): UserLoadoutState {
  const key = side === "CT" ? "ct" : "t";
  return {
    ...state,
    [key]: updater(state[key]),
  };
}
