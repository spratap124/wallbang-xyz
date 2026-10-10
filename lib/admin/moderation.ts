import type { BanView, ReportView } from "@/types/moderation";
import type { PermissionCode } from "@/types/permissions";

export type BanDisplayStatus = "active" | "expired" | "revoked" | "scheduled";

export type ReportFilters = {
  reason?: string;
  serverId?: string;
  targetSteamId?: string;
  from?: string;
  to?: string;
};

export type ModerationCapabilities = {
  access: boolean;
  timedBans: boolean;
  permanentBans: boolean;
  revokeBans: boolean;
  reviewReports: boolean;
  adminAudit: boolean;
};

export const STEAM_ID64_PATTERN = /^\d{17}$/;

export function isValidSteamId64(value: string): boolean {
  return STEAM_ID64_PATTERN.test(value.trim());
}

export function getBanDisplayStatus(
  ban: Pick<BanView, "status" | "permanent" | "startsAt" | "expiresAt">,
  now = Date.now(),
): BanDisplayStatus {
  if (ban.status === "revoked") return "revoked";
  const startsAt = Date.parse(ban.startsAt);
  if (Number.isFinite(startsAt) && startsAt > now) return "scheduled";
  if (ban.permanent) return "active";
  if (!ban.expiresAt) return "expired";
  const expiresAt = Date.parse(ban.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now ? "active" : "expired";
}

export function orderReportsPendingFirst(reports: ReportView[]): ReportView[] {
  const priority = { open: 0, assigned: 1, resolved: 2, dismissed: 3 } as const;
  return [...reports].sort((left, right) => {
    const statusOrder = priority[left.status] - priority[right.status];
    if (statusOrder !== 0) return statusOrder;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function filterReports(
  reports: ReportView[],
  filters: ReportFilters,
): ReportView[] {
  const target = filters.targetSteamId?.trim() ?? "";
  return reports.filter((report) => {
    if (filters.reason && report.reason !== filters.reason) return false;
    if (filters.serverId && report.serverId !== filters.serverId) return false;
    if (target && !report.targetSteamId.includes(target)) return false;

    const day = new Date(report.createdAt).toISOString().slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}

export function getModerationCapabilities(
  permissions: readonly PermissionCode[],
): ModerationCapabilities {
  const has = (permission: PermissionCode) => permissions.includes(permission);
  return {
    access: has("moderation_access"),
    timedBans: has("issue_timed_bans"),
    permanentBans: has("issue_permanent_bans"),
    revokeBans: has("revoke_bans"),
    reviewReports: has("review_reports"),
    adminAudit: has("admin_panel"),
  };
}
