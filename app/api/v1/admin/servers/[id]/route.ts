import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  disableGameServer,
  updateGameServer,
} from "@/lib/servers/registry";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  shortName: z.string().trim().min(1).max(64).optional(),
  mode: z.string().trim().min(1).max(64).optional(),
  map: z.string().trim().min(1).max(64).optional(),
  region: z.string().trim().min(1).max(128).optional(),
  city: z.string().trim().min(1).max(64).optional(),
  host: z.string().trim().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tickRate: z.number().int().min(64).max(128).optional(),
  maxPlayers: z.number().int().min(1).max(128).optional(),
  maxPlayersOverride: z.number().int().min(1).max(128).nullable().optional(),
  pingUrl: z.string().trim().max(512).nullable().optional(),
  status: z.enum(["live", "offline", "maintenance"]).optional(),
  featured: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) return jsonError("Missing server id.", 400);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const updated = await updateGameServer(id, parsed.data);
  if (!updated) return jsonError("Server not found.", 404);
  return jsonOk(updated);
}

/** Soft-disable (hide from public list). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) return jsonError("Missing server id.", 400);

  const updated = await disableGameServer(id);
  if (!updated) return jsonError("Server not found.", 404);
  return jsonOk(updated);
}
