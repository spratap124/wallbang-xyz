import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { getDiscordRoleSyncTargets } from "@/lib/discord/role-sync";

/** Internal bot endpoint. Returns Discord IDs only, never SteamIDs. */
export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  try {
    return jsonOk(await getDiscordRoleSyncTargets());
  } catch (err) {
    console.error("[discord-role-sync] Failed to load role targets", err);
    return jsonError("Could not load Discord role targets.", 500);
  }
}
