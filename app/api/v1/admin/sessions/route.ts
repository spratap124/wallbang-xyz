import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  isServerStatsRange,
  listAdminSessions,
} from "@/lib/profile/sessions";
import { getGameServers } from "@/lib/servers/registry";

export const runtime = "nodejs";

/**
 * Cross-server session list for admin.
 * GET /api/v1/admin/sessions?range=7d&serverId=&active=1&limit=50
 */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const rangeRaw = searchParams.get("range") ?? "7d";
  if (!isServerStatsRange(rangeRaw)) {
    return jsonError("Invalid range. Use 1d, 7d, or 30d.", 400);
  }

  const serverId = searchParams.get("serverId")?.trim() || undefined;
  if (serverId) {
    const fleet = await getGameServers({ includeDisabled: true });
    if (!fleet.some((s) => s.id === serverId)) {
      return jsonError("Unknown serverId.", 400);
    }
  }

  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const activeOnly = searchParams.get("active") === "1";

  const sessions = await listAdminSessions({
    range: rangeRaw,
    serverId,
    activeOnly,
    limit,
  });

  return jsonOk(sessions);
}
