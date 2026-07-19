/** Mongo / API types for the CS2 → web cosmetics catalog sync. */

export type WearPreset = {
  id: string;
  displayName: string;
  wear: number;
};

export type CatalogWeapon = {
  id: string;
  displayName: string;
  category: string;
  weapon: string;
  defIndex: number;
  skinCount: number;
};

export type CatalogSkin = {
  id: string;
  paintKit: number;
  name: string;
  wearRemapMin: number;
  wearRemapMax: number;
};

export type CatalogWeaponSkins = {
  weaponId: string;
  skins: CatalogSkin[];
};

export type KnifeFinishVariant = {
  id: string;
  displayName: string;
  paintKit?: number | null;
  seed?: number | null;
};

export type KnifeFinish = {
  id: string;
  displayName: string;
  paintKit: number;
  skipWear?: boolean;
  variants?: KnifeFinishVariant[];
};

export type CatalogKnife = {
  id: string;
  displayName: string;
  weapon: string;
  defIndex: number;
  finishSet?: string | null;
};

export type CatalogGloveSkin = {
  id: string;
  displayName: string;
  paintKit: number;
};

export type CatalogGlove = {
  id: string;
  displayName: string;
  defIndex: number;
  skins: CatalogGloveSkin[];
};

export type CatalogManifest = {
  weapons: number;
  weaponSkins: number;
  knives: number;
  finishes: number;
  gloves: number;
  gloveSkins: number;
  paintKits?: number;
};

export type CatalogWearPresets = {
  weapons: WearPreset[];
  knives: WearPreset[];
  gloves: WearPreset[];
};

export type CatalogKnivesPayload = {
  finishes: Record<string, KnifeFinish>;
  finishSets: Record<string, string[]>;
  knives: CatalogKnife[];
};

export type CatalogGlovesPayload = {
  gloves: CatalogGlove[];
};

/** POST /api/v1/catalog/cosmetics body (after Zod parse). */
export type CosmeticsCatalogIngest = {
  schemaVersion: 1;
  source: string;
  generatedAt: string;
  contentHash: string;
  manifest: CatalogManifest;
  wearPresets: CatalogWearPresets;
  weapons: CatalogWeapon[];
  weaponSkins: CatalogWeaponSkins[];
  knives: CatalogKnivesPayload;
  gloves: CatalogGlovesPayload;
};

export type CosmeticsCatalogMetaDoc = {
  _id: "active";
  schemaVersion: 1;
  source: string;
  contentHash: string;
  generatedAt: Date;
  ingestedAt: Date;
  version: string;
  manifest: CatalogManifest;
  wearPresets: CatalogWearPresets;
};

export type CosmeticsWeaponDoc = {
  version: string;
  id: string;
  displayName: string;
  category: string;
  weapon: string;
  defIndex: number;
  skinCount: number;
};

export type CosmeticsSkinDoc = {
  version: string;
  weaponId: string;
  id: string;
  paintKit: number;
  name: string;
  wearRemapMin: number;
  wearRemapMax: number;
};

export type CosmeticsKnivesDoc = {
  _id: string;
  version: string;
  finishes: Record<string, KnifeFinish>;
  finishSets: Record<string, string[]>;
  knives: CatalogKnife[];
};

export type CosmeticsGlovesDoc = {
  _id: string;
  version: string;
  gloves: CatalogGlove[];
};
