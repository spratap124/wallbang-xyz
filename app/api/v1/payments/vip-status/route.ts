import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requireSession } from "@/lib/permissions/authz";
import { getVipAccessStatus } from "@/lib/payments/service";
import { isPaymentConfigured, getActivePaymentProvider } from "@/lib/payments/provider";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const status = await getVipAccessStatus(auth.user.id);
  return jsonOk({
    purchasesEnabled: isPaymentConfigured(),
    paymentProvider: getActivePaymentProvider(),
    isVip: status.isVip,
    lifetime: status.lifetime,
    expiresAt: status.expiresAt?.toISOString() ?? null,
    source: status.source,
  });
}
