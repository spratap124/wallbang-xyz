import "server-only";

import { findUserBySteamId } from "@/lib/auth/users";
import {
  getGloveDetail,
  getKnifeDetail,
  listSkinsForWeapon,
  listWeapons,
} from "@/lib/loadout/catalog";
import { wearNameFromFloat } from "@/lib/loadout/constants";
import { resolveSkinImage, resolveSkinImageByName } from "@/lib/loadout/images";
import { AGENTS } from "@/lib/loadout/mock-data";
import { lookupSkinMetadata } from "@/lib/loadout/skin-metadata";
import type {
  GameAgentPatch,
  GameGlovePatch,
  GameKnifePatch,
  GameWeaponPatch,
  PatchGameLoadoutInput,
} from "@/lib/validations/game-loadout";
import type { EquippedAgent, EquippedItem, UserLoadoutState } from "@/types/loadout";
import {
  emptyUserLoadout,
  sanitizeUserLoadout,
} from "@/types/player-loadout";

const DEFAULT_WEAR = 0.15;

function nowIso(): string {
  return new Date().toISOString();
}

export async function resolveLoadoutUserId(steamId: string): Promise<string> {
  const user = await findUserBySteamId(steamId);
  return user?._id ?? steamId;
}

export async function weaponPatchToEquipped(
  patch: GameWeaponPatch,
): Promise<EquippedItem> {
  const [{ skins }, { weapons }] = await Promise.all([
    listSkinsForWeapon(patch.weaponId),
    listWeapons(),
  ]);
  const weaponDef = weapons.find((w) => w.id === patch.weaponId);
  const catalogSkin =
    (patch.skinId ? skins.find((s) => s.id === patch.skinId) : undefined) ??
    skins.find((s) => s.paintKit === patch.paintKit);
  const skinId = catalogSkin?.id ?? patch.skinId ?? String(patch.paintKit);
  const skinName = catalogSkin?.name ?? `Paint Kit ${patch.paintKit}`;
  const wear = patch.wear ?? DEFAULT_WEAR;
  const meta = lookupSkinMetadata({
    weaponId: patch.weaponId,
    defIndex: weaponDef?.defIndex,
    paintKit: patch.paintKit,
    skinName,
    weaponDisplayName: weaponDef?.displayName,
  });
  const weaponRef = { id: patch.weaponId, defIndex: weaponDef?.defIndex };
  const image =
    resolveSkinImage(weaponRef, patch.paintKit) ??
    (weaponDef
      ? resolveSkinImageByName(`${weaponDef.displayName}|${skinName}`)
      : undefined);

  return {
    weapon: patch.weaponId,
    paintKit: patch.paintKit,
    skinId: `${patch.weaponId}:${skinId}`,
    skinName,
    rarity: meta?.rarity ?? "Unknown",
    wear,
    wearName: wearNameFromFloat(wear),
    stattrak: patch.statTrak ?? false,
    seed: patch.patternSeed ?? 0,
    image,
    updatedAt: nowIso(),
  };
}

export async function knifePatchToEquipped(
  patch: GameKnifePatch,
): Promise<EquippedItem> {
  const detail = await getKnifeDetail(patch.knifeId);
  const finish =
    (patch.finishId
      ? detail.finishes.find((f) => f.id === patch.finishId)
      : undefined) ??
    detail.finishes.find((f) => f.paintKit === patch.paintKit);
  const finishId = finish?.id ?? patch.finishId ?? String(patch.paintKit);
  const skinName = finish?.displayName ?? `Finish ${patch.paintKit}`;
  const wear = patch.wear ?? DEFAULT_WEAR;
  const meta = lookupSkinMetadata({
    weaponId: detail.knife.id,
    defIndex: detail.knife.defIndex,
    paintKit: patch.paintKit,
    skinName,
    weaponDisplayName: detail.knife.displayName,
  });
  const weaponRef = {
    id: detail.knife.id,
    defIndex: detail.knife.defIndex,
  };
  const image =
    resolveSkinImage(weaponRef, patch.paintKit) ??
    resolveSkinImageByName(`${detail.knife.displayName}|${skinName}`);

  return {
    weapon: detail.knife.id,
    paintKit: patch.paintKit,
    skinId: `${detail.knife.id}:${finishId}`,
    skinName,
    rarity: meta?.rarity ?? "Covert",
    wear,
    wearName: wearNameFromFloat(wear),
    stattrak: patch.statTrak ?? false,
    seed: patch.patternSeed ?? 0,
    image,
    updatedAt: nowIso(),
  };
}

