import { z } from "zod";

import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
  requirePermission,
} from "@/lib/permissions/authz";
import { isMongoConfigured } from "@/lib/mongo";
import { getActiveBan, isValidSteamId64 } from "@/lib/moderation/service";

const schema = z.object({
  steamId: z.string(),
  serverId: z.string().trim().min(1).max(64),
});

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = await requirePermission("moderation_access");
  if ("response" in auth) return auth.response;
  const steamId = new URL(request.url).searchParams.get("steamId")?.trim() ?? "";
  if (!isValidSteamId64(steamId)) return jsonError("Invalid SteamID64.", 400);
  const ban = await getActiveBan(steamId);
  return jsonOk({ banned: Boolean(ban), ban });
}

export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) return jsonError("Database is not configured.", 503);
  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success || !isValidSteamId64(parsed.data.steamId))
    return jsonError("Invalid SteamID64.", 400);
  if (request.headers.get("x-server-id") !== parsed.data.serverId)
    return jsonError("Server identity is required.", 401);
  const { getGameServerById } = await import("@/lib/servers/registry");
  if (!(await getGameServerById(parsed.data.serverId, { includeDisabled: false })))
    return jsonError("Unknown or inactive server.", 400);
  const ban = await getActiveBan(parsed.data.steamId);
  return jsonOk({
    steamId: parsed.data.steamId,
    banned: Boolean(ban),
    expiresAt: ban?.expiresAt ?? null,
    permanent: ban?.permanent ?? false,
  });
}
