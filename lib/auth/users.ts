import "server-only";

import type { Collection, Filter } from "mongodb";

import { getDb } from "@/lib/mongo";
import type { SteamPlayerSummary } from "@/lib/auth/steam-api";
import type { AuthUser } from "@/types/auth";
import type { RoleCode } from "@/types/permissions";

const COLLECTION = "users";

export type UserDoc = {
  _id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  /** Discord snowflake when the player has linked Discord for the launch offer. */
  discordUserId?: string | null;
  discordUsername?: string | null;
  discordLinkedAt?: Date | null;
  /** Denormalized highest active role for display. */
  role: RoleCode;
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
      await col.createIndex({ personaName: 1 });
      await col.createIndex(
        { discordUserId: 1 },
        {
          unique: true,
          // partialFilterExpression alone — MongoDB rejects sparse + partial together.
          partialFilterExpression: {
            discordUserId: { $type: "string" },
          },
        },
      );
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

export function toAuthUser(doc: UserDoc): AuthUser {
  return {
    id: doc._id,
    steamId: doc.steamId,
    personaName: doc.personaName,
    avatarUrl: doc.avatarUrl,
    profileUrl: doc.profileUrl,
  };
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  await ensureIndexes();
  const col = await users();
  return col.findOne({ _id: id });
}

export async function findUserBySteamId(
  steamId: string,
): Promise<UserDoc | null> {
  await ensureIndexes();
  const col = await users();
  return col.findOne({ steamId });
}

export async function findUserByDiscordUserId(
  discordUserId: string,
): Promise<UserDoc | null> {
  await ensureIndexes();
  const col = await users();
  return col.findOne({ discordUserId });
}

/**
 * Link a Discord identity to a Steam user.
 * Fails if this Discord account is already linked to a different WallBang user.
 */
export async function linkDiscordAccount(input: {
  userId: string;
  discordUserId: string;
  discordUsername: string;
}): Promise<UserDoc> {
  await ensureIndexes();
  const col = await users();
  const now = new Date();

  const existing = await col.findOne({
    discordUserId: input.discordUserId,
  });
  if (existing && existing._id !== input.userId) {
    throw new Error(
      "That Discord account is already linked to another WallBang user.",
    );
  }

  const result = await col.findOneAndUpdate(
    { _id: input.userId },
    {
      $set: {
        discordUserId: input.discordUserId,
        discordUsername: input.discordUsername,
        discordLinkedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new Error("User not found.");
  }
  return result;
}

export async function findUsersBySteamIds(
  steamIds: string[],
): Promise<UserDoc[]> {
  const ids = [...new Set(steamIds.filter(Boolean))];
  if (ids.length === 0) return [];
  await ensureIndexes();
  const col = await users();
  return col.find({ steamId: { $in: ids } }).toArray();
}

export async function updateUserDisplayRole(
  userId: string,
  role: RoleCode,
): Promise<void> {
  await ensureIndexes();
  const col = await users();
  await col.updateOne(
    { _id: userId },
    { $set: { role, updatedAt: new Date() } },
  );
}

export async function searchUsers(
  query: string,
  limit = 25,
): Promise<UserDoc[]> {
  await ensureIndexes();
  const col = await users();
  const q = query.trim();
  if (!q) return [];

  const filter: Filter<UserDoc> = /^\d{17}$/.test(q)
    ? { steamId: q }
    : {
        $or: [
          { steamId: { $regex: q, $options: "i" } },
          { personaName: { $regex: q, $options: "i" } },
        ],
      };

  return col.find(filter).sort({ lastLoginAt: -1 }).limit(limit).toArray();
}

/** List users for admin directory (newest login first). */
export async function listUsers(limit = 200): Promise<UserDoc[]> {
  await ensureIndexes();
  const col = await users();
  const capped = Math.min(Math.max(limit, 1), 500);
  return col.find({}).sort({ lastLoginAt: -1 }).limit(capped).toArray();
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
      role: existing.role ?? "USER",
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
    role: "USER",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await col.insertOne(doc);
  return toAuthUser(doc);
}
