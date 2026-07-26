import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { ratingService } from "@/lib/rating/RatingService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ steamId: string }>;
};

/**
 * GET /api/players/:steamId/rating
 *
 * CS2 plugin → WallBang Rating for scoreboard.
 * Auth: X-API-Key
 *
 * Response data: { rating, rank, premier: { label, color, colorRgb } }
 * Missing players are created at 0 / Iron ("// 00000" gray).
 * Labels are always 5 digits: // 00000, // 00100, // 01500, // 15000, …
 */
export async function GET(
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

  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? undefined;
  const avatar = url.searchParams.get("avatar") ?? undefined;

  const data = await ratingService.getPlayerRating(steamId, { name, avatar });
  return jsonOk(data);
}
