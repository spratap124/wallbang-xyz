import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  getUserPermissions,
  listUsers,
  searchUsers,
} from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const steamId = searchParams.get("steamId")?.trim();
  const limitRaw = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;

  if (steamId) {
    const resolved = await getUserPermissions({ steamId });
    if (!resolved) {
      return jsonError("User not found.", 404);
    }
    return jsonOk(resolved);
  }

  if (!q) {
    const users = await listUsers(limit);
    return jsonOk(users);
  }

  const users = await searchUsers(q);
  return jsonOk(users);
}
