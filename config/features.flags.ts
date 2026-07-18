/**
 * Feature flags for future platform modules.
 * Keep marketing nav free of unfinished product surfaces.
 */
export const featureFlags = {
  steamAuth: true,
  discordAuth: false,
  playerDashboard: false,
  leaderboards: false,
  playerProfiles: false,
  vipDashboard: false,
  inventory: false,
  statistics: false,
  adminPanel: true,
  tournaments: false,
  matchmaking: false,
} as const;

export type FeatureFlags = typeof featureFlags;
