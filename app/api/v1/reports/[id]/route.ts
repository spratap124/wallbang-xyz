import { z } from "zod";

import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { updateReport } from "@/lib/moderation/service";

const schema = z.object({
  status: z.enum(["open", "assigned", "resolved", "dismissed"]).optional(),
  assignedTo: z.string().trim().nullable().optional(),
  resolution: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("review_reports");
  if ("response" in auth) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return jsonError(
      "Invalid report update.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  const { id } = await context.params;
  const report = await updateReport({ ...parsed.data, id, actorId: auth.user.id });
  if (!report) return jsonError("Report not found.", 404);
  await recordAuditLog({
    adminId: auth.user.id,
    adminSteamId: auth.user.steamId,
    action: parsed.data.assignedTo !== undefined ? "ASSIGN_REPORT" : "REVIEW_REPORT",
    targetUserId: null,
    targetSteamId: report.targetSteamId,
    targetPersonaName: null,
    oldValue: null,
    newValue: {
      reportId: report._id,
      status: report.status,
      assignedTo: report.assignedTo,
      resolution: report.resolution,
    },
    timestamp: new Date(),
  });
  return jsonOk({
    ...report,
    assignedAt: report.assignedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  });
}
