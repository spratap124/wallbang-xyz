import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import {
  RatingError,
  ratingService,
} from "@/lib/rating/RatingService";
import {
  RoundValidationError,
  roundValidator,
} from "@/lib/rating/schemas";

export const runtime = "nodejs";

/**
 * POST /api/rounds
 *
 * CS2 plugin → submit a finished round. Backend runs rating formula + history.
 * No round document is stored — only `players` + `rating_history`.
 * Auth: X-API-Key
 *
 * Body: { version?, serverId, map, winner, roundNumber?, players: [{ steamId, side, kills, … }] }
 * Response data: { updatedPlayers: [{ …, rankChanged, premier }] }
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

  let event;
  try {
    event = roundValidator.parse(json);
  } catch (err) {
    if (err instanceof RoundValidationError) {
      return jsonError(err.message, 400, err.fieldErrors);
    }
    throw err;
  }

  try {
    const result = await ratingService.processRound(event);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof RatingError) {
      return jsonError(err.message, err.status);
    }
    throw err;
  }
}
