import { isMongoConfigured } from "@/lib/mongo";
import {
  ingestMatchRound,
  MatchIngestError,
  matchRoundSchema,
} from "@/lib/profile/matches";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { getGameServers } from "@/lib/servers/registry";

export const runtime = "nodejs";

/**
 * CS2 plugin → ingest one round for all players in a match.
 *
 * POST { matchId, round, winner, players[], site?, … }
 * Auth: X-API-Key
 *
 * Idempotent on (matchId, round, steamId) — re-sends do not double-count.
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

  const parsed = matchRoundSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  if (parsed.data.serverId) {
    const fleet = await getGameServers();
    if (!fleet.some((s) => s.id === parsed.data.serverId)) {
      return jsonError("Unknown serverId.", 400);
    }
  }

  try {
    const result = await ingestMatchRound(parsed.data);
    return jsonOk({
      matchId: result.matchId,
      round: result.round,
      roundCreated: result.roundCreated,
      players: result.players,
    });
  } catch (err) {
    if (err instanceof MatchIngestError) {
      return jsonError(err.message, err.status);
    }
    throw err;
  }
}
