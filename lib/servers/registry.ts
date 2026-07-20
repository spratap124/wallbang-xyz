import "server-only";

import type { Collection, Filter } from "mongodb";

import { servers as seedServers, type GameServer } from "@/config/servers";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import type {
  CreateGameServerInput,
  GameServerAdminView,
  GameServerDoc,
  RegisteredServer,
  UpdateGameServerInput,
} from "@/types/servers";

export type { GameServerAdminView };

const COLLECTION = "game_servers";
const CACHE_TTL_MS = 20_000;

let indexesReady: Promise<void> | null = null;
let cache:
  | { at: number; includeDisabled: boolean; servers: RegisteredServer[] }
  | null = null;

async function collection(): Promise<Collection<GameServerDoc>> {
  const db = await getDb();
  return db.collection<GameServerDoc>(COLLECTION);
}

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await collection();
      await Promise.all([
        col.createIndex({ id: 1 }, { unique: true }),
        col.createIndex({ enabled: 1, featured: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

function seedToDoc(seed: GameServer, now: Date): GameServerDoc {
  return {
    _id: seed.id,
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    mode: seed.mode,
    map: seed.map,
    region: seed.region,
    city: seed.city,
    host: seed.host,
    port: seed.port,
    tickRate: seed.tickRate,
    maxPlayers: seed.maxPlayers,
    maxPlayersOverride: seed.maxPlayersOverride ?? null,
    pingUrl: seed.pingUrl ?? null,
    status: seed.status,
    featured: Boolean(seed.featured),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function docToRegistered(doc: GameServerDoc): RegisteredServer {
  return {
    id: doc.id,
    name: doc.name,
    shortName: doc.shortName,
    mode: doc.mode,
    map: doc.map,
    region: doc.region,
    city: doc.city,
    host: doc.host,
    port: doc.port,
    tickRate: doc.tickRate,
    players: 0,
    maxPlayers: doc.maxPlayers,
    maxPlayersOverride: doc.maxPlayersOverride ?? undefined,
    pingMs: 0,
    pingUrl: doc.pingUrl ?? null,
    status: doc.status,
    featured: doc.featured,
    enabled: doc.enabled,
  };
}

function seedAsRegistered(): RegisteredServer[] {
  return seedServers.map((s) => ({
    ...s,
    featured: Boolean(s.featured),
    enabled: true,
  }));
}

export function invalidateGameServersCache(): void {
  cache = null;
}

/** Insert seed config rows only when the collection is empty. */
export async function ensureGameServersSeeded(): Promise<void> {
  if (!isMongoConfigured()) return;
  await ensureIndexes();
  const col = await collection();
  const count = await col.countDocuments({}, { limit: 1 });
  if (count > 0) return;

  const now = new Date();
  const docs = seedServers.map((s) => seedToDoc(s, now));
  if (docs.length === 0) return;
  await col.insertMany(docs);
  invalidateGameServersCache();
}

async function loadFromDb(
  includeDisabled: boolean,
): Promise<RegisteredServer[]> {
  await ensureIndexes();
  await ensureGameServersSeeded();
  const col = await collection();
  const filter: Filter<GameServerDoc> = includeDisabled
    ? {}
    : { enabled: true };
  const docs = await col.find(filter).sort({ featured: -1, id: 1 }).toArray();
  if (docs.length === 0) {
    // Seed somehow empty — fall back to static config for enabled-only reads.
    const seed = seedAsRegistered();
    return includeDisabled ? seed : seed.filter((s) => s.enabled);
  }
  return docs.map(docToRegistered);
}

export async function getGameServers(options?: {
  includeDisabled?: boolean;
}): Promise<RegisteredServer[]> {
  const includeDisabled = options?.includeDisabled ?? false;

  if (
    cache &&
    cache.includeDisabled === includeDisabled &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.servers;
  }

  let servers: RegisteredServer[];
  if (!isMongoConfigured()) {
    const seed = seedAsRegistered();
    servers = includeDisabled ? seed : seed.filter((s) => s.enabled);
  } else {
    try {
      servers = await loadFromDb(includeDisabled);
    } catch {
      const seed = seedAsRegistered();
      servers = includeDisabled ? seed : seed.filter((s) => s.enabled);
    }
  }

  cache = { at: Date.now(), includeDisabled, servers };
  return servers;
}

export async function getGameServerById(
  id: string,
  options?: { includeDisabled?: boolean },
): Promise<RegisteredServer | null> {
  const list = await getGameServers({
    includeDisabled: options?.includeDisabled ?? true,
  });
  return list.find((s) => s.id === id) ?? null;
}

export async function getFeaturedRegisteredServer(): Promise<RegisteredServer> {
  const list = await getGameServers();
  return list.find((s) => s.featured) ?? list[0] ?? seedAsRegistered()[0]!;
}

export async function getPrimaryRegisteredServer(
  live: { id: string; online: boolean; players?: number | null }[] = [],
): Promise<RegisteredServer> {
  const list = await getGameServers();
  const featured =
    list.find((s) => s.featured) ?? list[0] ?? seedAsRegistered()[0]!;
  if (live.length === 0) return featured;

  const liveById = new Map(live.map((s) => [s.id, s]));
  const featuredLive = liveById.get(featured.id);
  if (featuredLive?.online) return featured;

  const online = list
    .map((def) => ({ def, live: liveById.get(def.id) }))
    .filter((row) => row.live?.online);

  if (online.length === 0) return featured;

  online.sort(
    (a, b) => (b.live?.players ?? 0) - (a.live?.players ?? 0),
  );
  return online[0]!.def;
}

export async function listGameServersAdmin(): Promise<GameServerAdminView[]> {
  await ensureIndexes();
  await ensureGameServersSeeded();
  const col = await collection();
  const docs = await col.find({}).sort({ featured: -1, id: 1 }).toArray();
  return docs.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidServerId(id: string): boolean {
  return ID_RE.test(id) && id.length >= 2 && id.length <= 64;
}

export async function createGameServer(
  input: CreateGameServerInput,
): Promise<GameServerAdminView> {
  await ensureIndexes();
  await ensureGameServersSeeded();
  const col = await collection();

  if (!isValidServerId(input.id)) {
    throw new Error(
      "Invalid server id. Use lowercase letters, numbers, and hyphens.",
    );
  }

  const existing = await col.findOne({ id: input.id });
  if (existing) {
    throw new Error("A server with this id already exists.");
  }

  const now = new Date();
  const featured = Boolean(input.featured);
  if (featured) {
    await col.updateMany({ featured: true }, { $set: { featured: false } });
  }

  const doc: GameServerDoc = {
    _id: input.id,
    id: input.id,
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    mode: input.mode.trim(),
    map: input.map.trim() || "de_mirage",
    region: input.region.trim(),
    city: input.city.trim(),
    host: input.host.trim(),
    port: input.port,
    tickRate: input.tickRate ?? 128,
    maxPlayers: input.maxPlayers,
    maxPlayersOverride: input.maxPlayersOverride ?? null,
    pingUrl: input.pingUrl ?? null,
    status: input.status ?? "live",
    featured,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  invalidateGameServersCache();
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function updateGameServer(
  id: string,
  input: UpdateGameServerInput,
): Promise<GameServerAdminView | null> {
  await ensureIndexes();
  const col = await collection();
  const existing = await col.findOne({ id });
  if (!existing) return null;

  if (input.featured === true) {
    await col.updateMany(
      { id: { $ne: id }, featured: true },
      { $set: { featured: false, updatedAt: new Date() } },
    );
  }

  const $set: Partial<GameServerDoc> = { updatedAt: new Date() };
  if (input.name !== undefined) $set.name = input.name.trim();
  if (input.shortName !== undefined) $set.shortName = input.shortName.trim();
  if (input.mode !== undefined) $set.mode = input.mode.trim();
  if (input.map !== undefined) $set.map = input.map.trim();
  if (input.region !== undefined) $set.region = input.region.trim();
  if (input.city !== undefined) $set.city = input.city.trim();
  if (input.host !== undefined) $set.host = input.host.trim();
  if (input.port !== undefined) $set.port = input.port;
  if (input.tickRate !== undefined) $set.tickRate = input.tickRate;
  if (input.maxPlayers !== undefined) $set.maxPlayers = input.maxPlayers;
  if (input.maxPlayersOverride !== undefined) {
    $set.maxPlayersOverride = input.maxPlayersOverride;
  }
  if (input.pingUrl !== undefined) $set.pingUrl = input.pingUrl;
  if (input.status !== undefined) $set.status = input.status;
  if (input.featured !== undefined) $set.featured = input.featured;
  if (input.enabled !== undefined) $set.enabled = input.enabled;

  await col.updateOne({ id }, { $set });
  invalidateGameServersCache();

  const updated = await col.findOne({ id });
  if (!updated) return null;
  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/** Soft-disable: hide from public list, keep for stats/history. */
export async function disableGameServer(
  id: string,
): Promise<GameServerAdminView | null> {
  return updateGameServer(id, { enabled: false, featured: false });
}
