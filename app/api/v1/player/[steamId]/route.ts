import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { getPlayerPermissions } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

type RouteContext = {
  params: Promise<{ steamId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  const { steamId } = await context.params;
  if (!/^\d{17}$/.test(steamId)) {
    return jsonError("Invalid SteamID64.", 400);
  }

  const data = await getPlayerPermissions(steamId);
  return jsonOk(data);
}
