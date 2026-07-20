/**
 * Persisted player loadout — UI state + game-facing projection for CS2 plugins.
 */

import type {
  EquippedAgent,
  EquippedItem,
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

/** Returned on GET /api/v1/player/:steamId as `loadout`. */
export type GameLoadout = {
  weapons: Record<string, GameWeaponSkin>;
  knife: GameKnifeSkin | null;
  gloves: GameGloveSkin | null;
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

export function emptyUserLoadout(): UserLoadoutState {
  return {
    weapons: {},
    knife: null,
    gloves: null,
    agentCT: null,
    agentT: null,
    favorites: [],
    recentlyEquipped: [],
  };
}

export function toGameLoadout(
  state: UserLoadoutState,
  updatedAt: Date | string,
): GameLoadout {
  const weapons: Record<string, GameWeaponSkin> = {};
  for (const [weaponId, item] of Object.entries(state.weapons)) {
    if (!item || item.paintKit <= 0) continue;
    weapons[weaponId] = {
      weaponId,
      skinId: catalogSkinId(item.skinId, weaponId),
      paintKit: item.paintKit,
      patternSeed: Math.max(0, Math.min(999, Math.floor(item.seed))),
      wear: item.wear,
      statTrak: item.stattrak,
    };
  }

  let knife: GameKnifeSkin | null = null;
  if (state.knife) {
    const knifeId = state.knife.weapon;
    knife = {
      knifeId,
      finishId: catalogSkinId(state.knife.skinId, knifeId) || undefined,
      paintKit: state.knife.paintKit,
      patternSeed: Math.max(0, Math.min(999, Math.floor(state.knife.seed))),
      wear: state.knife.wear,
      statTrak: state.knife.stattrak,
    };
  }

  let gloves: GameGloveSkin | null = null;
  if (state.gloves && state.gloves.paintKit > 0) {
    const gloveId = state.gloves.weapon;
    gloves = {
      gloveId,
      skinId: catalogSkinId(state.gloves.skinId, gloveId) || undefined,
      paintKit: state.gloves.paintKit,
      patternSeed: Math.max(0, Math.min(999, Math.floor(state.gloves.seed))),
      wear: state.gloves.wear,
    };
  }

  return {
    weapons,
    knife,
    gloves,
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

export function sanitizeUserLoadout(input: UserLoadoutState): UserLoadoutState {
  const weapons: Record<string, EquippedItem> = {};
  for (const [id, item] of Object.entries(input.weapons ?? {})) {
    if (!item?.skinId) continue;
    weapons[id] = sanitizeEquippedItem(item);
  }

  return {
    weapons,
    knife: input.knife ? sanitizeEquippedItem(input.knife) : null,
    gloves: input.gloves ? sanitizeEquippedItem(input.gloves) : null,
    agentCT: input.agentCT ? sanitizeEquippedAgent(input.agentCT) : null,
    agentT: input.agentT ? sanitizeEquippedAgent(input.agentT) : null,
    favorites: Array.isArray(input.favorites)
      ? input.favorites.filter((f) => typeof f === "string").slice(0, 100)
      : [],
    recentlyEquipped: Array.isArray(input.recentlyEquipped)
      ? input.recentlyEquipped
          .filter((i) => i?.skinId)
          .slice(0, 8)
          .map(sanitizeEquippedItem)
      : [],
  };
}
