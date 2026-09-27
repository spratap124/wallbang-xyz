import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { getPaymentOrderStatusForUser } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

/** Reads webhook-written payment status. Does not grant or fail VIP. */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) {
    return jsonError("Missing orderId.", 400);
  }

  const status = await getPaymentOrderStatusForUser({
    userId: auth.user.id,
    orderId,
  });
  if (!status) {
    return jsonError("Order not found.", 404);
  }

  return jsonOk(status);
}
