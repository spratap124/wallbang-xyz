import type { RoleCode } from "@/types/permissions";

/** Badge catalog — new types are data, not hardcoded UI branches. */
export const BADGE_TYPES = [
  "VIP",
  "BETA_TESTER",
  "FOUNDER",
  "EARLY_SUPPORTER",
  "TOURNAMENT_WINNER",
  "MODERATOR",
  "DEVELOPER",
  "CONTENT_CREATOR",
  "FOUNDING_MEMBER",
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export const PRIVACY_LEVELS = ["public", "friends", "private"] as const;
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

export type PrivacySettings = {
  stats: PrivacyLevel;
  matchHistory: PrivacyLevel;
  steamInventory: PrivacyLevel;
  activity: PrivacyLevel;
};

export type PlayerProfileDoc = {
  _id: string;
  userId: string;
  steamId: string;
  /** Future custom display name; null = use Steam personaName. */
  displayName: string | null;
  bannerUrl: string | null;
  countryCode: string | null;
  bio: string | null;
  profileViews: number;
  preferredSide: "T" | "CT" | null;
  favoriteWeapon: string | null;
  favoriteMap: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerStatsDoc = {
  _id: string;
  steamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
  mvps: number;
  hoursPlayed: number;
  updatedAt: Date;
};

export type PlayerBadgeDoc = {
  _id: string;
  steamId: string;
  badgeType: BadgeType;
  grantedAt: Date;
  grantedBy: string | null;
  metadata: Record<string, unknown> | null;
};

export type PlayerSettingsDoc = {
  _id: string;
  steamId: string;
  privacy: PrivacySettings;
  theme: "dark" | "system";
  notificationsEnabled: boolean;
  updatedAt: Date;
};

export type PlayerActivityType =
  | "joined"
  | "got_vip"
  | "won_giveaway"
  | "reached_matches"
  | "reached_level"
  | "got_achievement"
  | "purchased_vip"
  | "played_match"
  | "custom";

export type PlayerActivityDoc = {
  _id: string;
  steamId: string;
  type: PlayerActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type QuickStats = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  kd: number | null;
  headshots: number;
  headshotPercent: number | null;
  mvps: number;
  hoursPlayed: number;
};

export type ProfileBadge = {
  type: BadgeType;
  label: string;
  grantedAt: string;
};

export type PlayerSummary = {
  steamId: string;
  memberSince: string;
  lastLoginAt: string;
  role: RoleCode;
  profileCompletion: number;
  currentServer: string | null;
  favoriteWeapon: string | null;
  favoriteMap: string | null;
  preferredSide: "T" | "CT" | null;
};

/**
 * Aggregated view model for the profile page.
 * Combines User (auth) + Player domain collections.
 */
export type PlayerProfileView = {
  steamId: string;
  userId: string;
  personaName: string;
  displayName: string;
  avatarUrl: string;
  steamProfileUrl: string;
  bannerUrl: string | null;
  countryCode: string | null;
  bio: string | null;
  role: RoleCode;
  isVip: boolean;
  showWebsiteBadge: boolean;
  joinedAt: string;
  lastLoginAt: string;
  profileViews: number;
  isOwner: boolean;
  summary: PlayerSummary;
  stats: QuickStats;
  badges: ProfileBadge[];
  privacy: PrivacySettings;
};

export type PatchProfileInput = {
  displayName?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  preferredSide?: "T" | "CT" | null;
  favoriteWeapon?: string | null;
  favoriteMap?: string | null;
  privacy?: Partial<PrivacySettings>;
  theme?: "dark" | "system";
  notificationsEnabled?: boolean;
};