export async function glovePatchToEquipped(
  patch: GameGlovePatch,
): Promise<EquippedItem> {
  const detail = await getGloveDetail(patch.gloveId);
  const catalogSkin =
    (patch.skinId
      ? detail.glove.skins.find((s) => s.id === patch.skinId)
      : undefined) ??
    detail.glove.skins.find((s) => s.paintKit === patch.paintKit);
  const skinId = catalogSkin?.id ?? patch.skinId ?? String(patch.paintKit);
  const skinName = catalogSkin?.displayName ?? `Paint Kit ${patch.paintKit}`;
  const wear = patch.wear ?? DEFAULT_WEAR;
  const meta = lookupSkinMetadata({
    weaponId: detail.glove.id,
    defIndex: detail.glove.defIndex,
    paintKit: patch.paintKit,
    skinName,
    weaponDisplayName: detail.glove.displayName,
  });
  const weaponRef = {
    id: detail.glove.id,
    defIndex: detail.glove.defIndex,
  };
  const image =
    resolveSkinImage(weaponRef, patch.paintKit) ??
    resolveSkinImageByName(`${detail.glove.displayName}|${skinName}`);

  return {
    weapon: detail.glove.id,
    paintKit: patch.paintKit,
    skinId: `${detail.glove.id}:${skinId}`,
    skinName,
    rarity: meta?.rarity ?? "Extraordinary",
    wear,
    wearName: wearNameFromFloat(wear),
    stattrak: false,
    seed: patch.patternSeed ?? 0,
    image,
    updatedAt: nowIso(),
  };
}

export function agentPatchToEquipped(patch: GameAgentPatch): EquippedAgent {
  const known = AGENTS.find((a) => a.id === patch.agentId);
  return {
    agentId: patch.agentId,
    name: patch.name ?? known?.name ?? patch.agentId,
    faction: patch.faction,
    updatedAt: nowIso(),
  };
}

/** Merge a CS2 plugin patch into an existing UI loadout document. */
export async function mergeGameLoadoutPatch(
  current: UserLoadoutState,
  patch: PatchGameLoadoutInput,
): Promise<UserLoadoutState> {
  const next: UserLoadoutState = {
    ...current,
    weapons: { ...current.weapons },
  };

  if (patch.weapons) {
    for (const [weaponId, weaponPatch] of Object.entries(patch.weapons)) {
      next.weapons[weaponId] = await weaponPatchToEquipped({
        ...weaponPatch,
        weaponId,
      });
    }
  }

  if (patch.knife !== undefined) {
    next.knife = patch.knife ? await knifePatchToEquipped(patch.knife) : null;
  }

  if (patch.gloves !== undefined) {
    next.gloves = patch.gloves
      ? await glovePatchToEquipped(patch.gloves)
      : null;
  }

  if (patch.agentCT !== undefined) {
    next.agentCT = patch.agentCT ? agentPatchToEquipped(patch.agentCT) : null;
  }

  if (patch.agentT !== undefined) {
    next.agentT = patch.agentT ? agentPatchToEquipped(patch.agentT) : null;
  }

  return sanitizeUserLoadout(next);
}

export function emptyLoadoutState(): UserLoadoutState {
  return emptyUserLoadout();
}
