import "server-only";

import type { CatalogGlove, CatalogKnife } from "@/types/catalog";
import type { EquippedItem, UserLoadoutState } from "@/types/loadout";
import type {
  ProfileCosmeticSlot,
  ProfileDashboardExtras,
  ProfileLoadoutPreview,
  ProfileServerMeta,
  ProfileVipCard,
} from "@/types/profile-dashboard";
import { getGlovesCatalog, getKnivesCatalog } from "@/lib/loadout/catalog";
import { getPlayerLoadout } from "@/lib/loadout/service";
import { resolveDefaultWeaponImage, resolveSkinPreview } from "@/lib/loadout/images";
import { getUserVipMembership } from "@/lib/payments/entitlements";
import { formatDaysRemaining, formatVipExpiryDate } from "@/lib/payments/vip-display";
import { IST_TIME_ZONE } from "@/lib/time/ist";
import { getGameServers } from "@/lib/servers/registry";
import type { VipMembershipView } from "@/types/vip";

const EMPTY_SLOTS: ProfileLoadoutPreview = {
  knife: emptySlot("Knife"),
  ctGloves: emptySlot("CT Gloves"),
  tGloves: emptySlot("T Gloves"),
};

function emptySlot(label: string): ProfileCosmeticSlot {
  return {
    label,
    name: null,
    skinName: null,
    image: null,
    rarity: null,
  };
}

function formatJoinedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: IST_TIME_ZONE,
  }).format(date);
}

function humanizeWeaponId(id: string): string {
  return id
    .replace(/^weapon_/, "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toVipCard(
  membership: VipMembershipView | null,
  fallbackVip: boolean,
): ProfileVipCard {
  if (!membership) {
    return {
      active: fallbackVip,
      lifetime: false,
      expiresOn: null,
      daysRemaining: null,
      expiredOn: null,
      subline: null,
    };
  }

  const active = membership.hasActiveVip || membership.lifetime;
  const expiresAt = active && !membership.lifetime ? membership.overallExpiresAt : null;

  return {
    active,
    lifetime: membership.lifetime,
    expiresOn: expiresAt ? formatVipExpiryDate(expiresAt) : null,
    daysRemaining: expiresAt ? formatDaysRemaining(expiresAt) : null,
    expiredOn:
      !active && membership.lastExpiredAt
        ? formatVipExpiryDate(membership.lastExpiredAt)
        : null,
    subline: membership.summary?.subline ?? null,
  };
}

async function loadCatalog(): Promise<{
  knives: CatalogKnife[];
  gloves: CatalogGlove[];
}> {
  try {
    const [knives, gloves] = await Promise.all([getKnivesCatalog(), getGlovesCatalog()]);
    return { knives: knives.knives, gloves: gloves.gloves };
  } catch {
    return { knives: [], gloves: [] };
  }
}

function toSlot(
  label: string,
  item: EquippedItem | null,
  knives: CatalogKnife[],
  gloves: CatalogGlove[],
): ProfileCosmeticSlot {
  if (!item) return emptySlot(label);

  const knife = knives.find(
    (entry) => entry.id === item.weapon || entry.weapon === item.weapon,
  );
  const glove = gloves.find((entry) => entry.id === item.weapon);
  const name = knife?.displayName ?? glove?.displayName ?? humanizeWeaponId(item.weapon);
  const weaponRef = {
    id: item.weapon,
    defIndex: knife?.defIndex ?? glove?.defIndex,
    name,
  };
  const image =
    item.image ||
    resolveSkinPreview(weaponRef, item.paintKit, item.skinName) ||
    resolveDefaultWeaponImage(weaponRef) ||
    null;
  const skinName = item.skinName?.trim() || null;

  return {
    label,
    name,
    skinName: skinName && skinName.toLowerCase() !== name.toLowerCase() ? skinName : null,
    image,
    rarity: item.rarity,
  };
}

async function buildLoadoutPreview(
  state: UserLoadoutState | null,
): Promise<ProfileLoadoutPreview> {
  if (!state) return EMPTY_SLOTS;

  // One knife on the profile: CT when equipped, otherwise T.
  const knife = state.ct.knife ?? state.t.knife;
  const ctGloves = state.ct.gloves;
  const tGloves = state.t.gloves;
  if (!knife && !ctGloves && !tGloves) return EMPTY_SLOTS;

  const catalog = await loadCatalog();
  return {
    knife: toSlot("Knife", knife, catalog.knives, catalog.gloves),
    ctGloves: toSlot("CT Gloves", ctGloves, catalog.knives, catalog.gloves),
    tGloves: toSlot("T Gloves", tGloves, catalog.knives, catalog.gloves),
  };
}

export async function getProfileDashboard(input: {
  userId: string;
  steamId: string;
  fallbackVip: boolean;
  joinedAt: string;
}): Promise<ProfileDashboardExtras> {
  const [servers, loadoutResult] = await Promise.all([
    getGameServers().catch(() => []),
    getPlayerLoadout(input.steamId).catch(() => null),
  ]);

  const serverMeta: ProfileServerMeta[] = servers.map((server) => ({
    id: server.id,
    city: server.city,
    region: server.region,
    mode: server.mode,
  }));

  let membership: VipMembershipView | null = null;
  try {
    membership = await getUserVipMembership({
      userId: input.userId,
      eligibleServers: servers.map((server) => ({
        id: server.id,
        shortName: server.shortName || server.name,
        name: server.name,
      })),
    });
  } catch {
    membership = null;
  }

  const loadout = await buildLoadoutPreview(loadoutResult?.loadout ?? null);

  return {
    vip: toVipCard(membership, input.fallbackVip),
    loadout,
    serverMeta,
    joinedLabel: formatJoinedLabel(input.joinedAt),
  };
}
