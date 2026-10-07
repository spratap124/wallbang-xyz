import {
  jsonError,
  jsonOk,
  requirePluginApiKey,
} from "@/lib/permissions/authz";
import { getGameServerPowerState } from "@/lib/servers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Game host → admin power intent (Running / Stopped).
 *
 * GET /api/v1/servers/{SERVER_ID}/power
 * Headers: X-API-Key: <PLUGIN_API_KEY>
 *
 * 404 means the id is not in the fleet registry; hosts treat that as running.
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = requirePluginApiKey(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) return jsonError("Missing server id.", 400);

  try {
    const power = await getGameServerPowerState(id);
    if (!power) return jsonError("Server not found.", 404);
    return jsonOk(power);
  } catch (err) {
    console.error("[servers/power] read failed", err);
    return jsonError("Failed to read server power state.", 500);
  }
}
