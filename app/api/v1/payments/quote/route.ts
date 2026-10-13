import { z } from "zod";

import { buildVipShopQuote } from "@/config/vip-plans";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import {
  isVipPageEnabled,
} from "@/lib/platform/feature-flags";
import { getGameServers } from "@/lib/servers/registry";
import type { VipShopQuote } from "@/types/vip";

const accessTypeSchema = z.enum(["INDIVIDUAL_SERVER", "BUNDLE"]);

const bodySchema = z
  .object({
    accessType: accessTypeSchema,
    serverId: z.string().min(1).optional(),
    serverIds: z.array(z.string().min(1)).optional(),
    bundleId: z.string().min(1).optional(),
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

    if (value.accessType === "BUNDLE" && !value.bundleId) {
      ctx.addIssue({
        code: "custom",
        message: "Select a bundle.",
        path: ["bundleId"],
      });
    }

    if (value.accessType !== "BUNDLE" && value.bundleId) {
      ctx.addIssue({
        code: "custom",
        message: "Only bundle purchases may include a bundleId.",
        path: ["bundleId"],
      });
    }

    if (value.accessType === "BUNDLE" && (value.serverId || (value.serverIds?.length ?? 0) > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "Bundle purchases must not include individual servers.",
        path: ["bundleId"],
      });
    }
  });

export async function POST(request: Request): Promise<Response> {
  if (!(await isVipPageEnabled())) {
    return jsonError("VIP is not available yet.", 503);
  }

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

  const bundles = (await listVipBundleDocs())
    .filter((bundle) => bundle.enabled)
    .map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      serverIds: bundle.serverIds,
      pricingByPlan: bundle.pricingByPlan,
      enabled: bundle.enabled,
    }));

  let quote: VipShopQuote;
  try {
    quote = buildVipShopQuote({
      accessType: parsed.data.accessType,
      serverId: parsed.data.serverId,
      bundleId: parsed.data.bundleId,
      servers: shopServers,
      bundles,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to quote this selection.",
      400,
    );
  }

  if (quote.accessType === "BUNDLE" && !quote.bundleId) {
    return jsonError("Unknown bundle.", 400);
  }

  if (
    quote.accessType === "INDIVIDUAL_SERVER" &&
    (!quote.serverId ||
      !shopServers.some((server) => server.id === quote.serverId))
  ) {
    return jsonError("Unknown server.", 400);
  }

  return jsonOk<VipShopQuote>(quote);
}
