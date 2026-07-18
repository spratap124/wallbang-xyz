import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getAuditLogs } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  const logs = await getAuditLogs({ limit });
  return jsonOk(logs);
}
