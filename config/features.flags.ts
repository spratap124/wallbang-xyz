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
  /**
   * Public player profile pages (`/profile`, `/profile/[steamId]`) and account-menu link.
   * Runtime-overridable via admin Settings / FEATURE_PROFILE_PAGE.
   */
  profilePage: false,
  /**
   * Account settings pages (`/settings` and sub-routes) and account-menu link.
   * Runtime-overridable via admin Settings / FEATURE_SETTINGS_PAGE.
   */
  settingsPage: false,
  vipDashboard: true,
  vipPurchase: true,
  /**
   * Public VIP membership page (`/vip`) and nav entry.
   * Checkout lives on `/pricing`.
   * Runtime-overridable via admin Settings / FEATURE_VIP_PAGE.
   * Default off until payment gateway is fully ready.
   */
  vipPage: false,
  /** Razorpay checkout CTA. Default on in local/dev; off in production builds. */
  vipCheckout: process.env.NODE_ENV !== "production",
  vipAllRetakes: false,
  /**
   * Public loadout page (`/loadout`) and nav entry.
   * Runtime-overridable via admin Settings / FEATURE_LOADOUT_PAGE.
   */
  loadoutPage: false,
  /**
   * Public features page (`/features`) and nav entry.
   * Runtime-overridable via admin Settings / FEATURE_FEATURES_PAGE.
   */
  featuresPage: false,
  inventory: false,
  statistics: false,
  adminPanel: true,
  tournaments: false,
  matchmaking: false,
} as const;

export type FeatureFlags = {
  readonly [K in keyof typeof featureFlags]: boolean;
};

/** Flags writable at runtime via admin Settings / env overrides. */
export type WritableFeatureFlag =
  | "vipPage"
  | "vipAllRetakes"
  | "vipCheckout"
  | "loadoutPage"
  | "featuresPage"
  | "profilePage"
  | "settingsPage";

export const writableFeatureFlags: readonly WritableFeatureFlag[] = [
  "vipPage",
  "vipAllRetakes",
  "vipCheckout",
  "loadoutPage",
  "featuresPage",
  "profilePage",
  "settingsPage",
] as const;
