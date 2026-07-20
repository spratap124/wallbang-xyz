import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import {
  getPlayerLoadout,
  savePlayerLoadout,
} from "@/lib/loadout/service";
import { putLoadoutSchema } from "@/lib/validations/loadout";

export const runtime = "nodejs";

/** GET /api/loadout — current user's saved loadout (session). */
export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const data = await getPlayerLoadout(auth.user.steamId);
  return jsonOk(data);
}

/** PUT /api/loadout — upsert full loadout for the signed-in player. */
export async function PUT(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = putLoadoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Validation failed.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const data = await savePlayerLoadout(auth.user, parsed.data);
  return jsonOk(data);
}
