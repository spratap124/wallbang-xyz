import { getSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/permissions/authz";
import { getUserPermissions } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";

export async function GET(): Promise<Response> {
  if (!isMongoConfigured()) {
    return jsonError("Database is not configured.", 503);
  }

  const user = await getSession();
  if (!user) {
    return jsonOk(null);
  }

  const resolved = await getUserPermissions({ userId: user.id });
  if (!resolved) {
    return jsonOk({
      user,
      roles: [] as string[],
      permissions: [] as string[],
      displayRole: "USER",
      activeAssignments: [],
    });
  }

  return jsonOk({
    user: {
      id: resolved.userId,
      steamId: resolved.steamId,
      personaName: resolved.personaName,
      avatarUrl: resolved.avatarUrl,
      profileUrl: resolved.profileUrl,
    },
    displayRole: resolved.displayRole,
    roles: resolved.roles,
    permissions: resolved.permissions,
    activeAssignments: resolved.activeAssignments,
  });
}
