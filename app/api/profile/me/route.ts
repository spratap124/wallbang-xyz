import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { getMyProfile } from "@/lib/profile";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const profile = await getMyProfile(auth.user);
  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  return jsonOk(profile);
}

/** Soft probe: returns null when logged out (for client shells). */
export async function HEAD(): Promise<Response> {
  const user = await getSession();
  return new Response(null, { status: user ? 200 : 401 });
}
