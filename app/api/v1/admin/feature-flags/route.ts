import { z } from "zod";

import {
  getRuntimeFeatureFlags,
  setVipAllRetakesEnabled,
  setVipCheckoutEnabled,
  setVipPageEnabled,
} from "@/lib/platform/feature-flags";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";

const patchSchema = z
  .object({
    vipPage: z.boolean().optional(),
    vipAllRetakes: z.boolean().optional(),
    vipCheckout: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.vipPage !== undefined ||
      value.vipAllRetakes !== undefined ||
      value.vipCheckout !== undefined,
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
    if (parsed.data.vipPage !== undefined) {
      await setVipPageEnabled(parsed.data.vipPage, auth.user.steamId);
    }
    if (parsed.data.vipAllRetakes !== undefined) {
      await setVipAllRetakesEnabled(
        parsed.data.vipAllRetakes,
        auth.user.steamId,
      );
    }
    if (parsed.data.vipCheckout !== undefined) {
      await setVipCheckoutEnabled(parsed.data.vipCheckout, auth.user.steamId);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update feature flags.";
    return jsonError(message, 500);
  }

  const flags = await getRuntimeFeatureFlags();
  return jsonOk(flags);
}
