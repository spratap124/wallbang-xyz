export const ROLE_CODES = [
  "USER",
  "FOUNDING_MEMBER",
  "VIP",
  "MODERATOR",
  "ADMIN",
  "OWNER",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  "reserved_slot",
  "vip_chat_tag",
  "colored_chat",
  "website_badge",
  "discord_vip",
  "admin_panel",
  "manage_users",
  "manage_servers",
  "kick",
  "mute",
  "slay",
  "ban",
  "change_map",
  "priority_queue",
  "beta_access",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_SOURCES = [
  "MANUAL",
  "PURCHASE",
  "TOURNAMENT",
  "PROMOTION",
  "FOUNDING",
  "GIVEAWAY",
  "SYSTEM",
] as const;

export type RoleSource = (typeof ROLE_SOURCES)[number];

export type PermissionDoc = {
  _id: string;
  code: PermissionCode;
  name: string;
  description: string;
  createdAt: Date;
};

export type RoleDoc = {
  _id: string;
  code: RoleCode;
  name: string;
  permissions: PermissionCode[];
  createdAt: Date;
};

export type UserRoleDoc = {
  _id: string;
  userId: string;
  roleId: string;
  roleCode: RoleCode;
  source: RoleSource;
  grantedBy: string | null;
  grantedAt: Date;
  expiresAt: Date | null;
  active: boolean;
};

export type AuditAction = "GRANT_ROLE" | "REVOKE_ROLE";

export type AuditLogDoc = {
  _id: string;
  adminId: string | null;
  adminSteamId: string | null;
  action: AuditAction;
  targetUserId: string;
  targetSteamId: string;
  /** Snapshot of the target's persona name at write time. */
  targetPersonaName: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  timestamp: Date;
};

export type ResolvedPermissions = {
  userId: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  displayRole: RoleCode;
  roles: RoleCode[];
  permissions: PermissionCode[];
  activeAssignments: Array<{
    id: string;
    roleCode: RoleCode;
    source: RoleSource;
    grantedAt: Date;
    expiresAt: Date | null;
  }>;
};

export type PlayerPermissionsResponse = {
  player: {
    steamId: string;
    username: string;
  };
  roles: RoleCode[];
  permissions: PermissionCode[];
  /** Game-facing loadout for WallBang.Skins / Knife / Gloves plugins. */
  loadout: import("@/types/player-loadout").GameLoadout | null;
};
