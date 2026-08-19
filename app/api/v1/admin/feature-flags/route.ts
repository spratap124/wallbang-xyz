import { z } from "zod";

import { featureFlags as staticFeatureFlags } from "@/config/features.flags";
import {
  getRuntimeFeatureFlags,
  setVipAllRetakesEnabled,
} from "@/lib/platform/feature-flags";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";

const patchSchema = z.object({
  vipAllRetakes: z.boolean(),
});

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
    return jsonError("Invalid request body.", 400);
  }

  try {
    await setVipAllRetakesEnabled(parsed.data.vipAllRetakes, auth.user.steamId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update feature flags.";
    return jsonError(message, 500);
  }

  const flags = await getRuntimeFeatureFlags();
  return jsonOk({
    ...staticFeatureFlags,
    vipAllRetakes: flags.vipAllRetakes,
  });
}
