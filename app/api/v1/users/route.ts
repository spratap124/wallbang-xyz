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
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "25");
  const page = Number.isFinite(pageRaw) ? Math.max(Math.floor(pageRaw), 1) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(Math.floor(pageSizeRaw), 1), 100)
    : 25;

  if (steamId) {
    const resolved = await getUserPermissions({ steamId });
    if (!resolved) {
      return jsonError("User not found.", 404);
    }
    return jsonOk(resolved);
  }

  if (!q) {
    const result = await listUsers({ skip: (page - 1) * pageSize, limit: pageSize });
    return jsonOk({ items: result.users, page, pageSize, hasMore: result.hasMore });
  }

  const result = await searchUsers(q, { skip: (page - 1) * pageSize, limit: pageSize });
  return jsonOk({ items: result.users, page, pageSize, hasMore: result.hasMore });
}
