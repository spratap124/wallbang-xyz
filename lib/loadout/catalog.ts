import "server-only";

import { randomUUID } from "crypto";

import {
  cosmeticsGlovesCollection,
  cosmeticsKnivesCollection,
  cosmeticsMetaCollection,
  cosmeticsSkinsCollection,
  cosmeticsWeaponsCollection,
  ensureCosmeticsIndexes,
} from "@/lib/loadout/collections";
import type { CosmeticsCatalogIngestInput } from "@/lib/loadout/schema";
import type {
  CatalogGlove,
  CatalogKnife,
  CatalogManifest,
  CatalogSkin,
  CatalogWeapon,
  CatalogWearPresets,
  CosmeticsCatalogMetaDoc,
  KnifeFinish,
} from "@/types/catalog";
import type { Skin, WeaponDef } from "@/types/loadout";

export type IngestResult =
  | {
      unchanged: true;
      version: string;
      contentHash: string;
      manifest: CatalogManifest;
    }
  | {
      unchanged: false;
      version: string;
      contentHash: string;
      weapons: number;
      weaponSkins: number;
      knives: number;
      gloves: number;
      finishes: number;
      gloveSkins: number;
    };

export async function getActiveCatalogMeta(): Promise<CosmeticsCatalogMetaDoc | null> {
  await ensureCosmeticsIndexes();
  const meta = await cosmeticsMetaCollection();
  return meta.findOne({ _id: "active" });
}

export async function ingestCosmeticsCatalog(
  payload: CosmeticsCatalogIngestInput,
): Promise<IngestResult> {
  await ensureCosmeticsIndexes();

  const metaCol = await cosmeticsMetaCollection();
  const existing = await metaCol.findOne({ _id: "active" });

  if (existing && existing.contentHash === payload.contentHash) {
    return {
      unchanged: true,
      version: existing.version,
      contentHash: existing.contentHash,
      manifest: existing.manifest,
    };
  }

  const version = randomUUID();
  const generatedAt = new Date(payload.generatedAt);
  const ingestedAt = new Date();

  const weaponDocs = payload.weapons.map((w) => ({
    version,
    id: w.id,
    displayName: w.displayName,
    category: w.category,
    weapon: w.weapon,
    defIndex: w.defIndex,
    skinCount: w.skinCount,
  }));

  const skinDocs = payload.weaponSkins.flatMap((group) =>
    group.skins.map((s) => ({
      version,
      weaponId: group.weaponId,
      id: s.id,
      paintKit: s.paintKit,
      name: s.name,
      wearRemapMin: s.wearRemapMin,
      wearRemapMax: s.wearRemapMax,
    })),
  );

  const [weaponsCol, skinsCol, knivesCol, glovesCol] = await Promise.all([
    cosmeticsWeaponsCollection(),
    cosmeticsSkinsCollection(),
    cosmeticsKnivesCollection(),
    cosmeticsGlovesCollection(),
  ]);

  if (weaponDocs.length > 0) {
    await weaponsCol.insertMany(weaponDocs, { ordered: false });
  }
  if (skinDocs.length > 0) {
    // Batch insert to stay under BSON / write limits.
    const chunkSize = 500;
    for (let i = 0; i < skinDocs.length; i += chunkSize) {
      await skinsCol.insertMany(skinDocs.slice(i, i + chunkSize), {
        ordered: false,
      });
    }
  }

  await knivesCol.insertOne({
    _id: version,
    version,
    finishes: payload.knives.finishes,
    finishSets: payload.knives.finishSets,
    knives: payload.knives.knives,
  });

  await glovesCol.insertOne({
    _id: version,
    version,
    gloves: payload.gloves.gloves,
  });

  await metaCol.updateOne(
    { _id: "active" },
    {
      $set: {
        _id: "active",
        schemaVersion: 1 as const,
        source: payload.source,
        contentHash: payload.contentHash,
        generatedAt,
        ingestedAt,
        version,
        manifest: payload.manifest,
        wearPresets: payload.wearPresets,
      },
    },
    { upsert: true },
  );

  // Drop previous version rows after the active pointer flips.
  if (existing?.version && existing.version !== version) {
    await Promise.all([
      weaponsCol.deleteMany({ version: existing.version }),
      skinsCol.deleteMany({ version: existing.version }),
      knivesCol.deleteMany({ version: existing.version }),
      glovesCol.deleteMany({ version: existing.version }),
    ]);
  }

  const gloveSkins = payload.gloves.gloves.reduce(
    (n, g) => n + g.skins.length,
    0,
  );

  return {
    unchanged: false,
    version,
    contentHash: payload.contentHash,
    weapons: payload.weapons.length,
    weaponSkins: skinDocs.length,
    knives: payload.knives.knives.length,
    gloves: payload.gloves.gloves.length,
    finishes: Object.keys(payload.knives.finishes).length,
    gloveSkins,
  };
}

