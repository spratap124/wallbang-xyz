/**
 * Idempotent seed of permissions + roles catalogs.
 *
 * Usage:
 *   npm run seed:permissions
 *
 * Requires MONGODB_URI (loads via Node --env-file=.env.local).
 */
import { MongoClient } from "mongodb";

import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  PERMISSION_META,
  ROLE_CODES,
  ROLE_NAMES,
} from "../lib/permissions/constants";

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
  const now = new Date();

  const perms = db.collection("permissions");
  const roles = db.collection("roles");

  await perms.createIndex({ code: 1 }, { unique: true });
  await roles.createIndex({ code: 1 }, { unique: true });

  for (const code of PERMISSION_CODES) {
    const meta = PERMISSION_META[code];
    await perms.updateOne(
      { code },
      {
        $set: {
          name: meta.name,
          description: meta.description,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          code,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  for (const code of ROLE_CODES) {
    await roles.updateOne(
      { code },
      {
        $set: {
          name: ROLE_NAMES[code],
          permissions: DEFAULT_ROLE_PERMISSIONS[code],
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          code,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  await client.close();
  console.log(`Seeded permissions and roles into database "${dbName}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
