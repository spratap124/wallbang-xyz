import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getAdminRevenueAnalytics } from "@/lib/payments/revenue-analytics";

export const runtime = "nodejs";

/** Admin-only revenue summary, kept separate from the heavier fleet analytics. */
export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  try {
    return jsonOk(await getAdminRevenueAnalytics());
  } catch (error) {
    console.error("[admin-revenue] failed to load revenue analytics", error);
    return jsonError("Revenue data could not be loaded.", 500);
  }
}
