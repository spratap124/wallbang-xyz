import { jsonOk } from "@/lib/permissions/authz";
import { getLaunchGiveawayStatus } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonOk({
      maxWinners: 100,
      claimed: 0,
      remaining: 100,
      vipMonths: 3,
    });
  }

  const status = await getLaunchGiveawayStatus();
  return jsonOk(status);
}
