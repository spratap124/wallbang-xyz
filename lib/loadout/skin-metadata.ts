import type { SkinRarity } from "@/types/loadout";

import skinMetadata from "@/lib/loadout/skin-metadata.json";

type SkinMeta = {
  rarity: SkinRarity;
  collection: string;
};

type SkinMetadataFile = {
  byDefPaint?: Record<string, SkinMeta>;
  byIdPaint?: Record<string, SkinMeta>;
  byName?: Record<string, SkinMeta>;
};

const data = skinMetadata as SkinMetadataFile;

export function normalizeSkinRarity(name: string | undefined | null): SkinRarity {
  if (!name) return "Unknown";
  if (name === "Mil-Spec Grade") return "Mil-Spec";
  const allowed: SkinRarity[] = [
    "Consumer Grade",
    "Industrial Grade",
    "Mil-Spec",
    "Restricted",
    "Classified",
    "Covert",
    "Contraband",
    "Extraordinary",
    "Unknown",
  ];
  return allowed.includes(name as SkinRarity) ? (name as SkinRarity) : "Unknown";
}

export function lookupSkinMetadata(input: {
  weaponId?: string | null;
  defIndex?: number | null;
  paintKit: number;
  skinName?: string | null;
  weaponDisplayName?: string | null;
}): SkinMeta | undefined {
  const paint = String(input.paintKit);

  if (input.defIndex != null && input.defIndex > 0) {
    const hit = data.byDefPaint?.[`${input.defIndex}:${paint}`];
    if (hit) return hit;
  }

  if (input.weaponId) {
    const hit = data.byIdPaint?.[`${input.weaponId}:${paint}`];
    if (hit) return hit;
  }

  if (input.weaponDisplayName && input.skinName) {
    const hit = data.byName?.[`${input.weaponDisplayName}|${input.skinName}`];
    if (hit) return hit;
  }

  return undefined;
}

export function enrichSkinMeta<
  T extends {
    paintKit: number;
    skinName: string;
    rarity: SkinRarity;
    collection: string;
    weapon: string;
  },
>(
  skin: T,
  weaponRef?: {
    id?: string | null;
    defIndex?: number | null;
    name?: string | null;
  },
): T {
  const meta = lookupSkinMetadata({
    weaponId: weaponRef?.id ?? skin.weapon,
    defIndex: weaponRef?.defIndex,
    paintKit: skin.paintKit,
    skinName: skin.skinName,
    weaponDisplayName: weaponRef?.name,
  });

  if (!meta) return skin;

  return {
    ...skin,
    rarity: meta.rarity,
    collection: meta.collection || skin.collection,
  };
}
