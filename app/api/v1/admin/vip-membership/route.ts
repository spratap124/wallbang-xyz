import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getUserVipMembership } from "@/lib/payments/entitlements";
import {
  buildAdminVipEntitlementRows,
  hasActiveVipEntitlementForServer,
} from "@/lib/payments/entitlements-logic";
import { vipHistoryCollection } from "@/lib/payments/collections";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { findUserById, findUserBySteamId } from "@/lib/auth/users";
import { isMongoConfigured } from "@/lib/mongo";
import { getGameServers } from "@/lib/servers/registry";

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId")?.trim() || undefined;
  const targetSteamId = url.searchParams.get("steamId")?.trim() || undefined;

  if (!targetUserId && !targetSteamId) {
    return jsonError("userId or steamId is required.", 400);
  }

  const user = targetUserId
    ? await findUserById(targetUserId)
    : targetSteamId
      ? await findUserBySteamId(targetSteamId)
      : null;

  if (!user && !targetSteamId) {
    return jsonError("User not found.", 404);
  }

  const [servers, allBundles] = await Promise.all([
    getGameServers({ includeDisabled: true }),
    listVipBundleDocs().catch(() => []),
  ]);
  const eligibleServers = servers.map((server) => ({
    id: server.id,
    shortName: server.shortName || server.name,
    name: server.name,
    pricingByPlan: server.vipPricingByPlan ?? {},
  }));
  const bundles = allBundles
    .filter((bundle) => bundle.enabled && bundle.serverIds.length > 0 && bundle.serverIds.every((id) => servers.some((server) => server.id === id)))
    .map((bundle) => ({ id: bundle.id, label: bundle.name, serverCount: bundle.serverIds.length, serverIds: bundle.serverIds, pricingByPlan: bundle.pricingByPlan }));

  // Unregistered Steam players still need the fleet list so a first VIP grant
  // (which creates their account) can be scoped to servers.
  if (!user) {
    return jsonOk({
      userId: null,
      steamId: targetSteamId,
      personaName: null,
      membership: null,
      entitlements: [],
      servers: eligibleServers.map((server) => ({
        id: server.id,
        label: server.shortName || server.name,
        hasAccess: false,
      pricingByPlan: server.pricingByPlan,
      })),
      bundles,
    });
  }

  const membership = await getUserVipMembership({
    userId: user._id,
    eligibleServers,
  });

  const historyCol = await vipHistoryCollection();
  const [history, bundleDocs] = await Promise.all([
    historyCol.find({ userId: user._id }).sort({ createdAt: 1 }).toArray(),
    listVipBundleDocs().catch(() => []),
  ]);
  const bundleLabels: Record<string, string> = {};
  for (const bundle of bundleDocs) {
    bundleLabels[bundle.id] = bundle.name;
  }

  const now = new Date();
  const entitlements = buildAdminVipEntitlementRows({
    history,
    eligibleServers,
    bundleLabels,
    now,
  });
  const serverOptions = eligibleServers.map((server) => ({
    id: server.id,
    label: server.shortName || server.name,
    hasAccess: hasActiveVipEntitlementForServer({
      history,
      serverId: server.id,
      now,
    }),
    pricingByPlan: server.pricingByPlan,
  }));

  return jsonOk({
    userId: user._id,
    steamId: user.steamId,
    personaName: user.personaName,
    membership,
    serverAccess: membership.serverAccess,
    entitlements,
    servers: serverOptions,
    bundles,
  });
}
