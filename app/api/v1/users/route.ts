import { jsonError, jsonOk, requirePermission } from "@/lib/permissions/authz";
import {
  getUserPermissions,
  listUsers,
  searchUsers,
} from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { userRolesCollection } from "@/lib/permissions/collections";
import type { RoleSource, UserRoleDoc } from "@/types/permissions";
import { fetchSteamPlayerSummary } from "@/lib/auth/steam-api";
import { isValidSteamId64 } from "@/lib/profile/public";
import type { RoleCode } from "@/types/permissions";

export async function GET(request: Request): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const auth = await requirePermission("manage_users");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const steamId = searchParams.get("steamId")?.trim();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "25");
  const page = Number.isFinite(pageRaw) ? Math.max(Math.floor(pageRaw), 1) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(Math.floor(pageSizeRaw), 1), 100)
    : 25;
  const roleParam = searchParams.get("role") ?? "";
  const role = ["USER", "FOUNDING_MEMBER", "VIP", "MODERATOR", "ADMIN", "OWNER"].includes(roleParam)
    ? roleParam as RoleCode
    : undefined;
  const vipSourceParam = searchParams.get("vipSource") ?? "";
  const vipSource = ["PURCHASE", "GIVEAWAY", "OTHER"].includes(vipSourceParam)
    ? vipSourceParam as "PURCHASE" | "GIVEAWAY" | "OTHER"
    : undefined;

  if (steamId) {
    const resolved = await getUserPermissions({ steamId });
    if (resolved) return jsonOk({ registered: true, permissions: resolved });
    if (!isValidSteamId64(steamId)) return jsonError("Invalid SteamID64.", 400);
    try {
      const profile = await fetchSteamPlayerSummary(steamId);
      return jsonOk({ registered: false, profile });
    } catch {
      return jsonError("Steam profile not found or unavailable.", 404);
    }
  }

  if (!q) {
    const roles = await userRolesCollection();
    const now = new Date();
    const activeVipFilter: import("mongodb").Filter<UserRoleDoc> = {
      roleCode: "VIP", active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (vipSource) {
      const sources: RoleSource[] = vipSource === "OTHER"
        ? ["MANUAL", "TOURNAMENT", "PROMOTION", "FOUNDING", "SYSTEM"]
        : [vipSource];
      const matchingIds = await roles.distinct("userId", { ...activeVipFilter, source: { $in: sources } });
      const result = await listUsers({ skip: (page - 1) * pageSize, limit: pageSize, role: "VIP", userIds: matchingIds });
      const pageUsers = result.users;
      const pageIds = pageUsers.map((user) => user.id);
      const sourceRows = pageIds.length ? await roles.find({ ...activeVipFilter, userId: { $in: pageIds }, source: { $in: sources } }).toArray() : [];
      const sourceById = new Map(sourceRows.map((assignment) => [assignment.userId, assignment.source]));
      return jsonOk({
        items: pageUsers.map((user) => ({ ...user, vipSource: sourceById.get(user.id) ?? null })),
        page, pageSize, hasMore: result.hasMore,
        total: result.total,
      });
    }

    const result = await listUsers({ skip: (page - 1) * pageSize, limit: pageSize, role });
    const [vipGiveawayPlayers, vipPurchasePlayers] = await Promise.all([
      roles.distinct("userId", { ...activeVipFilter, source: "GIVEAWAY" }),
      roles.distinct("userId", { ...activeVipFilter, source: "PURCHASE" }),
    ]);
    return jsonOk({
      items: result.users.map((user) => ({ ...user, vipSource: null })),
      page,
      pageSize,
      hasMore: result.hasMore,
      total: result.total,
      vipGiveawayTotal: vipGiveawayPlayers.length,
      vipPurchaseTotal: vipPurchasePlayers.length,
    });
  }

  const roles = await userRolesCollection();
  const now = new Date();
  const activeVipFilter: import("mongodb").Filter<UserRoleDoc> = {
    userId: { $exists: true }, roleCode: "VIP", active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  const sources: RoleSource[] | undefined = vipSource
    ? vipSource === "OTHER" ? ["MANUAL", "TOURNAMENT", "PROMOTION", "FOUNDING", "SYSTEM"] : [vipSource]
    : undefined;
  const matchingIds = sources ? await roles.distinct("userId", { ...activeVipFilter, source: { $in: sources } }) : undefined;
  const result = await searchUsers(q, { skip: (page - 1) * pageSize, limit: pageSize, role: vipSource ? "VIP" : role, userIds: matchingIds });
  const ids = result.users.map((user) => user.id);
  const activeRoles = ids.length ? await roles.find({ userId: { $in: ids }, roleCode: "VIP", active: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).toArray() : [];
  const sourceById = new Map(activeRoles.map((assignment) => [assignment.userId, assignment.source]));
  return jsonOk({ items: result.users.map((user) => ({ ...user, vipSource: sourceById.get(user.id) ?? null })), page, pageSize, hasMore: result.hasMore });
}
