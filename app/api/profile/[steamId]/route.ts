import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import {
  canViewSteamId,
  getPlayerProfile,
  isStaffViewer,
  isValidSteamId64,
  loadPlayerProfilePage,
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
 * except the owner and staff. Players with no WallBang account are returned
 * only to staff, and never share-cached.
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
    // No WallBang account: staff-only limited profile from game data.
    const [isAdmin, isModerator] = viewer
      ? await Promise.all([
          hasPermission({ userId: viewer.id, permission: "admin_panel" }),
          hasPermission({ userId: viewer.id, permission: "moderation_access" }),
        ])
      : [false, false];
    if (!isStaffViewer({ isAdmin, isModerator })) {
      return jsonError("Profile not found.", 404);
    }

    const page = await loadPlayerProfilePage({ steamId, viewer });
    if (!page) return jsonError("Profile not found.", 404);

    const staffResponse = jsonOk(page.profile);
    staffResponse.headers.set("Cache-Control", "private, no-store");
    return staffResponse;
  }

  const isOwner = viewer?.steamId === steamId;
  const isAdmin = viewer
    ? await hasPermission({ userId: viewer.id, permission: "admin_panel" })
    : false;
  const isModerator = viewer
    ? await hasPermission({ userId: viewer.id, permission: "moderation_access" })
    : false;

  let payload: unknown = profile;
  if (!isOwner) {
    const publicProfile = toPublicPlayerProfile(profile);
    payload =
      publicProfile && canViewSteamId({ isOwner, isAdmin, isModerator })
        ? publicProfile
        : publicProfile && toAnonymousPublicProfile(publicProfile);
  }

  const response = jsonOk(payload);

  // Only the public payload is safe to share-cache.
  if (isOwner || canViewSteamId({ isOwner, isAdmin, isModerator })) {
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }

  return response;
}
