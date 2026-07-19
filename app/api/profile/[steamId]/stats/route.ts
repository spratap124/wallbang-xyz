import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import {
  getPlayerProfile,
  getPlayerStats,
  isValidSteamId64,
} from "@/lib/profile";

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

  const viewer = await getSession();
  const profile = await getPlayerProfile(steamId, viewer, {
    incrementViews: false,
  });
  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  if (!profile.isOwner && profile.privacy.stats !== "public") {
    return jsonError("Stats are private.", 403);
  }

  const stats = await getPlayerStats(steamId);
  return jsonOk(stats);
}
