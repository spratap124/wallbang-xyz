import type { BadgeType } from "@/types/profile";
import type { RoleCode } from "@/types/permissions";
import { ROLE_NAMES } from "@/lib/permissions/constants";

export const BADGE_LABELS: Record<BadgeType, string> = {
  VIP: "VIP",
  BETA_TESTER: "Beta Tester",
  FOUNDER: "Founder",
  EARLY_SUPPORTER: "Early Supporter",
  TOURNAMENT_WINNER: "Tournament Winner",
  MODERATOR: "Moderator",
  DEVELOPER: "Developer",
  CONTENT_CREATOR: "Content Creator",
  FOUNDING_MEMBER: "Founding Member",
};

/** Map active roles → default badge types (Sprint 1 seed from RBAC). */
export const ROLE_TO_BADGE: Partial<Record<RoleCode, BadgeType>> = {
  VIP: "VIP",
  FOUNDING_MEMBER: "FOUNDING_MEMBER",
  MODERATOR: "MODERATOR",
  ADMIN: "MODERATOR",
  OWNER: "DEVELOPER",
};

export function badgeLabel(type: BadgeType): string {
  return BADGE_LABELS[type] ?? type;
}

export function roleDisplayName(role: RoleCode): string {
  return ROLE_NAMES[role] ?? role;
}
