import { jsonOk } from "@/lib/permissions/authz";
import {
  getLaunchGiveawayMaxWinners,
  getLaunchGiveawayStatus,
  isLaunchGiveawayClosed,
} from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    const maxWinners = getLaunchGiveawayMaxWinners();
    return jsonOk({
      maxWinners,
      claimed: isLaunchGiveawayClosed() ? maxWinners : 0,
      remaining: isLaunchGiveawayClosed() ? 0 : maxWinners,
      vipMonths: 3,
    });
  }

  const status = await getLaunchGiveawayStatus();
  return jsonOk(status);
}
