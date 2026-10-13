import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { recordAuditLog } from "@/lib/permissions/service";
import {
  createVipBundle,
  isValidVipBundleId,
  listVipBundleViews,
} from "@/lib/payments/bundles";

export const runtime = "nodejs";

const pricingSchema = z.object({
  "1_month": z.number().int().positive().max(10_000_000),
  "3_months": z.number().int().positive().max(10_000_000),
  "6_months": z.number().int().positive().max(10_000_000),
  "1_year": z.number().int().positive().max(10_000_000),
});

const createSchema = z.object({
  id: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(500).nullable().optional(),
  serverIds: z.array(z.string().trim().min(1)).min(1).max(50),
  pricingByPlan: pricingSchema,
  enabled: z.boolean().optional(),
  featured: z.boolean().optional(),
});

/** List VIP bundles (admin). Readable with manage_servers. */
export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  return jsonOk(await listVipBundleViews());
}

/** Create a VIP bundle. */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }
  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  if (!isValidVipBundleId(parsed.data.id)) {
    return jsonError("Bundle id must be lowercase letters, numbers, and hyphens.", 400);
  }

  try {
    const bundle = await createVipBundle(parsed.data);
    await recordAuditLog({
      adminId: auth.user.id,
      adminSteamId: auth.user.steamId,
      action: "CREATE_BUNDLE",
      targetUserId: null,
      targetSteamId: null,
      targetPersonaName: null,
      oldValue: null,
      newValue: {
        bundleId: bundle.id,
        name: bundle.name,
        serverIds: bundle.serverIds,
        pricingByPlan: bundle.pricingByPlan,
      },
      timestamp: new Date(),
    });
    return jsonOk(bundle, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create bundle.";
    return jsonError(message, message.includes("already exists") ? 409 : 400);
  }
}
