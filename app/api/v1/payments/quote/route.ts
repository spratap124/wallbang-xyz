import { z } from "zod";

import { buildVipShopQuote } from "@/config/vip-plans";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import { isVipAllRetakesEnabled } from "@/lib/platform/feature-flags";
import { getGameServers } from "@/lib/servers/registry";
import type { VipShopQuote } from "@/types/vip";

const accessTypeSchema = z.enum(["INDIVIDUAL_SERVER", "ALL_RETAKES"]);

const bodySchema = z
  .object({
    accessType: accessTypeSchema,
    serverId: z.string().min(1).optional(),
    serverIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.serverIds && value.serverIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Multiple servers are not supported.",
        path: ["serverIds"],
      });
    }

    if (value.accessType === "INDIVIDUAL_SERVER" && !value.serverId) {
      ctx.addIssue({
        code: "custom",
        message: "Select a server.",
        path: ["serverId"],
      });
    }

    if (value.accessType === "ALL_RETAKES" && value.serverId) {
      ctx.addIssue({
        code: "custom",
        message: "All Retakes purchases must not include a server.",
        path: ["serverId"],
      });
    }
  });

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid request body.";
    return jsonError(message, 400);
  }

  if (
    parsed.data.accessType === "ALL_RETAKES" &&
    !(await isVipAllRetakesEnabled())
  ) {
    return jsonError("All Retakes purchases are not available yet.", 400);
  }

  const servers = await getGameServers();
  const shopServers = servers.map((server) => ({
    id: server.id,
    name: server.name,
    shortName: server.shortName || server.name,
    mode: server.mode,
    city: server.city,
    region: server.region,
    map: server.map,
    maxPlayers: server.maxPlayersOverride ?? server.maxPlayers,
    pingMs: server.pingMs,
    status: server.status,
    vipPricingByPlan: server.vipPricingByPlan ?? undefined,
  }));

  const quote = buildVipShopQuote({
    accessType: parsed.data.accessType,
    serverId: parsed.data.serverId,
    servers: shopServers,
  });

  if (
    quote.accessType === "INDIVIDUAL_SERVER" &&
    (!quote.serverId ||
      !shopServers.some((server) => server.id === quote.serverId))
  ) {
    return jsonError("Unknown server.", 400);
  }

  return jsonOk<VipShopQuote>(quote);
}
