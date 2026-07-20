import { z } from "zod";

import type { SkinRarity, WearName } from "@/types/loadout";

const skinRarity = z.enum([
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec",
  "Restricted",
  "Classified",
  "Covert",
  "Contraband",
  "Extraordinary",
  "Unknown",
]) satisfies z.ZodType<SkinRarity>;

const wearName = z.enum([
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
]) satisfies z.ZodType<WearName>;

const equippedItemSchema = z
  .object({
    weapon: z.string().trim().min(1).max(64),
    paintKit: z.number().int().min(0).max(100_000),
    skinId: z.string().trim().min(1).max(128),
    skinName: z.string().trim().min(1).max(128),
    rarity: skinRarity,
    wear: z.number().min(0).max(1),
    wearName,
    stattrak: z.boolean(),
    seed: z.number().int().min(0).max(999),
    image: z.string().max(2048).optional(),
    updatedAt: z.string().min(1).max(64),
  })
  .strict();

const equippedAgentSchema = z
  .object({
    agentId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(128),
    faction: z.enum(["CT", "T"]),
    updatedAt: z.string().min(1).max(64),
  })
  .strict();

export const putLoadoutSchema = z
  .object({
    weapons: z.record(z.string().max(64), equippedItemSchema).default({}),
    knife: equippedItemSchema.nullable().default(null),
    gloves: equippedItemSchema.nullable().default(null),
    agentCT: equippedAgentSchema.nullable().default(null),
    agentT: equippedAgentSchema.nullable().default(null),
    favorites: z.array(z.string().max(128)).max(100).default([]),
    recentlyEquipped: z.array(equippedItemSchema).max(8).default([]),
  })
  .strict();

export type PutLoadoutSchema = z.infer<typeof putLoadoutSchema>;
