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
  | "got_badge"
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

/** Live presence pushed by the CS2 plugin (SteamID → server). */
export type PlayerPresenceDoc = {
  _id: string;
  steamId: string;
  serverId: string;
  serverName: string;
  map: string | null;
  updatedAt: Date;
};

/**
 * Historical connection session derived from presence heartbeats.
 * Open sessions have `leftAt: null`; duration uses `lastSeenAt` until closed.
 */
export type PlayerSessionDoc = {
  _id: string;
  steamId: string;
  serverId: string;
  serverName: string;
  map: string | null;
  joinedAt: Date;
  lastSeenAt: Date;
  leftAt: Date | null;
};

export type ServerStatsRange = "1d" | "7d" | "30d" | "all";

export type ServerStatsSummary = {
  range: ServerStatsRange;
  serverId: string;
  serverName: string;
  uniquePlayers: number;
  totalSessions: number;
  totalPlayTimeMs: number;
  avgSessionMs: number;
  currentlyOnline: number;
  livePlayers: number | null;
  liveMaxPlayers: number | null;
  online: boolean;
};

export type ServerStatsRecentSession = {
  id: string;
  steamId: string;
  personaName: string | null;
  avatarUrl: string | null;
  map: string | null;
  joinedAt: string;
  leftAt: string | null;
  lastSeenAt: string;
  durationMs: number;
  active: boolean;
};

export type ServerStatsDayBucket = {
  date: string;
  uniquePlayers: number;
  sessions: number;
};

export type ServerStatsResponse = {
  summary: ServerStatsSummary;
  recent: ServerStatsRecentSession[];
  daily: ServerStatsDayBucket[];
};

/** Fleet-wide rollup for the admin Overview dashboard. */
export type FleetOverviewSummary = {
  range: ServerStatsRange;
  uniquePlayers: number;
  totalSessions: number;
  totalPlayTimeMs: number;
  avgSessionMs: number;
  currentlyOnline: number;
  livePlayers: number;
  liveMaxPlayers: number;
  onlineServers: number;
  totalServers: number;
  enabledServers: number;
};

export type FleetOverviewRecentSession = ServerStatsRecentSession & {
  serverId: string;
  serverName: string;
};

export type FleetOverviewServerCard = {
  id: string;
  name: string;
  shortName: string;
  host: string;
  port: number;
  mode: string;
  map: string;
  region: string;
  city: string;
  enabled: boolean;
  featured: boolean;
  players: number | null;
  maxPlayers: number | null;
  online: boolean;
};

export type FleetOverviewResponse = {
  summary: FleetOverviewSummary;
  recent: FleetOverviewRecentSession[];
  daily: ServerStatsDayBucket[];
  servers: FleetOverviewServerCard[];
};

export type AdminHealthStatus = "ok" | "degraded" | "down";

export type AdminHealthCheck = {
  id: "game_servers" | "web_api" | "database" | "discord_bot";
  label: string;
  status: AdminHealthStatus;
  detail: string;
  value: string;
};

export type AdminHealthResponse = {
  overall: "operational" | "degraded" | "down";
  checkedAt: string;
  checks: AdminHealthCheck[];
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

export type CurrentServerInfo = {
  serverId: string;
  serverName: string;
  map: string | null;
  players: number | null;
  maxPlayers: number | null;
  connectUrl: string | null;
  ip: string | null;
  updatedAt: string;
};

export type ProfileCompletionItem = {
  key: string;
  label: string;
  done: boolean;
};

export type ProfileCompletion = {
  percent: number;
  items: ProfileCompletionItem[];
};

export type PlayerSummary = {
  steamId: string;
  memberSince: string;
  lastLoginAt: string;
  role: RoleCode;
  profileCompletion: number;
  completion: ProfileCompletion;
  currentServer: CurrentServerInfo | null;
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
