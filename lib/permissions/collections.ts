import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import type {
  AuditLogDoc,
  PermissionDoc,
  RoleDoc,
  UserRoleDoc,
} from "@/types/permissions";

const PERMISSIONS = "permissions";
const ROLES = "roles";
const USER_ROLES = "user_roles";
const AUDIT_LOGS = "audit_logs";

let indexesReady: Promise<void> | null = null;

export async function permissionsCollection(): Promise<
  Collection<PermissionDoc>
> {
  const db = await getDb();
  return db.collection<PermissionDoc>(PERMISSIONS);
}

export async function rolesCollection(): Promise<Collection<RoleDoc>> {
  const db = await getDb();
  return db.collection<RoleDoc>(ROLES);
}

export async function userRolesCollection(): Promise<Collection<UserRoleDoc>> {
  const db = await getDb();
  return db.collection<UserRoleDoc>(USER_ROLES);
}

export async function auditLogsCollection(): Promise<Collection<AuditLogDoc>> {
  const db = await getDb();
  return db.collection<AuditLogDoc>(AUDIT_LOGS);
}

export async function ensurePermissionIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const [perms, roles, userRoles, audit] = await Promise.all([
        permissionsCollection(),
        rolesCollection(),
        userRolesCollection(),
        auditLogsCollection(),
      ]);

      await Promise.all([
        perms.createIndex({ code: 1 }, { unique: true }),
        roles.createIndex({ code: 1 }, { unique: true }),
        userRoles.createIndex({ userId: 1, active: 1 }),
        userRoles.createIndex({ userId: 1, roleCode: 1, active: 1 }),
        userRoles.createIndex({ expiresAt: 1 }),
        audit.createIndex({ timestamp: -1 }),
        audit.createIndex({ targetUserId: 1, timestamp: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}
