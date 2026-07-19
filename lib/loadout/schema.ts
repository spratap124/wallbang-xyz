import { z } from "zod";

const wearPresetSchema = z.object({
  id: z.string().min(1).max(32),
  displayName: z.string().min(1).max(64),
  wear: z.number().min(0).max(1),
});

const weaponSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  category: z.string().min(1).max(64),
  weapon: z.string().min(1).max(64),
  defIndex: z.number().int().nonnegative(),
  skinCount: z.number().int().nonnegative(),
});

const skinSchema = z.object({
  id: z.string().min(1).max(128),
  paintKit: z.number().int().nonnegative(),
  name: z.string().min(1).max(256),
  wearRemapMin: z.number().min(0).max(1),
  wearRemapMax: z.number().min(0).max(1),
});

const knifeFinishVariantSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  paintKit: z.number().int().nonnegative().nullable().optional(),
  seed: z.number().int().nullable().optional(),
});

const knifeFinishSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  paintKit: z.number().int().nonnegative(),
  skipWear: z.boolean().optional(),
  variants: z.array(knifeFinishVariantSchema).max(64).optional(),
});

const knifeSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  weapon: z.string().min(1).max(64),
  defIndex: z.number().int().nonnegative(),
  finishSet: z.string().min(1).max(64).nullable().optional(),
});

const gloveSkinSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  paintKit: z.number().int().nonnegative(),
});

const gloveSchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(128),
  defIndex: z.number().int().nonnegative(),
  skins: z.array(gloveSkinSchema).max(256),
});

export const cosmeticsCatalogIngestSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string().min(1).max(128),
  generatedAt: z.string().datetime(),
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "contentHash must be sha256 hex"),
  manifest: z.object({
    weapons: z.number().int().nonnegative(),
    weaponSkins: z.number().int().nonnegative(),
    knives: z.number().int().nonnegative(),
    finishes: z.number().int().nonnegative(),
    gloves: z.number().int().nonnegative(),
    gloveSkins: z.number().int().nonnegative(),
    paintKits: z.number().int().nonnegative().optional(),
  }),
  wearPresets: z.object({
    weapons: z.array(wearPresetSchema).min(1).max(16),
    knives: z.array(wearPresetSchema).min(1).max(16),
    gloves: z.array(wearPresetSchema).min(1).max(16),
  }),
  weapons: z.array(weaponSchema).max(128),
  weaponSkins: z
    .array(
      z.object({
        weaponId: z.string().min(1).max(64),
        skins: z.array(skinSchema).max(512),
      }),
    )
    .max(128),
  knives: z.object({
    finishes: z.record(z.string(), knifeFinishSchema),
    finishSets: z.record(z.string(), z.array(z.string().min(1).max(64)).max(128)),
    knives: z.array(knifeSchema).max(64),
  }),
  gloves: z.object({
    gloves: z.array(gloveSchema).max(32),
  }),
});

export type CosmeticsCatalogIngestInput = z.infer<
  typeof cosmeticsCatalogIngestSchema
>;
