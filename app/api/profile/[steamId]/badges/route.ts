import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import { getPlayerBadges, isValidSteamId64 } from "@/lib/profile";
import { findUserBySteamId } from "@/lib/auth/users";

type RouteContext = { params: Promise<{ steamId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const { steamId } = await context.params;
  if (!isValidSteamId64(steamId)) {
    return jsonError("Invalid SteamID64.", 400);
  }

  const user = await findUserBySteamId(steamId);
  if (!user) {
    return jsonError("Profile not found.", 404);
  }

  const badges = await getPlayerBadges(steamId);
  return jsonOk(badges);
}
