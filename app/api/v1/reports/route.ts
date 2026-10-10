import { z } from "zod";

import {
  jsonError,
  jsonOk,
  requirePermission,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { createReport, isValidSteamId64, listReports } from "@/lib/moderation/service";
import { getGameServerById } from "@/lib/servers/registry";
import { rateLimit } from "@/lib/rate-limit";
import { REPORT_STATUSES } from "@/types/moderation";

const schema = z.object({
  reporterSteamId: z.string(),
  targetSteamId: z.string(),
  serverId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;
  const limited = rateLimit(
    `report:${request.headers.get("x-forwarded-for") ?? "unknown"}`,
    20,
    60_000,
  );
  if (!limited.ok) return jsonError("Too many reports. Try again shortly.", 429);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return jsonError(
      "Invalid report body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  try {
    // The current plugin contract has one shared PLUGIN_API_KEY. Requiring a
    // matching server identity and an enabled registry row prevents arbitrary
    // server IDs; per-server credential rotation remains a future backwards-
    // compatible migration because existing plugins only know the shared key.
    if (request.headers.get("x-server-id") !== parsed.data.serverId) {
      return jsonError("Server identity is required.", 401);
    }
    const server = await getGameServerById(parsed.data.serverId, {
      includeDisabled: false,
    });
    if (!server) return jsonError("Unknown or inactive server.", 400);
    const result = await createReport(parsed.data);
    if (!result.duplicate) {
      await recordAuditLog({
        adminId: null,
        adminSteamId: null,
        action: "RECEIVE_REPORT",
        targetUserId: null,
        targetSteamId: parsed.data.targetSteamId,
        targetPersonaName: null,
        oldValue: null,
        newValue: { reportId: result.report._id, serverId: parsed.data.serverId },
        timestamp: new Date(),
      });
    }
    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to receive report.",
      400,
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("review_reports");
  if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const targetSteamId = params.get("targetSteamId")?.trim();
  if (targetSteamId && !isValidSteamId64(targetSteamId))
    return jsonError("Invalid SteamID64.", 400);
  if (status && !(REPORT_STATUSES as readonly string[]).includes(status))
    return jsonError("Invalid report status.", 400);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
  return jsonOk(
    await listReports({
      status: status as "open" | "assigned" | "resolved" | "dismissed" | undefined,
      targetSteamId,
      limit,
    }),
  );
}
