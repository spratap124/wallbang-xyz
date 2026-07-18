import "server-only";

import { MongoClient, type Db } from "mongodb";

/**
 * Cached MongoClient for serverless.
 *
 * Serverless functions reuse warm containers, so we memoize the connection
 * promise on `globalThis` to avoid opening a new pool on every invocation.
 * A small pool keeps us well under Atlas connection limits across regions.
 */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "wallbang";

declare global {
  var __wallbangMongo: Promise<MongoClient> | undefined;
}

function createClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
  });

  return client.connect();
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__wallbangMongo) {
    globalThis.__wallbangMongo = createClient();
  }
  return globalThis.__wallbangMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

/** True when a Mongo connection string is configured. */
export function isMongoConfigured(): boolean {
  return Boolean(uri);
}
