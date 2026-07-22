import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getAdminHealth } from "@/lib/admin/health";
import { isMongoConfigured } from "@/lib/mongo";

export const runtime = "nodejs";

/**
 * Composite health for admin status widgets.
 * GET /api/v1/admin/health
 */
export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const data = await getAdminHealth();
  return jsonOk(data);
}
