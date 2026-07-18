import type {
  PermissionCode,
  RoleCode,
  RoleSource,
} from "@/types/permissions";
import {
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_SOURCES,
} from "@/types/permissions";

export { PERMISSION_CODES, ROLE_CODES, ROLE_SOURCES };

/** Higher index = higher privilege for display-role sync. */
export const ROLE_PRIORITY: Record<RoleCode, number> = {
  USER: 0,
  VIP: 1,
  FOUNDING_MEMBER: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
};

export const PERMISSION_META: Record<
  PermissionCode,
  { name: string; description: string }
> = {
  reserved_slot: {
    name: "Reserved Slot",
    description: "Join a full server by displacing a lower-priority player.",
  },
  vip_chat_tag: {
    name: "VIP Chat Tag",
    description: "Show a VIP tag in CS2 chat.",
  },
  colored_chat: {
    name: "Colored Chat",
    description: "Use colored name/chat in CS2.",
  },
  website_badge: {
    name: "Website Badge",
    description: "Show a VIP badge next to the username on the website.",
  },
  discord_vip: {
    name: "Discord VIP",
    description: "Eligible for Discord VIP role sync.",
  },
  admin_panel: {
    name: "Admin Panel",
    description: "Access the website admin dashboard.",
  },
  manage_users: {
    name: "Manage Users",
    description: "Search users and grant or revoke roles.",
  },
  manage_servers: {
    name: "Manage Servers",
    description: "Manage CS2 server configuration.",
  },
  kick: {
    name: "Kick",
    description: "Kick players from the server.",
  },
  mute: {
    name: "Mute",
    description: "Mute players in chat/voice.",
  },
  slay: {
    name: "Slay",
    description: "Slay a player in-game.",
  },
  ban: {
    name: "Ban",
    description: "Ban players from the server.",
  },
  change_map: {
    name: "Change Map",
    description: "Change the active map.",
  },
  priority_queue: {
    name: "Priority Queue",
    description: "Higher join priority when the server is full.",
  },
  beta_access: {
    name: "Beta Access",
    description: "Access early / beta features.",
  },
};

const VIP_PERMS: PermissionCode[] = [
  "reserved_slot",
  "vip_chat_tag",
  "colored_chat",
  "website_badge",
  "priority_queue",
];

const MOD_PERMS: PermissionCode[] = ["kick", "mute", "slay", "change_map"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  USER: [],
  VIP: [...VIP_PERMS],
  FOUNDING_MEMBER: [...VIP_PERMS, "discord_vip", "beta_access"],
  MODERATOR: [...MOD_PERMS],
  ADMIN: [
    ...MOD_PERMS,
    "ban",
    "manage_users",
    "manage_servers",
    "admin_panel",
  ],
  OWNER: [...PERMISSION_CODES],
};

export const ROLE_NAMES: Record<RoleCode, string> = {
  USER: "User",
  FOUNDING_MEMBER: "Founding Member",
  VIP: "VIP",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  OWNER: "Owner",
};

export const CACHE_TTL_MS = 5 * 60 * 1000;

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}

export function isRoleSource(value: string): value is RoleSource {
  return (ROLE_SOURCES as readonly string[]).includes(value);
}

export function parseOwnerSteamIds(
  raw = process.env.OWNER_STEAM_IDS ?? "",
): string[] {
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getPluginApiKey(): string | null {
  const key = process.env.PLUGIN_API_KEY?.trim();
  return key || null;
}
