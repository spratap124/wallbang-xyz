import "server-only";

import type { AnyBulkWriteOperation } from "mongodb";

import { getServerAddress, type GameServer } from "@/config/servers";
import { queryA2SInfo } from "@/lib/a2s";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import { getGameServers } from "@/lib/servers/registry";
import type { RegisteredServer } from "@/types/servers";
import type { ServerSummary } from "@/lib/servers/types";

const COLLECTION = "serverStatus";

/**
 * Cached snapshot document. `lastPolled` drives both freshness (staleness
 * check below) and the Atlas TTL index that auto-expires servers we stop
 * polling — important once heartbeat push replaces A2S polling.
 */
type StatusDoc = {
  _id: string;
  online: boolean;
  name?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  bots?: number;
  pingMs?: number | null;
  lastPolled: Date;
};

let indexesReady: Promise<void> | null = null;

function snapshotTtlMs(): number {
  const secs = Number(process.env.SERVER_STATUS_TTL_SECONDS ?? 15);
  return (Number.isFinite(secs) && secs > 0 ? secs : 15) * 1000;
}

function docTtlSeconds(): number {
  const secs = Number(process.env.SERVER_STATUS_DOC_TTL_SECONDS ?? 120);
  return Number.isFinite(secs) && secs > 0 ? secs : 120;
}

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await db
        .collection<StatusDoc>(COLLECTION)
        .createIndex({ lastPolled: 1 }, { expireAfterSeconds: docTtlSeconds() });
    })().catch((err) => {
      // Reset so a later request can retry index creation.
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

async function pollServer(def: GameServer): Promise<StatusDoc> {
  const result = await queryA2SInfo(def.host, def.port);
  const base: StatusDoc = { _id: def.id, online: false, lastPolled: new Date() };

  if (!result.online) {
    return base;
  }

  return {
    ...base,
    online: true,
    name: result.name,
    map: result.map,
    players: result.players,
    maxPlayers: result.maxPlayers,
    bots: result.bots,
    pingMs: result.pingMs,
  };
}

function toSummary(def: RegisteredServer, doc: StatusDoc | null): ServerSummary {
  const online = doc?.online ?? false;

  return {
    id: def.id,
    name: online && doc?.name ? doc.name : def.name,
    shortName: def.shortName,
    city: def.city,
    ip: getServerAddress(def),
    region: def.region,
    mode: def.mode,
    online,
    map: doc?.map ?? def.map ?? null,
    players: online ? (doc?.players ?? null) : null,
    // A2S reports the raw slot count (e.g. 64) — the registry override wins.
    maxPlayers: def.maxPlayersOverride ?? doc?.maxPlayers ?? def.maxPlayers ?? null,
    pingUrl: def.pingUrl ?? null,
    lastSeen: doc?.lastPolled ? doc.lastPolled.toISOString() : null,
    featured: def.featured,
    // Diagnostic only — Vercel→VPS latency, not the user's ping.
    backendPingMs: online ? (doc?.pingMs ?? null) : null,
  };
}

/**
 * No-cache path for local dev / missing MONGODB_URI: query every registered
 * server directly. Keeps the feature usable before Atlas is wired up.
 */
async function getLiveServersDirect(
  fleet: RegisteredServer[],
): Promise<ServerSummary[]> {
  const docs = await Promise.all(fleet.map(pollServer));
  const byId = new Map(docs.map((doc) => [doc._id, doc]));
  return fleet.map((def) => toSummary(def, byId.get(def.id) ?? null));
}

/**
 * Lazy refresh with a shared Mongo snapshot:
 *   1. read cached docs, 2. re-poll any missing/stale ones over A2S,
 *   3. upsert refreshed docs, 4. return the merged list.
 * At most one A2S query per server per TTL window regardless of traffic.
 */
export async function getLiveServers(): Promise<ServerSummary[]> {
  const fleet = await getGameServers();

  if (!isMongoConfigured()) {
    return getLiveServersDirect(fleet);
  }

  try {
    await ensureIndexes();
    const db = await getDb();
    const collection = db.collection<StatusDoc>(COLLECTION);

    const ids = fleet.map((s) => s.id);
    const existing = await collection.find({ _id: { $in: ids } }).toArray();
    const byId = new Map(existing.map((doc) => [doc._id, doc]));

    const now = Date.now();
    const ttl = snapshotTtlMs();
    const stale = fleet.filter((def) => {
      const doc = byId.get(def.id);
      return !doc || now - doc.lastPolled.getTime() > ttl;
    });

    if (stale.length > 0) {
      const refreshed = await Promise.all(stale.map(pollServer));
      for (const doc of refreshed) {
        byId.set(doc._id, doc);
      }

      const ops: AnyBulkWriteOperation<StatusDoc>[] = refreshed.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await collection.bulkWrite(ops);
    }

    return fleet.map((def) => toSummary(def, byId.get(def.id) ?? null));
  } catch {
    // Never let a cache/DB hiccup take down the public list — fall back to A2S.
    return getLiveServersDirect(fleet);
  }
}
