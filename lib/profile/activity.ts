import "server-only";

import { badgeLabel, ROLE_TO_BADGE } from "@/lib/profile/badges";
import {
  ensureProfileIndexes,
  playerActivityCollection,
  playerBadgesCollection,
} from "@/lib/profile/collections";
import type {
  BadgeType,
  PlayerActivityDoc,
  PlayerActivityType,
  PlayerBadgeDoc,
} from "@/types/profile";
import type { RoleCode } from "@/types/permissions";

export async function recordPlayerActivity(input: {
  steamId: string;
  type: PlayerActivityType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<PlayerActivityDoc> {
  await ensureProfileIndexes();
  const doc: PlayerActivityDoc = {
    _id: crypto.randomUUID(),
    steamId: input.steamId,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  };
  const col = await playerActivityCollection();
  await col.insertOne(doc);
  return doc;
}

export async function grantPlayerBadge(input: {
  steamId: string;
  badgeType: BadgeType;
  grantedBy: string | null;
  metadata?: Record<string, unknown> | null;
  recordActivity?: boolean;
}): Promise<{ badge: PlayerBadgeDoc; created: boolean }> {
  await ensureProfileIndexes();
  const col = await playerBadgesCollection();
  const existing = await col.findOne({
    steamId: input.steamId,
    badgeType: input.badgeType,
  });
  if (existing) {
    return { badge: existing, created: false };
  }

  const now = new Date();
  const doc: PlayerBadgeDoc = {
    _id: crypto.randomUUID(),
    steamId: input.steamId,
    badgeType: input.badgeType,
    grantedAt: now,
    grantedBy: input.grantedBy,
    metadata: input.metadata ?? null,
  };
  await col.insertOne(doc);

  if (input.recordActivity !== false) {
    const label = badgeLabel(input.badgeType);
    await recordPlayerActivity({
      steamId: input.steamId,
      type: input.badgeType === "VIP" ? "got_vip" : "got_badge",
      title:
        input.badgeType === "VIP" ? "Got VIP" : `Earned ${label} badge`,
      description: `Unlocked the ${label} badge.`,
      metadata: { badgeType: input.badgeType },
    });
  }

  return { badge: doc, created: true };
}

/** Persist a badge when an RBAC role that maps to a badge is granted. */
export async function syncBadgeFromRole(input: {
  steamId: string;
  roleCode: RoleCode;
  grantedBy: string | null;
}): Promise<void> {
  const badgeType = ROLE_TO_BADGE[input.roleCode];
  if (!badgeType) return;
  await grantPlayerBadge({
    steamId: input.steamId,
    badgeType,
    grantedBy: input.grantedBy,
    metadata: { sourceRole: input.roleCode },
  });
}
