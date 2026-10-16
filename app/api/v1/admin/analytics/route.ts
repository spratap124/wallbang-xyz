import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getFleetConnectionStats } from "@/lib/profile/sessions";
import { overviewIstPeriod } from "@/lib/profile/overview-analytics";
import type { AdminAnalyticsRange } from "@/types/profile";

export const runtime = "nodejs";

const RANGES = new Set<AdminAnalyticsRange>(["1d", "7d", "30d", "90d", "custom"]);

/** Admin-only analytics endpoint. Custom start/end are inclusive IST dates. */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const rangeValue = searchParams.get("range") ?? "7d";
  if (!RANGES.has(rangeValue as AdminAnalyticsRange)) {
    return jsonError("Invalid range. Use 1d, 7d, 30d, 90d, or custom.", 400);
  }
  const range = rangeValue as AdminAnalyticsRange;
  const customStart = searchParams.get("start") ?? undefined;
  const customEnd = searchParams.get("end") ?? undefined;
  try {
    overviewIstPeriod(range, customStart, customEnd);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid analytics range.",
      400,
    );
  }

  const data = await getFleetConnectionStats({ range, customStart, customEnd });
  return jsonOk(data);
}
