import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  CosmeticsCatalogMetaDoc,
  CosmeticsGlovesDoc,
  CosmeticsKnivesDoc,
  CosmeticsSkinDoc,
  CosmeticsWeaponDoc,
} from "@/types/catalog";

const META = "cosmetics_catalog_meta";
const WEAPONS = "cosmetics_weapons";
const SKINS = "cosmetics_skins";
const KNIVES = "cosmetics_knives";
const GLOVES = "cosmetics_gloves";

let indexesReady: Promise<void> | null = null;

export async function cosmeticsMetaCollection(): Promise<
  Collection<CosmeticsCatalogMetaDoc>
> {
  const db = await getDb();
  return db.collection<CosmeticsCatalogMetaDoc>(META);
}

export async function cosmeticsWeaponsCollection(): Promise<
  Collection<CosmeticsWeaponDoc>
> {
  const db = await getDb();
  return db.collection<CosmeticsWeaponDoc>(WEAPONS);
}

export async function cosmeticsSkinsCollection(): Promise<
  Collection<CosmeticsSkinDoc>
> {
  const db = await getDb();
  return db.collection<CosmeticsSkinDoc>(SKINS);
}

export async function cosmeticsKnivesCollection(): Promise<
  Collection<CosmeticsKnivesDoc>
> {
  const db = await getDb();
  return db.collection<CosmeticsKnivesDoc>(KNIVES);
}

export async function cosmeticsGlovesCollection(): Promise<
  Collection<CosmeticsGlovesDoc>
> {
  const db = await getDb();
  return db.collection<CosmeticsGlovesDoc>(GLOVES);
}

export async function ensureCosmeticsIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [weapons, skins, knives, gloves] = await Promise.all([
        cosmeticsWeaponsCollection(),
        cosmeticsSkinsCollection(),
        cosmeticsKnivesCollection(),
        cosmeticsGlovesCollection(),
      ]);

      await Promise.all([
        weapons.createIndex({ version: 1, id: 1 }, { unique: true }),
        weapons.createIndex({ version: 1, category: 1 }),
        skins.createIndex(
          { version: 1, weaponId: 1, paintKit: 1 },
          { unique: true },
        ),
        skins.createIndex({ version: 1, weaponId: 1 }),
        knives.createIndex({ version: 1 }, { unique: true }),
        gloves.createIndex({ version: 1 }, { unique: true }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
