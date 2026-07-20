import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import {
  clearPlayerPresence,
  clearServerPresence,
  upsertPlayerPresence,
} from "@/lib/profile/presence";
import { getGameServers } from "@/lib/servers/registry";

export const runtime = "nodejs";

const heartbeatSchema = z.object({
  action: z.enum(["heartbeat", "leave", "clear_server"]).default("heartbeat"),
  steamId: z.string().regex(/^\d{17}$/).optional(),
  steamIds: z.array(z.string().regex(/^\d{17}$/)).max(64).optional(),
  serverId: z.string().min(1).max(64),
  serverName: z.string().trim().max(128).optional(),
  map: z.string().trim().max(64).nullable().optional(),
});

/**
 * CS2 plugin → web presence ingest.
 *
 * POST body examples:
 *   { action: "heartbeat", steamId, serverId, map? }
 *   { action: "heartbeat", steamIds: [...], serverId }
 *   { action: "leave", steamId, serverId }
 *   { action: "clear_server", serverId }
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = heartbeatSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const data = parsed.data;
  const fleet = await getGameServers();
  const knownServer = fleet.some((s) => s.id === data.serverId);
  if (!knownServer) {
    return jsonError("Unknown serverId.", 400);
  }

  if (data.action === "clear_server") {
    await clearServerPresence(data.serverId);
    return jsonOk({ cleared: true, serverId: data.serverId });
  }

  const ids = [
    ...(data.steamId ? [data.steamId] : []),
    ...(data.steamIds ?? []),
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  if (ids.length === 0) {
    return jsonError("steamId or steamIds is required.", 400);
  }

  if (data.action === "leave") {
    await Promise.all(
      ids.map((id) => clearPlayerPresence(id, data.serverId)),
    );
    return jsonOk({ left: ids.length });
  }

  const results = await Promise.all(
    ids.map((steamId) =>
      upsertPlayerPresence({
        steamId,
        serverId: data.serverId,
        serverName: data.serverName,
        map: data.map,
      }),
    ),
  );

  return jsonOk({
    updated: results.length,
    presence: results.map((p) => ({
      steamId: p.steamId,
      serverId: p.serverId,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

/** Health probe for plugin config checks. */
export async function GET(request: Request): Promise<Response> {
  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }
  const fleet = await getGameServers();
  return jsonOk({
    ok: true,
    servers: fleet.map((s) => s.id),
  });
}
