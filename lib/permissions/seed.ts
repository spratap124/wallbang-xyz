import "server-only";

import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  PERMISSION_META,
  ROLE_CODES,
  ROLE_NAMES,
} from "@/lib/permissions/constants";
import {
  ensurePermissionIndexes,
  permissionsCollection,
  rolesCollection,
} from "@/lib/permissions/collections";

let seedPromise: Promise<void> | null = null;

/** Idempotent upsert of catalog permissions and roles. */
export async function seedPermissionsCatalog(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ensurePermissionIndexes();
      const now = new Date();
      const perms = await permissionsCollection();
      const roles = await rolesCollection();

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
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
