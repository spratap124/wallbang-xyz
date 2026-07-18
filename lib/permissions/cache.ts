import "server-only";

import { CACHE_TTL_MS } from "@/lib/permissions/constants";
import type { PermissionCode, RoleCode } from "@/types/permissions";

export type CachedPermissions = {
  roles: RoleCode[];
  permissions: PermissionCode[];
  expiresAt: number;
};

const cache = new Map<string, CachedPermissions>();

export function getCachedPermissions(
  steamId: string,
): CachedPermissions | null {
  const entry = cache.get(steamId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(steamId);
    return null;
  }
  return entry;
}

export function setCachedPermissions(
  steamId: string,
  roles: RoleCode[],
  permissions: PermissionCode[],
): void {
  cache.set(steamId, {
    roles,
    permissions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidatePermissionCache(steamId: string): void {
  cache.delete(steamId);
}

export function clearPermissionCache(): void {
  cache.clear();
}
