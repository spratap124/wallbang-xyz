import type { PrivacyLevel } from "@/types/profile";

/**
 * Until a friends graph exists, "friends" is treated as private for outsiders.
 */
export function canViewerAccess(
  level: PrivacyLevel,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  return level === "public";
}
