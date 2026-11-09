import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { getVipPromotion, toPromotionView, updateVipPromotion } from "@/lib/payments/promotions";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const targetSchema = z.object({
  targetType: z.enum(["server", "bundle"]), targetId: z.string().min(1).max(64),
  pricingByPlan: z.object({
    "1_month": z.number().int().positive().max(10_000_000).optional(),
    "3_months": z.number().int().positive().max(10_000_000).optional(),
    "6_months": z.number().int().positive().max(10_000_000).optional(),
    "1_year": z.number().int().positive().max(10_000_000).optional(),
  }).refine((prices) => Object.values(prices).some((price) => price !== undefined), "Set at least one promotional duration."),
});
const zonedDate = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value),
  "Enter a valid date and timezone offset.",
);
const schema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  startsAt: zonedDate.optional(),
  endsAt: zonedDate.optional(),
  targets: z.array(targetSchema).min(1).max(100).optional(),
});

export async function GET(_request: Request, context: Context): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const promotion = await getVipPromotion(id);
  return promotion ? jsonOk(toPromotionView(promotion)) : jsonError("Promotion not found.", 404);
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON body.", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return jsonError(parsed.success ? "Provide fields to update." : parsed.error.issues[0]?.message ?? "Invalid promotion.", 400);
  }
  const before = await getVipPromotion(id);
  if (!before) return jsonError("Promotion not found.", 404);
  const patch: Parameters<typeof updateVipPromotion>[1] = {
    name: parsed.data.name,
    description: parsed.data.description,
    enabled: parsed.data.enabled,
    targets: parsed.data.targets,
    ...(parsed.data.startsAt ? { startsAt: new Date(parsed.data.startsAt) } : {}),
    ...(parsed.data.endsAt ? { endsAt: new Date(parsed.data.endsAt) } : {}),
  };
  try {
    const promotion = await updateVipPromotion(id, patch, auth.user.steamId);
    if (!promotion) return jsonError("Promotion not found.", 404);
    await recordAuditLog({
      adminId: auth.user.id, adminSteamId: auth.user.steamId,
      action: parsed.data.enabled === undefined ? "UPDATE_VIP_PROMOTION" : "SET_VIP_PROMOTION_ENABLED",
      targetUserId: null, targetSteamId: null, targetPersonaName: null,
      oldValue: { enabled: before.enabled, name: before.name, startsAt: before.startsAt, endsAt: before.endsAt, targets: before.targets },
      newValue: { enabled: promotion.enabled, name: promotion.name, startsAt: promotion.startsAt, endsAt: promotion.endsAt, targets: promotion.targets },
      timestamp: new Date(),
    });
    return jsonOk(toPromotionView(promotion));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update promotion.";
    return jsonError(message, message.includes("overlaps") || message.includes("Another promotion") ? 409 : 400);
  }
}
