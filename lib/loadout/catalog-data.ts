/**
 * Catalog-backed loadout data layer.
 *
 * Replaces hard-coded mock weapon/skin lists. All weapon ids are CS2 catalog
 * ids from GenerateSkinDatabase (e.g. usp_silencer, m4a1_silencer, hkp2000).
 *
 * Prefer these helpers from Server Components / route handlers.
 * Browser code should use `@/lib/loadout/api-client` against `/api/skins`.
 */

import "server-only";

import {
  CatalogNotFoundError,
  getGloveDetail,
  getGlovesCatalog,
  getKnifeDetail,
  getKnivesCatalog,
  listSkinsForWeapon,
  listWeapons,
  toLoadoutSkins,
  toWeaponDefs,
} from "@/lib/loadout/catalog";
import { resolveSkinImage } from "@/lib/loadout/images";
import { lookupSkinMetadata } from "@/lib/loadout/skin-metadata";
import type { Skin, WeaponDef } from "@/types/loadout";

export { CatalogNotFoundError };

/** All gun definitions from the active catalog (CS2 ids). */
export async function getWeaponDefs(): Promise<WeaponDef[]> {
  const { weapons } = await listWeapons();
  return toWeaponDefs(weapons);
}

/** Skins for one weapon id (e.g. "ak47", "usp_silencer"). */
export async function fetchSkinsForWeapon(weaponId: string): Promise<Skin[]> {
  const [{ skins }, { weapons }] = await Promise.all([
    listSkinsForWeapon(weaponId),
    listWeapons(),
  ]);
  const weaponDef = weapons.find((w) => w.id === weaponId);
  const weaponRef = { id: weaponId, defIndex: weaponDef?.defIndex };
  return toLoadoutSkins(
    weaponId,
    skins,
    (paintKit) => resolveSkinImage(weaponRef, paintKit),
    { defIndex: weaponDef?.defIndex, name: weaponDef?.displayName },
  );
}

/** Knife models for the loadout knife picker. */
export async function getKnifeDefs(): Promise<WeaponDef[]> {
  const catalog = await getKnivesCatalog();
  return catalog.knives.map((k) => ({
    id: k.id,
    name: k.displayName,
    group: "Knives",
    category: "knives" as const,
    weapon: k.weapon,
    defIndex: k.defIndex,
  }));
}

export async function fetchFinishesForKnife(knifeId: string) {
  return getKnifeDetail(knifeId);
}

/** Glove models for the loadout glove picker. */
export async function getGloveDefs(): Promise<WeaponDef[]> {
  const catalog = await getGlovesCatalog();
  return catalog.gloves.map((g) => ({
    id: g.id,
    name: g.displayName,
    group: "Gloves",
    category: "gloves" as const,
    defIndex: g.defIndex,
    skinCount: g.skins.length,
  }));
}

export async function fetchSkinsForGlove(gloveId: string): Promise<Skin[]> {
  const { glove } = await getGloveDetail(gloveId);
  const weaponRef = { id: glove.id, defIndex: glove.defIndex };
  return glove.skins.map((s) => {
    const meta = lookupSkinMetadata({
      weaponId: glove.id,
      defIndex: glove.defIndex,
      paintKit: s.paintKit,
      skinName: s.displayName,
      weaponDisplayName: glove.displayName,
    });
    return {
      id: `${glove.id}:${s.id}`,
      weapon: glove.id,
      paintKit: s.paintKit,
      skinName: s.displayName,
      rarity: meta?.rarity ?? "Extraordinary",
      collection: meta?.collection ?? "",
      wearSupported: true,
      stattrakSupported: false,
      image: resolveSkinImage(weaponRef, s.paintKit),
    };
  });
}
