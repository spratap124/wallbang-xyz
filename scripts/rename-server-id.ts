/**
 * Rename a game server id and cascade to related collections.
 *
 * Usage:
 *   npm run rename:server -- server-1-mumbai retake-1-mumbai
 *   npm run rename:server -- --dry-run server-1-mumbai retake-1-mumbai
 */
import { MongoClient, type Collection, type Document } from "mongodb";

import type { GameServerDoc } from "@/types/servers";

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Args = {
  dryRun: boolean;
  fromId: string;
  toId: string;
};

function parseArgs(argv: string[]): Args {
  const dryRun = argv.includes("--dry-run");
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const fromId = positional[0]?.trim() ?? "";
  const toId = positional[1]?.trim() ?? "";
  if (!fromId || !toId) {
    throw new Error("Usage: npm run rename:server -- [--dry-run] <fromId> <toId>");
  }
  if (!ID_RE.test(fromId) || !ID_RE.test(toId)) {
    throw new Error("Ids must use lowercase letters, numbers, and hyphens.");
  }
  if (fromId === toId) {
    throw new Error("fromId and toId must differ.");
  }
  return { dryRun, fromId, toId };
}

async function remapServerIdInCollection(
  col: Collection<Document>,
  fromId: string,
  toId: string,
  dryRun: boolean,
): Promise<number> {
  let updated = 0;

  const serverIdCount = await col.countDocuments({ serverId: fromId });
  if (serverIdCount > 0) {
    if (!dryRun) {
      await col.updateMany({ serverId: fromId }, { $set: { serverId: toId } });
    }
    updated += serverIdCount;
  }

  const targetCount = await col.countDocuments({ targetServerId: fromId });
  if (targetCount > 0) {
    if (!dryRun) {
      await col.updateMany(
        { targetServerId: fromId },
        { $set: { targetServerId: toId } },
      );
    }
    updated += targetCount;
  }

  const arrayCount = await col.countDocuments({ serverIds: fromId });
  if (arrayCount > 0) {
    if (dryRun) {
      updated += arrayCount;
    } else {
      const cursor = col.find({ serverIds: fromId });
      for await (const doc of cursor) {
        const serverIds = (doc.serverIds as string[]).map((sid) =>
          sid === fromId ? toId : sid,
        );
        await col.updateOne({ _id: doc._id }, { $set: { serverIds } });
        updated += 1;
      }
    }
  }

  return updated;
}

async function main(): Promise<void> {
  const { dryRun, fromId, toId } = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "wallbang";
  if (!uri) throw new Error("MONGODB_URI is required.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const col = db.collection<GameServerDoc>("game_servers");
    const existing = await col.findOne({ id: fromId });
    if (!existing) {
      throw new Error(`Server not found: ${fromId}`);
    }
    const conflict = await col.findOne({ id: toId });
    if (conflict) {
      throw new Error(`Target id already exists: ${toId}`);
    }

    console.log(
      dryRun ? "[dry-run]" : "[apply]",
      `Renaming ${fromId} -> ${toId}`,
    );

    if (!dryRun) {
      const now = new Date();
      const newDoc = { ...existing, _id: toId, id: toId, updatedAt: now };
      await col.insertOne(newDoc);
      await col.deleteOne({ id: fromId });
    }

    const statusCol = db.collection<{ _id: string }>("serverStatus");
    const statusDoc = await statusCol.findOne({ _id: fromId });
    if (statusDoc) {
      console.log("serverStatus: 1");
      if (!dryRun) {
        await statusCol.insertOne({ ...statusDoc, _id: toId });
        await statusCol.deleteOne({ _id: fromId });
      }
    }

    for (const name of [
      "player_sessions",
      "player_presence",
      "rating_history",
      "payments",
      "vip_history",
      "audit_logs",
    ]) {
      const count = await remapServerIdInCollection(
        db.collection(name),
        fromId,
        toId,
        dryRun,
      );
      if (count > 0) console.log(`${name}: ${count}`);
    }

    console.log(dryRun ? "Dry run complete." : "Rename complete.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
