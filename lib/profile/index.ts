export {
  ensurePlayerDomain,
  getMyProfile,
  getPlayerActivity,
  getPlayerBadges,
  getPlayerProfile,
  getPlayerStats,
  grantPlayerBadge,
  isValidSteamId64,
  patchPlayerProfile,
  DEFAULT_PRIVACY,
} from "@/lib/profile/service";
export {
  BADGE_LABELS,
  badgeLabel,
  ROLE_TO_BADGE,
  roleDisplayName,
} from "@/lib/profile/badges";
export {
  toQuickStats,
  emptyStats,
  computeProfileCompletion,
  buildProfileCompletion,
} from "@/lib/profile/stats";
export {
  formatRelativeTime,
  formatMonthYear,
  formatStatValue,
  countryFlagEmoji,
} from "@/lib/profile/format";
export {
  upsertPlayerPresence,
  clearPlayerPresence,
  resolveCurrentServer,
  getPlayerPresence,
} from "@/lib/profile/presence";
export {
  recordPlayerActivity,
  syncBadgeFromRole,
} from "@/lib/profile/activity";
