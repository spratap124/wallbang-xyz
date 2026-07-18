import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type { SteamPlayerSummary } from "@/lib/auth/steam-api";
import type { AuthUser } from "@/types/auth";

const COLLECTION = "users";

export type UserDoc = {
  _id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
};

let indexesReady: Promise<void> | null = null;

async function users(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>(COLLECTION);
}

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await users();
      await col.createIndex({ steamId: 1 }, { unique: true });
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

function toAuthUser(doc: UserDoc): AuthUser {
  return {
    id: doc._id,
    steamId: doc.steamId,
    personaName: doc.personaName,
    avatarUrl: doc.avatarUrl,
    profileUrl: doc.profileUrl,
  };
}

/** Create or refresh a Steam-linked account after successful OpenID. */
export async function upsertSteamUser(
  profile: SteamPlayerSummary,
): Promise<AuthUser> {
  await ensureIndexes();
  const col = await users();
  const now = new Date();

  const existing = await col.findOne({ steamId: profile.steamId });

  if (existing) {
    const updated: UserDoc = {
      ...existing,
      personaName: profile.personaName,
      avatarUrl: profile.avatarUrl,
      profileUrl: profile.profileUrl,
      updatedAt: now,
      lastLoginAt: now,
    };
    await col.replaceOne({ _id: existing._id }, updated);
    return toAuthUser(updated);
  }

  const doc: UserDoc = {
    _id: crypto.randomUUID(),
    steamId: profile.steamId,
    personaName: profile.personaName,
    avatarUrl: profile.avatarUrl,
    profileUrl: profile.profileUrl,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await col.insertOne(doc);
  return toAuthUser(doc);
}
