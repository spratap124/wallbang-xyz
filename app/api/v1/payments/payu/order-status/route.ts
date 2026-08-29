import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { getPayuOrderStatusForUser } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const txnid = new URL(request.url).searchParams.get("txnid")?.trim();
  if (!txnid) {
    return jsonError("Missing txnid.", 400);
  }

  const status = await getPayuOrderStatusForUser({
    userId: auth.user.id,
    txnid,
  });
  if (!status) {
    return jsonError("Order not found.", 404);
  }

  return jsonOk(status);
}
