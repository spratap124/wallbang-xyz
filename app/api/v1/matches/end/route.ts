import { isMongoConfigured } from "@/lib/mongo";
import {
  endMatch,
  MatchIngestError,
  matchEndSchema,
} from "@/lib/profile/matches";
import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";

export const runtime = "nodejs";

/**
 * CS2 plugin → finalize a match (matchesPlayed / W-L + rating snapshot).
 *
 * POST { matchId, scoreT?, scoreCT?, winner?, endedAt?, status? }
 * Auth: X-API-Key
 *
 * Idempotent once the match leaves `in_progress`.
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

  const parsed = matchEndSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const result = await endMatch(parsed.data);
    return jsonOk({
      matchId: result.match.matchId,
      finalized: result.finalized,
      status: result.match.status,
      scoreT: result.match.scoreT,
      scoreCT: result.match.scoreCT,
      winner: result.match.winner,
      players: result.players,
    });
  } catch (err) {
    if (err instanceof MatchIngestError) {
      return jsonError(err.message, err.status);
    }
    throw err;
  }
}
