import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import { getUserVipMembership } from "@/lib/payments/entitlements";
import {
  entitlementKeyFromRecord,
  computeEntitlementExpiry,
  isAllRetakesRecord,
  serverIdsFromRecord,
} from "@/lib/payments/entitlements-logic";
import { vipHistoryCollection } from "@/lib/payments/collections";
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

  if (!user) {
    return jsonError("User not found.", 404);
  }

  const servers = await getGameServers({ includeDisabled: true });
  const eligibleServers = servers.map((server) => ({
    id: server.id,
    shortName: server.shortName || server.name,
    name: server.name,
  }));

  const membership = await getUserVipMembership({
    userId: user._id,
    eligibleServers,
  });

  const historyCol = await vipHistoryCollection();
  const history = await historyCol
    .find({ userId: user._id })
    .sort({ createdAt: 1 })
    .toArray();

  const byKey = new Map<
    string,
    { label: string; purchaseCount: number; expiresAt: string | null }
  >();

  for (const record of history) {
    const key = entitlementKeyFromRecord(record);
    if (!key) continue;
    const existing = byKey.get(key);
    const label =
      key === "all_retakes"
        ? "All Retakes Bundle"
        : eligibleServers.find((s) => s.id === key)?.shortName ?? key;
    byKey.set(key, {
      label,
      purchaseCount: (existing?.purchaseCount ?? 0) + 1,
      expiresAt: null,
    });
  }

  for (const [key, entry] of byKey) {
    const records =
      key === "all_retakes"
        ? history.filter(isAllRetakesRecord)
        : history.filter((item) => serverIdsFromRecord(item).includes(key));
    const expiry = computeEntitlementExpiry(records);
    entry.expiresAt = expiry?.toISOString() ?? null;
  }

  const entitlements = [...byKey.entries()]
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      purchaseCount: entry.purchaseCount,
      expiresAt: entry.expiresAt,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return jsonOk({
    userId: user._id,
    steamId: user.steamId,
    personaName: user.personaName,
    membership,
    entitlements,
  });
}
