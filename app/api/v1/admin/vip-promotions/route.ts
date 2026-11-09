import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import { getVipShopCatalog } from "@/lib/payments/vip-pricing";
import {
  createVipPromotion,
  listVipPromotions,
} from "@/lib/payments/promotions";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { getGameServers } from "@/lib/servers/registry";
import { VIP_PLAN_IDS } from "@/types/vip";

export const runtime = "nodejs";

const pricesSchema = z.object({
  "1_month": z.number().int().positive().max(10_000_000).optional(),
  "3_months": z.number().int().positive().max(10_000_000).optional(),
  "6_months": z.number().int().positive().max(10_000_000).optional(),
  "1_year": z.number().int().positive().max(10_000_000).optional(),
}).refine((prices) => Object.values(prices).some((price) => price !== undefined), "Set at least one promotional duration.");
const targetSchema = z.object({
  targetType: z.enum(["server", "bundle"]),
  targetId: z.string().trim().min(1).max(64),
  pricingByPlan: pricesSchema,
});
const zonedDate = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value),
  "Enter a valid date and timezone offset.",
);
const schema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  startsAt: zonedDate,
  endsAt: zonedDate,
  targets: z.array(targetSchema).min(1).max(100),
});

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;
  const [promotions, servers, bundles] = await Promise.all([
    listVipPromotions(), getGameServers({ includeDisabled: true }), listVipBundleDocs(),
  ]);
  const catalog = getVipShopCatalog(servers, { bundles });
  return jsonOk({
    promotions,
    targets: [
      ...catalog.servers.map((server) => ({
        targetType: "server" as const, id: server.id, name: server.shortName,
        enabled: servers.find((row) => row.id === server.id)?.enabled ?? true,
        pricingByPlan: Object.fromEntries(server.durationOptions.map((row) => [row.id, row.amountPaise])),
      })),
      ...catalog.bundles.map((bundle) => ({
        targetType: "bundle" as const, id: bundle.id, name: bundle.name, enabled: true,
        pricingByPlan: Object.fromEntries(bundle.durations.map((row) => [row.id, row.amountPaise])),
      })),
    ],
    planIds: VIP_PLAN_IDS,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON body.", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid promotion.", 400, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  try {
    const promotion = await createVipPromotion({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      enabled: parsed.data.enabled ?? true,
      startsAt,
      endsAt,
      targets: parsed.data.targets,
      createdBy: auth.user.steamId,
      updatedBy: auth.user.steamId,
    });
    await recordAuditLog({
      adminId: auth.user.id, adminSteamId: auth.user.steamId,
      action: "CREATE_VIP_PROMOTION", targetUserId: null, targetSteamId: null,
      targetPersonaName: null, oldValue: null,
      newValue: { promotionId: promotion.id, name: promotion.name, startsAt, endsAt, targets: promotion.targets },
      timestamp: new Date(),
    });
    return jsonOk(promotion, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create promotion.";
    return jsonError(message, message.includes("overlaps") || message.includes("Another promotion") ? 409 : 400);
  }
}
