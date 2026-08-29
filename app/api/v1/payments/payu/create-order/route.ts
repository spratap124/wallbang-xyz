import { z } from "zod";

import { isVipPlanId } from "@/lib/payments/quote";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { isPayuConfigured } from "@/lib/payments/payu";
import { createPayuVipOrder } from "@/lib/payments/payu-service";
import { isPayuActive } from "@/lib/payments/provider";
import {
  isVipAllRetakesEnabled,
  isVipCheckoutEnabled,
  isVipPageEnabled,
} from "@/lib/platform/feature-flags";

const accessTypeSchema = z.enum(["INDIVIDUAL_SERVER", "ALL_RETAKES"]);

const bodySchema = z
  .object({
    accessType: accessTypeSchema,
    planId: z.string().min(1),
    serverId: z.string().min(1).optional(),
    serverIds: z.array(z.string().min(1)).optional(),
    email: z.string().trim().email("Enter a valid email."),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
    amount: z.number().optional(),
    price: z.number().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.serverIds && value.serverIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Multiple servers are not supported.",
        path: ["serverIds"],
      });
    }

    if (value.accessType === "INDIVIDUAL_SERVER" && !value.serverId) {
      ctx.addIssue({
        code: "custom",
        message: "Select a server.",
        path: ["serverId"],
      });
    }

    if (value.accessType === "ALL_RETAKES" && value.serverId) {
      ctx.addIssue({
        code: "custom",
        message: "All Retakes purchases must not include a server.",
        path: ["serverId"],
      });
    }
  });

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }
  if (!isPayuConfigured() || !isPayuActive()) {
    return jsonError("VIP purchases are not available yet.", 503);
  }
  if (!(await isVipPageEnabled()) || !(await isVipCheckoutEnabled())) {
    return jsonError("VIP checkout is not available yet.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid request body.";
    return jsonError(message, 400);
  }

  if (!isVipPlanId(parsed.data.planId)) {
    return jsonError("Unknown VIP duration.", 400);
  }

  if (
    parsed.data.accessType === "ALL_RETAKES" &&
    !(await isVipAllRetakesEnabled())
  ) {
    return jsonError("All Retakes purchases are not available yet.", 400);
  }

  try {
    const order = await createPayuVipOrder({
      userId: auth.user.id,
      steamId: auth.user.steamId,
      personaName: auth.user.personaName,
      accessType: parsed.data.accessType,
      planId: parsed.data.planId,
      serverId: parsed.data.serverId ?? null,
      email: parsed.data.email,
      phone: parsed.data.phone,
    });
    return jsonOk(order);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to start checkout.";
    const status = message.includes("Too many") ? 429 : 400;
    return jsonError(message, status);
  }
}
