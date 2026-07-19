import { z } from "zod";

import { PRIVACY_LEVELS } from "@/types/profile";

const privacyLevel = z.enum(PRIVACY_LEVELS);

export const patchProfileSchema = z
  .object({
    displayName: z.string().trim().max(64).nullable().optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Za-z]{2}$/)
      .nullable()
      .optional(),
    preferredSide: z.enum(["T", "CT"]).nullable().optional(),
    favoriteWeapon: z.string().trim().max(64).nullable().optional(),
    favoriteMap: z.string().trim().max(64).nullable().optional(),
    privacy: z
      .object({
        stats: privacyLevel.optional(),
        matchHistory: privacyLevel.optional(),
        steamInventory: privacyLevel.optional(),
        activity: privacyLevel.optional(),
      })
      .optional(),
    theme: z.enum(["dark", "system"]).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .strict();

export type PatchProfileSchema = z.infer<typeof patchProfileSchema>;
