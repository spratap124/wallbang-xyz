import { isMongoConfigured } from "@/lib/mongo";
import {
  MatchIngestError,
  matchStartSchema,
  startMatch,
} from "@/lib/profile/matches";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { getGameServers } from "@/lib/servers/registry";

export const runtime = "nodejs";

/**
 * CS2 plugin → start a retake match.
 *
 * POST { matchId, serverId, map, serverName?, startedAt? }
 * Auth: X-API-Key
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

  const parsed = matchStartSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const fleet = await getGameServers();
  if (!fleet.some((s) => s.id === parsed.data.serverId)) {
    return jsonError("Unknown serverId.", 400);
  }

  try {
    const result = await startMatch(parsed.data);
    return jsonOk(
      {
        matchId: result.match.matchId,
        created: result.created,
        status: result.match.status,
        map: result.match.map,
      },
      result.created ? 201 : 200,
    );
  } catch (err) {
    if (err instanceof MatchIngestError) {
      return jsonError(err.message, err.status);
    }
    throw err;
  }
}
