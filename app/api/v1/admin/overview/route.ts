import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  getFleetConnectionStats,
  isServerStatsRange,
} from "@/lib/profile/sessions";

export const runtime = "nodejs";

/**
 * Fleet-wide overview for the admin dashboard.
 * GET /api/v1/admin/overview?range=1d|7d|30d|all
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
    return jsonError("Invalid range. Use 1d, 7d, 30d, or all.", 400);
  }

  const data = await getFleetConnectionStats({ range: rangeRaw });
  return jsonOk(data);
}
