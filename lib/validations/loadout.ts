import { z } from "zod";

import {
  coerceEquippedImage,
  coerceSkinRarity,
  coerceWearName,
  sanitizeUserLoadout,
} from "@/types/player-loadout";

const equippedItemSchema = z
  .object({
    weapon: z.string().trim().min(1).max(64),
    paintKit: z.number().int().min(0).max(100_000),
    skinId: z.string().trim().min(1).max(128),
    skinName: z.string().trim().min(1).max(128),
    rarity: z.string().transform(coerceSkinRarity),
    wear: z.number().min(0).max(1),
    wearName: z.string().transform(coerceWearName),
    stattrak: z.boolean(),
    seed: z
      .number()
      .transform((value) => Math.max(0, Math.min(999, Math.floor(value)))),
    image: z
      .string()
      .max(2048)
      .nullish()
      .transform((value) => coerceEquippedImage(value)),
    updatedAt: z.string().min(1).max(64),
  })
  .strip();

const equippedAgentSchema = z
  .object({
    agentId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(128),
    faction: z.enum(["CT", "T"]),
    updatedAt: z.string().min(1).max(64),
  })
  .strip();

function parseRecentItem(item: unknown) {
  const parsed = equippedItemSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

const recentItemsSchema = z
  .array(z.unknown())
  .max(8)
  .default([])
  .transform((items) => items.map(parseRecentItem).filter((item) => item != null));

const sideLoadoutSchema = z
  .object({
    weapons: z.record(z.string().max(64), equippedItemSchema).default({}),
    knife: equippedItemSchema.nullable().default(null),
    gloves: equippedItemSchema.nullable().default(null),
    agent: equippedAgentSchema.nullable().default(null),
  })
  .strip();

const sidedLoadoutSchema = z
  .object({
    ct: sideLoadoutSchema,
    t: sideLoadoutSchema,
    favorites: z.array(z.string().max(128)).max(100).default([]),
    recentlyEquipped: recentItemsSchema,
  })
  .strict();

/** Pre-CT/T documents still accepted, then migrated in sanitizeUserLoadout. */
const legacyLoadoutSchema = z
  .object({
    weapons: z.record(z.string().max(64), equippedItemSchema).default({}),
    knife: equippedItemSchema.nullable().default(null),
    gloves: equippedItemSchema.nullable().default(null),
    agentCT: equippedAgentSchema.nullable().default(null),
    agentT: equippedAgentSchema.nullable().default(null),
    favorites: z.array(z.string().max(128)).max(100).default([]),
    recentlyEquipped: recentItemsSchema,
  })
  .strict();

export const putLoadoutSchema = z
  .union([sidedLoadoutSchema, legacyLoadoutSchema])
  .transform((value) => sanitizeUserLoadout(value));

export type PutLoadoutSchema = z.infer<typeof putLoadoutSchema>;
