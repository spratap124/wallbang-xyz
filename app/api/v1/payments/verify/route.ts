import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { verifyCheckoutSignature } from "@/lib/payments/razorpay";
import {
  fulfillCapturedPayment,
  getVipAccessStatus,
} from "@/lib/payments/service";
import { paymentsCollection } from "@/lib/payments/collections";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
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

  const valid = verifyCheckoutSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  if (!valid) {
    return jsonError("Invalid payment signature.", 400);
  }

  const payments = await paymentsCollection();
  const owned = await payments.findOne({
    razorpayOrderId: parsed.data.razorpay_order_id,
    userId: auth.user.id,
  });
  if (!owned) {
    return jsonError("Order not found.", 404);
  }

  try {
    const result = await fulfillCapturedPayment({
      razorpayOrderId: parsed.data.razorpay_order_id,
      razorpayPaymentId: parsed.data.razorpay_payment_id,
    });
    const status = await getVipAccessStatus(auth.user.id);
    return jsonOk({
      alreadyFulfilled: result?.alreadyFulfilled ?? false,
      vip: {
        isVip: status.isVip,
        lifetime: status.lifetime,
        expiresAt: status.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to confirm payment.";
    return jsonError(message, 500);
  }
}
