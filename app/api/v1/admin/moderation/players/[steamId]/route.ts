import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { isMongoConfigured } from "@/lib/mongo";
import { getActiveBan, isValidSteamId64, listBans } from "@/lib/moderation/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ steamId: string }> },
): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("moderation_access");
  if ("response" in auth) return auth.response;
  const { steamId } = await context.params;
  if (!isValidSteamId64(steamId)) return jsonError("Invalid SteamID64.", 400);
  return jsonOk({
    active: await getActiveBan(steamId),
    history: await listBans({ steamId, limit: 200 }),
  });
}
