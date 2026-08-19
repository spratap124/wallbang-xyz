import { z } from "zod";

import { buildVipShopQuote } from "@/config/vip-plans";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import { getGameServers } from "@/lib/servers/registry";
import type { VipShopQuote } from "@/types/vip";

const bodySchema = z.object({
  serverIds: z.array(z.string().min(1)).min(1).max(20),
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
    return jsonError("Select at least one server.", 400);
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
    servers: shopServers,
    selectedServerIds: parsed.data.serverIds,
  });

  if (quote.serverIds.length === 0) {
    return jsonError("Unknown server selection.", 400);
  }

  return jsonOk<VipShopQuote>(quote);
}