export async function listWeapons(): Promise<{
  meta: CosmeticsCatalogMetaDoc;
  weapons: CatalogWeapon[];
  wearPresets: CatalogWearPresets;
}> {
  const meta = await getActiveCatalogMeta();
  if (!meta) {
    throw new CatalogNotFoundError();
  }

  const col = await cosmeticsWeaponsCollection();
  const docs = await col
    .find({ version: meta.version })
    .sort({ category: 1, displayName: 1 })
    .toArray();

  return {
    meta,
    wearPresets: meta.wearPresets,
    weapons: docs.map((d) => ({
      id: d.id,
      displayName: d.displayName,
      category: d.category,
      weapon: d.weapon,
      defIndex: d.defIndex,
      skinCount: d.skinCount,
    })),
  };
}

export async function listSkinsForWeapon(
  weaponId: string,
): Promise<{ weaponId: string; skins: CatalogSkin[] }> {
  const meta = await getActiveCatalogMeta();
  if (!meta) {
    throw new CatalogNotFoundError();
  }

  const col = await cosmeticsSkinsCollection();
  const docs = await col
    .find({ version: meta.version, weaponId })
    .sort({ name: 1 })
    .toArray();

  return {
    weaponId,
    skins: docs.map((d) => ({
      id: d.id,
      paintKit: d.paintKit,
      name: d.name,
      wearRemapMin: d.wearRemapMin,
      wearRemapMax: d.wearRemapMax,
    })),
  };
}

export async function getKnivesCatalog(): Promise<{
  wearPresets: CatalogWearPresets["knives"];
  finishes: Record<string, KnifeFinish>;
  finishSets: Record<string, string[]>;
  knives: CatalogKnife[];
}> {
  const meta = await getActiveCatalogMeta();
  if (!meta) {
    throw new CatalogNotFoundError();
  }

  const col = await cosmeticsKnivesCollection();
  const doc = await col.findOne({ version: meta.version });
  if (!doc) {
    throw new CatalogNotFoundError("Knives catalog missing for active version.");
  }

  return {
    wearPresets: meta.wearPresets.knives,
    finishes: doc.finishes,
    finishSets: doc.finishSets,
    knives: doc.knives,
  };
}

export async function getKnifeDetail(knifeId: string): Promise<{
  knife: CatalogKnife;
  finishes: KnifeFinish[];
  wearPresets: CatalogWearPresets["knives"];
}> {
  const catalog = await getKnivesCatalog();
  const knife = catalog.knives.find(
    (k) => k.id === knifeId || k.weapon === knifeId,
  );
  if (!knife) {
    throw new CatalogNotFoundError(`Unknown knife '${knifeId}'.`);
  }

  const setIds = knife.finishSet
    ? (catalog.finishSets[knife.finishSet] ?? [])
    : [];
  const finishes = setIds
    .map((id) => catalog.finishes[id])
    .filter((f): f is KnifeFinish => Boolean(f));

  return {
    knife,
    finishes,
    wearPresets: catalog.wearPresets,
  };
}

export async function getGlovesCatalog(): Promise<{
  wearPresets: CatalogWearPresets["gloves"];
  gloves: CatalogGlove[];
}> {
  const meta = await getActiveCatalogMeta();
  if (!meta) {
    throw new CatalogNotFoundError();
  }

  const col = await cosmeticsGlovesCollection();
  const doc = await col.findOne({ version: meta.version });
  if (!doc) {
    throw new CatalogNotFoundError("Gloves catalog missing for active version.");
  }

  return {
    wearPresets: meta.wearPresets.gloves,
    gloves: doc.gloves,
  };
}

export async function getGloveDetail(gloveId: string): Promise<{
  glove: CatalogGlove;
  wearPresets: CatalogWearPresets["gloves"];
}> {
  const catalog = await getGlovesCatalog();
  const glove = catalog.gloves.find((g) => g.id === gloveId);
  if (!glove) {
    throw new CatalogNotFoundError(`Unknown glove '${gloveId}'.`);
  }
  return { glove, wearPresets: catalog.wearPresets };
}

/** Map catalog weapons → loadout WeaponDef (CS2 ids canonical). */
export function toWeaponDefs(weapons: CatalogWeapon[]): WeaponDef[] {
  return weapons.map((w) => ({
    id: w.id,
    name: w.displayName,
    group: w.category,
    category: "weapons" as const,
    weapon: w.weapon,
    defIndex: w.defIndex,
    skinCount: w.skinCount,
  }));
}

/** Map gun skins → loadout Skin rows (rarity/collection optional until enriched). */
export function toLoadoutSkins(
  weaponId: string,
  skins: CatalogSkin[],
  resolveImage?: (paintKit: number, skinId: string) => string | undefined,
): Skin[] {
  return skins.map((s) => ({
    id: `${weaponId}:${s.id}`,
    weapon: weaponId,
    paintKit: s.paintKit,
    skinName: s.name,
    rarity: "Unknown",
    collection: "",
    wearSupported: s.wearRemapMax > s.wearRemapMin || s.wearRemapMax > 0,
    wearRemapMin: s.wearRemapMin,
    wearRemapMax: s.wearRemapMax,
    stattrakSupported: true,
    image: resolveImage?.(s.paintKit, s.id),
  }));
}

export class CatalogNotFoundError extends Error {
  constructor(message = "Cosmetics catalog has not been ingested yet.") {
    super(message);
    this.name = "CatalogNotFoundError";
  }
}
