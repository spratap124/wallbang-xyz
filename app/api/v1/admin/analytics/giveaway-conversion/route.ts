import { isMongoConfigured } from "@/lib/mongo";
import { getGiveawayConversionAnalytics } from "@/lib/admin/giveaway-conversion-analytics";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  try {
    return jsonOk(await getGiveawayConversionAnalytics());
  } catch (error) {
    console.error("[admin-analytics] giveaway conversion query failed", error);
    return jsonError("Could not load VIP giveaway conversion analytics.", 500);
  }
}
