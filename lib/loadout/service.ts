import "server-only";

import type { AuthUser } from "@/types/auth";
import type { UserLoadoutState } from "@/types/loadout";
import type {
  GameLoadout,
  PlayerLoadoutResponse,
} from "@/types/player-loadout";
import {
  emptyUserLoadout,
  sanitizeUserLoadout,
  toGameLoadout,
} from "@/types/player-loadout";

import {
  ensureLoadoutIndexes,
  playerLoadoutsCollection,
} from "@/lib/loadout/player-collections";
import {
  mergeGameLoadoutPatch,
  resolveLoadoutUserId,
} from "@/lib/loadout/game-sync";
import type { PatchGameLoadoutInput } from "@/lib/validations/game-loadout";

function toResponse(
  steamId: string,
  state: UserLoadoutState,
  updatedAt: Date,
): PlayerLoadoutResponse {
  return {
    loadout: state,
    game: toGameLoadout(state, updatedAt),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function getPlayerLoadout(
  steamId: string,
): Promise<PlayerLoadoutResponse> {
  await ensureLoadoutIndexes();
  const col = await playerLoadoutsCollection();
  const doc = await col.findOne({ steamId });
  if (!doc) {
    const empty = emptyUserLoadout();
    const now = new Date(0);
    return toResponse(steamId, empty, now);
  }
  return toResponse(doc.steamId, doc.loadout, doc.updatedAt);
}

/** Lean game projection for the CS2 plugin player endpoint. */
export async function getGameLoadoutForPlayer(
  steamId: string,
): Promise<GameLoadout | null> {
  await ensureLoadoutIndexes();
  const col = await playerLoadoutsCollection();
  const doc = await col.findOne({ steamId });
  if (!doc) return null;
  return toGameLoadout(doc.loadout, doc.updatedAt);
}

export async function savePlayerLoadout(
  user: AuthUser,
  input: UserLoadoutState,
): Promise<PlayerLoadoutResponse> {
  await ensureLoadoutIndexes();
  const col = await playerLoadoutsCollection();
  const loadout = sanitizeUserLoadout(input);
  const updatedAt = new Date();

  await col.updateOne(
    { steamId: user.steamId },
    {
      $set: {
        steamId: user.steamId,
        userId: user.id,
        loadout,
        updatedAt,
      },
    },
    { upsert: true },
  );

  return toResponse(user.steamId, loadout, updatedAt);
}

/** CS2 plugin → merge in-game selections into the player's saved loadout. */
export async function patchPlayerLoadoutFromGame(
  steamId: string,
  patch: PatchGameLoadoutInput,
): Promise<PlayerLoadoutResponse> {
  await ensureLoadoutIndexes();
  const col = await playerLoadoutsCollection();
  const existing = await col.findOne({ steamId });
  const base = existing?.loadout ?? emptyUserLoadout();
  const loadout = await mergeGameLoadoutPatch(base, patch);
  const updatedAt = new Date();
  const userId = await resolveLoadoutUserId(steamId);

  await col.updateOne(
    { steamId },
    {
      $set: {
        steamId,
        userId,
        loadout,
        updatedAt,
      },
    },
    { upsert: true },
  );

  return toResponse(steamId, loadout, updatedAt);
}
