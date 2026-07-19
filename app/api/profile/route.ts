import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { patchPlayerProfile } from "@/lib/profile";
import { patchProfileSchema } from "@/lib/validations/profile";

export async function PATCH(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = patchProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Validation failed.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const profile = await patchPlayerProfile(auth.user, parsed.data);
  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  return jsonOk(profile);
}
