/**
 * Remove dummy users and related role / audit rows created by seed:dummy-users.
 *
 * Usage:
 *   npm run remove:dummy-users
 */
import { MongoClient } from "mongodb";

import {
  DUMMY_SEED_TAG,
  DUMMY_STEAM_IDS,
} from "./fixtures/dummy-users";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "wallbang";

  if (!uri) {
    console.error(
      "MONGODB_URI is not set. Copy .env.example to .env.local first.",
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const users = db.collection("users");
  const userRoles = db.collection("user_roles");
  const audit = db.collection("audit_logs");

  const dummyUsers = await users
    .find({
      $or: [{ seedTag: DUMMY_SEED_TAG }, { steamId: { $in: DUMMY_STEAM_IDS } }],
    })
    .toArray();

  const userIds = dummyUsers.map((u) => u._id as string);

  const rolesDeleted = await userRoles.deleteMany({
    $or: [
      { seedTag: DUMMY_SEED_TAG },
      ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
    ],
  });

  const auditDeleted = await audit.deleteMany({
    $or: [
      { seedTag: DUMMY_SEED_TAG },
      ...(userIds.length > 0 ? [{ targetUserId: { $in: userIds } }] : []),
      { targetSteamId: { $in: DUMMY_STEAM_IDS } },
    ],
  });

  const usersDeleted = await users.deleteMany({
    $or: [{ seedTag: DUMMY_SEED_TAG }, { steamId: { $in: DUMMY_STEAM_IDS } }],
  });

  await client.close();

  console.log(
    `Removed dummy RBAC fixtures from "${dbName}":\n` +
      `  users:      ${usersDeleted.deletedCount}\n` +
      `  user_roles: ${rolesDeleted.deletedCount}\n` +
      `  audit_logs: ${auditDeleted.deletedCount}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
