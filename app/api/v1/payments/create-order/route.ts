import { z } from "zod";

import { isVipPlanId } from "@/lib/payments/quote";
import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { createVipOrder } from "@/lib/payments/service";

const bodySchema = z.object({
  planId: z.string().min(1),
  serverIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }
  if (!isRazorpayConfigured()) {
    return jsonError("VIP purchases are not available yet.", 503);
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
    return jsonError("Invalid request body.", 400);
  }

  if (!isVipPlanId(parsed.data.planId)) {
    return jsonError("Unknown VIP duration.", 400);
  }

  try {
    const order = await createVipOrder({
      userId: auth.user.id,
      steamId: auth.user.steamId,
      personaName: auth.user.personaName,
      planId: parsed.data.planId,
      serverIds: parsed.data.serverIds,
    });
    return jsonOk({
      ...order,
      prefill: { name: auth.user.personaName },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to start checkout.";
    const status = message.includes("Too many") ? 429 : 400;
    return jsonError(message, status);
  }
}
