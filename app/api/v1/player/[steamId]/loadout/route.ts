import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { CatalogNotFoundError } from "@/lib/loadout/catalog";
import { patchPlayerLoadoutFromGame } from "@/lib/loadout/service";
import { isMongoConfigured } from "@/lib/mongo";
import { patchGameLoadoutSchema } from "@/lib/validations/game-loadout";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ steamId: string }>;
};

/**
 * CS2 plugin loadout sync — persist in-game !skins / !knife / !gloves / agent picks.
 *
 * PATCH /api/v1/player/:steamId/loadout
 * Headers: X-API-Key (same as other plugin routes)
 *
 * Body (all fields optional; at least one required):
 * {
 *   "weapons": { "ak47": { "paintKit": 302, "wear": 0.12, "statTrak": true } },
 *   "knife": { "knifeId": "karambit", "paintKit": 38 },
 *   "gloves": { "gloveId": "sport_gloves", "paintKit": 10006 },
 *   "agentCT": { "agentId": "agent_jamison", "faction": "CT" },
 *   "agentT": null
 * }
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  const { steamId } = await context.params;
  if (!/^\d{17}$/.test(steamId)) {
    return jsonError("Invalid SteamID64.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = patchGameLoadoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Validation failed.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const data = await patchPlayerLoadoutFromGame(steamId, parsed.data);
    return jsonOk(data);
  } catch (err) {
    if (err instanceof CatalogNotFoundError) {
      return jsonError(err.message, 404);
    }
    const message =
      err instanceof Error ? err.message : "Failed to update loadout.";
    return jsonError(message, 400);
  }
}
