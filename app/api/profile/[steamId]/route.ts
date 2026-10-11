import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import {
  canViewSteamId,
  getPlayerProfile,
  isValidSteamId64,
  toAnonymousPublicProfile,
  toPublicPlayerProfile,
} from "@/lib/profile";
import { hasPermission } from "@/lib/permissions/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ steamId: string }> };

/**
 * Public player profile.
 *
 * Anonymous visitors receive an explicit allowlisted projection
 * (`toPublicPlayerProfile`) — never the raw aggregate view, and never the
 * underlying user document. The profile owner keeps the richer view so
 * account-level features keep working. SteamID64 is withheld from everyone
 * except the owner and admins.
 */
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
  const profile = await getPlayerProfile(steamId, viewer);
  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  const isOwner = viewer?.steamId === steamId;
  const isAdmin = viewer
    ? await hasPermission({ userId: viewer.id, permission: "admin_panel" })
    : false;

  let payload: unknown = profile;
  if (!isOwner) {
    const publicProfile = toPublicPlayerProfile(profile);
    payload =
      publicProfile && canViewSteamId({ isOwner, isAdmin })
        ? publicProfile
        : publicProfile && toAnonymousPublicProfile(publicProfile);
  }

  const response = jsonOk(payload);

  // Only the public payload is safe to share-cache.
  if (isOwner) {
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }

  return response;
}
