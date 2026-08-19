export {
  getUserPermissions,
  hasPermission,
  grantRole,
  extendVipExpiry,
  subtractVipExpiry,
  revokeRole,
  searchUsers,
  getAuditLogs,
  getPlayerPermissions,
  onUserAuthenticated,
  ensureOwnerFromEnv,
  ensureBaselineUserRole,
  refreshCache,
  recordAuditLog,
} from "@/lib/permissions/service";
export { seedPermissionsCatalog } from "@/lib/permissions/seed";
export {
  ROLE_CODES,
  PERMISSION_CODES,
  ROLE_SOURCES,
  ROLE_NAMES,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/permissions/constants";
