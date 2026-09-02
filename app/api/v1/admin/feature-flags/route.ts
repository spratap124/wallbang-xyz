import { z } from "zod";

import { writableFeatureFlags } from "@/config/features.flags";
import {
  getRuntimeFeatureFlags,
  setRuntimeFeatureFlag,
} from "@/lib/platform/feature-flags";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";

const patchSchema = z
  .object({
    vipPage: z.boolean().optional(),
    vipAllRetakes: z.boolean().optional(),
    vipCheckout: z.boolean().optional(),
    loadoutPage: z.boolean().optional(),
    featuresPage: z.boolean().optional(),
    profilePage: z.boolean().optional(),
    settingsPage: z.boolean().optional(),
  })
  .refine(
    (value) => writableFeatureFlags.some((key) => value[key] !== undefined),
    { message: "Provide at least one feature flag to update." },
  );

export async function GET(): Promise<Response> {
  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const flags = await getRuntimeFeatureFlags();
  return jsonOk(flags);
}

export async function PATCH(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400,
    );
  }

  try {
    for (const key of writableFeatureFlags) {
      const value = parsed.data[key];
      if (value !== undefined) {
        await setRuntimeFeatureFlag(key, value, auth.user.steamId);
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update feature flags.";
    return jsonError(message, 500);
  }

  const flags = await getRuntimeFeatureFlags();
  return jsonOk(flags);
}
