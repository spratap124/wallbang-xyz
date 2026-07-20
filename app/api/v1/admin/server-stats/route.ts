import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  getServerConnectionStats,
  isServerStatsRange,
} from "@/lib/profile/sessions";
import { getGameServers } from "@/lib/servers/registry";

export const runtime = "nodejs";

/**
 * Admin-only connection stats.
 * GET /api/v1/admin/server-stats?serverId=retake-1&range=1d|7d|30d|all
 */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const fleet = await getGameServers({ includeDisabled: true });
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId") ?? fleet[0]?.id ?? "";
  const rangeRaw = searchParams.get("range") ?? "7d";

  if (!fleet.some((s) => s.id === serverId)) {
    return jsonError("Unknown serverId.", 400);
  }
  if (!isServerStatsRange(rangeRaw)) {
    return jsonError("Invalid range. Use 1d, 7d, 30d, or all.", 400);
  }

  const stats = await getServerConnectionStats({
    serverId,
    range: rangeRaw,
  });
  if (!stats) {
    return jsonError("Server not found.", 404);
  }

  return jsonOk(stats);
}
