/**
 * Feature flags for future platform modules.
 * Keep marketing nav free of unfinished product surfaces.
 */
export const featureFlags = {
  steamAuth: true,
  discordAuth: false,
  playerDashboard: false,
  leaderboards: false,
  playerProfiles: true,
  vipDashboard: true,
  vipPurchase: true,
  /** Razorpay checkout CTA. Default on in local/dev; off in production builds. */
  vipCheckout: process.env.NODE_ENV !== "production",
  vipAllRetakes: false,
  inventory: false,
  statistics: false,
  adminPanel: true,
  tournaments: false,
  matchmaking: false,
} as const;

export type FeatureFlags = {
  readonly [K in keyof typeof featureFlags]: boolean;
};
