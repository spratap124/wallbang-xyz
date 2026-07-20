import "server-only";

import {
  getConnectCommand,
  getSteamConnectUrl,
} from "@/config/servers";
import {
  ensureProfileIndexes,
  playerPresenceCollection,
  presenceStaleMs,
} from "@/lib/profile/collections";
import {
  endPlayerSession,
  endServerSessions,
  touchPlayerSession,
} from "@/lib/profile/sessions";
import { getGameServerById } from "@/lib/servers/registry";
import { getLiveServers } from "@/lib/servers/status";
import type { CurrentServerInfo, PlayerPresenceDoc } from "@/types/profile";

export async function upsertPlayerPresence(input: {
  steamId: string;
  serverId: string;
  serverName?: string;
  map?: string | null;
}): Promise<PlayerPresenceDoc> {
  await ensureProfileIndexes();
  const def = await getGameServerById(input.serverId, {
    includeDisabled: true,
  });
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
  await touchPlayerSession({
    steamId: doc.steamId,
    serverId: doc.serverId,
    serverName: doc.serverName,
    map: doc.map,
  });
  return doc;
}

export async function clearPlayerPresence(
  steamId: string,
  serverId?: string,
): Promise<void> {
  await ensureProfileIndexes();
  const col = await playerPresenceCollection();
  await col.deleteOne(serverId ? { steamId, serverId } : { steamId });
  await endPlayerSession(steamId, serverId);
}

export async function clearServerPresence(serverId: string): Promise<void> {
  await ensureProfileIndexes();
  const col = await playerPresenceCollection();
  await col.deleteMany({ serverId });
  await endServerSessions(serverId);
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

  const def = await getGameServerById(presence.serverId, {
    includeDisabled: true,
  });
  let players: number | null = null;
  let maxPlayers: number | null =
    def?.maxPlayersOverride ?? def?.maxPlayers ?? null;
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
