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
  normalizeStatsDoc,
  computeProfileCompletion,
  buildProfileCompletion,
  DEFAULT_RATING,
  ROUND_WIN_RATING_DELTA,
  ROUND_LOSS_RATING_DELTA,
} from "@/lib/profile/stats";
export {
  startMatch,
  ingestMatchRound,
  endMatch,
  MatchIngestError,
} from "@/lib/profile/matches";
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
