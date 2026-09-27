import { jsonOk } from "@/lib/permissions/authz";
import {
  getLaunchGiveawayMaxWinners,
  getLaunchGiveawayStatus,
} from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    const maxWinners = getLaunchGiveawayMaxWinners();
    return jsonOk({
      maxWinners,
      claimed: 0,
      remaining: maxWinners,
      vipMonths: 3,
    });
  }

  const status = await getLaunchGiveawayStatus();
  return jsonOk(status);
}
