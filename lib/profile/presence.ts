import "server-only";

import {
  getConnectCommand,
  getSteamConnectUrl,
  servers,
} from "@/config/servers";
import { getLiveServers } from "@/lib/servers/status";
import {
  ensureProfileIndexes,
  playerPresenceCollection,
  presenceStaleMs,
} from "@/lib/profile/collections";
import type { CurrentServerInfo, PlayerPresenceDoc } from "@/types/profile";

function resolveServerConfig(serverId: string) {
  return servers.find((s) => s.id === serverId) ?? null;
}

export async function upsertPlayerPresence(input: {
  steamId: string;
  serverId: string;
  serverName?: string;
  map?: string | null;
}): Promise<PlayerPresenceDoc> {
  await ensureProfileIndexes();
  const def = resolveServerConfig(input.serverId);
  const now = new Date();
  const doc: PlayerPresenceDoc = {
    _id: input.steamId,
    steamId: input.steamId,
    serverId: input.serverId,
    serverName: input.serverName?.trim() || def?.name || input.serverId,
    map: input.map ?? def?.map ?? null,
    updatedAt: now,
  };

  const col = await playerPresenceCollection();
  await col.replaceOne({ steamId: input.steamId }, doc, { upsert: true });
  return doc;
}

export async function clearPlayerPresence(steamId: string): Promise<void> {
  await ensureProfileIndexes();
  const col = await playerPresenceCollection();
  await col.deleteOne({ steamId });
}

export async function clearServerPresence(serverId: string): Promise<void> {
  await ensureProfileIndexes();
  const col = await playerPresenceCollection();
  await col.deleteMany({ serverId });
}

export async function getPlayerPresence(
  steamId: string,
): Promise<PlayerPresenceDoc | null> {
  await ensureProfileIndexes();
  const col = await playerPresenceCollection();
  const doc = await col.findOne({ steamId });
  if (!doc) return null;
  if (Date.now() - doc.updatedAt.getTime() > presenceStaleMs()) {
    return null;
  }
  return doc;
}

/** Merge plugin presence with live A2S counts for the profile card. */
export async function resolveCurrentServer(
  steamId: string,
): Promise<CurrentServerInfo | null> {
  const presence = await getPlayerPresence(steamId);
  if (!presence) return null;

  const def = resolveServerConfig(presence.serverId);
  let players: number | null = null;
  let maxPlayers: number | null = def?.maxPlayersOverride ?? def?.maxPlayers ?? null;
  let map = presence.map;
  let serverName = presence.serverName;

  try {
    const live = await getLiveServers();
    const match = live.find((s) => s.id === presence.serverId);
    if (match) {
      players = match.players;
      maxPlayers = match.maxPlayers;
      map = match.map ?? map;
      if (match.online) serverName = match.name;
    }
  } catch {
    // Presence alone is enough if A2S is down.
  }

  return {
    serverId: presence.serverId,
    serverName,
    map,
    players,
    maxPlayers,
    connectUrl: def ? getSteamConnectUrl(def) : null,
    ip: def ? getConnectCommand(def).replace(/^connect\s+/i, "") : null,
    updatedAt: presence.updatedAt.toISOString(),
  };
}
