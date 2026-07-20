import { z } from "zod";

const gameWeaponPatchSchema = z
  .object({
    weaponId: z.string().trim().min(1).max(64),
    skinId: z.string().trim().min(1).max(128).optional(),
    paintKit: z.number().int().min(1).max(100_000),
    patternSeed: z.number().int().min(0).max(999).optional(),
    wear: z.number().min(0).max(1).optional(),
    statTrak: z.boolean().optional(),
  })
  .strict();

const gameKnifePatchSchema = z
  .object({
    knifeId: z.string().trim().min(1).max(64),
    finishId: z.string().trim().min(1).max(128).optional(),
    paintKit: z.number().int().min(1).max(100_000),
    patternSeed: z.number().int().min(0).max(999).optional(),
    wear: z.number().min(0).max(1).optional(),
    statTrak: z.boolean().optional(),
  })
  .strict();

const gameGlovePatchSchema = z
  .object({
    gloveId: z.string().trim().min(1).max(64),
    skinId: z.string().trim().min(1).max(128).optional(),
    paintKit: z.number().int().min(1).max(100_000),
    patternSeed: z.number().int().min(0).max(999).optional(),
    wear: z.number().min(0).max(1).optional(),
  })
  .strict();

const gameAgentPatchSchema = z
  .object({
    agentId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(128).optional(),
    faction: z.enum(["CT", "T"]),
  })
  .strict();

/**
 * CS2 plugin → web loadout sync.
 * All fields optional; only provided slots are merged into the saved loadout.
 *
 * Used after !skins / !knife / !gloves / agent menu selections in-game.
 */
export const patchGameLoadoutSchema = z
  .object({
    weapons: z.record(z.string().max(64), gameWeaponPatchSchema).optional(),
    knife: gameKnifePatchSchema.nullable().optional(),
    gloves: gameGlovePatchSchema.nullable().optional(),
    agentCT: gameAgentPatchSchema.nullable().optional(),
    agentT: gameAgentPatchSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.weapons !== undefined ||
      body.knife !== undefined ||
      body.gloves !== undefined ||
      body.agentCT !== undefined ||
      body.agentT !== undefined,
    { message: "At least one loadout slot must be provided." },
  );

export type PatchGameLoadoutInput = z.infer<typeof patchGameLoadoutSchema>;
export type GameWeaponPatch = z.infer<typeof gameWeaponPatchSchema>;
export type GameKnifePatch = z.infer<typeof gameKnifePatchSchema>;
export type GameGlovePatch = z.infer<typeof gameGlovePatchSchema>;
export type GameAgentPatch = z.infer<typeof gameAgentPatchSchema>;
