import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import {
  getPlayerActivity,
  getPlayerProfile,
  isValidSteamId64,
} from "@/lib/profile";

type RouteContext = { params: Promise<{ steamId: string }> };

export async function GET(
  request: Request,
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

  if (!profile.isOwner && profile.privacy.activity !== "public") {
    return jsonError("Activity is private.", 403);
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 50)
    : 20;

  const activity = await getPlayerActivity(steamId, limit);
  return jsonOk(
    activity.map((item) => ({
      id: item._id,
      type: item.type,
      title: item.title,
      description: item.description,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    })),
  );
}
