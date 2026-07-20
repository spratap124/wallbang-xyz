import { z } from "zod";

import { isMongoConfigured } from "@/lib/mongo";
import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  createGameServer,
  listGameServersAdmin,
} from "@/lib/servers/registry";

export const runtime = "nodejs";

const createSchema = z.object({
  id: z.string().min(2).max(64),
  name: z.string().trim().min(1).max(128),
  shortName: z.string().trim().min(1).max(64),
  mode: z.string().trim().min(1).max(64),
  map: z.string().trim().min(1).max(64).default("de_mirage"),
  region: z.string().trim().min(1).max(128),
  city: z.string().trim().min(1).max(64),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  tickRate: z.number().int().min(64).max(128).optional(),
  maxPlayers: z.number().int().min(1).max(128),
  maxPlayersOverride: z.number().int().min(1).max(128).nullable().optional(),
  pingUrl: z.string().trim().max(512).nullable().optional(),
  status: z.enum(["live", "offline", "maintenance"]).optional(),
  featured: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

/** List all fleet rows (incl. disabled). Readable with admin_panel. */
export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("admin_panel");
  if ("response" in auth) return auth.response;

  const servers = await listGameServersAdmin();
  return jsonOk(servers);
}

/** Create a server. Requires manage_servers. */
export async function POST(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_servers");
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "Invalid request body.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const created = await createGameServer(parsed.data);
    return jsonOk(created, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create.";
    const status = message.includes("already exists") ? 409 : 400;
    return jsonError(message, status);
  }
}
