import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { RatingError, ratingService } from "@/lib/rating/RatingService";
import { matchResultSchema } from "@/lib/rating/schemas";

export const runtime = "nodejs";

/**
 * POST /api/matches
 *
 * @deprecated Prefer POST /api/rounds for public retakes.
 * Kept for future ranked mode (team Elo over a full match).
 *
 * Auth: X-API-Key
 * Body: { serverId, map, winner, players: [{ steamId, side, name?, avatar? }] }
 * Response data: { updatedPlayers: [...] }
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = matchResultSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const result = await ratingService.updateRatings(parsed.data);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof RatingError) {
      return jsonError(err.message, err.status);
    }
    throw err;
  }
}
