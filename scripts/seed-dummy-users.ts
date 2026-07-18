/**
 * Seed dummy users + role assignments for RBAC admin testing.
 *
 * Usage:
 *   npm run seed:dummy-users
 *
 * Cleanup:
 *   npm run remove:dummy-users
 */
import { MongoClient } from "mongodb";

import { ROLE_PRIORITY } from "../lib/permissions/constants";
import type { RoleCode } from "../types/permissions";
import {
  DUMMY_SEED_TAG,
  DUMMY_USERS,
} from "./fixtures/dummy-users";

function highestRole(roles: RoleCode[]): RoleCode {
  if (roles.length === 0) return "USER";
  return roles.reduce((best, role) =>
    ROLE_PRIORITY[role] > ROLE_PRIORITY[best] ? role : best,
  );
}

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

  const users = db.collection<{
    _id: string;
    steamId: string;
    personaName?: string;
    seedTag?: string;
  }>("users");
  const rolesCol = db.collection<{ _id: string; code: RoleCode }>("roles");
  const userRoles = db.collection<{
    _id: string;
    userId: string;
    roleId: string;
    roleCode: RoleCode;
    source: string;
    grantedBy: string | null;
    grantedAt: Date;
    expiresAt: Date | null;
    active: boolean;
    seedTag?: string;
  }>("user_roles");
  const audit = db.collection<{
    _id: string;
    adminId: string | null;
    adminSteamId: string | null;
    action: string;
    targetUserId: string;
    targetSteamId: string;
    targetPersonaName: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    timestamp: Date;
    seedTag?: string;
  }>("audit_logs");

  // Ensure role catalog exists (run seed:permissions first if empty).
  const roleDocs = await rolesCol.find({}).toArray();
  const roleByCode = new Map(roleDocs.map((r) => [r.code, r]));

  if (!roleByCode.has("USER")) {
    console.error(
      'Role catalog is empty. Run "npm run seed:permissions" first.',
    );
    process.exit(1);
  }

  for (const fixture of DUMMY_USERS) {
    const existing = await users.findOne({ steamId: fixture.steamId });
    const userId = existing?._id ?? crypto.randomUUID();
    const displayRoles: RoleCode[] = [
      "USER",
      ...fixture.roles.map((r) => r.roleCode),
    ];

    await users.updateOne(
      { steamId: fixture.steamId },
      {
        $set: {
          personaName: fixture.personaName,
          avatarUrl: `https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg`,
          profileUrl: `https://steamcommunity.com/profiles/${fixture.steamId}`,
          role: highestRole(displayRoles),
          updatedAt: now,
          lastLoginAt: now,
          seedTag: DUMMY_SEED_TAG,
        },
        $setOnInsert: {
          _id: userId,
          steamId: fixture.steamId,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const user = await users.findOne({ steamId: fixture.steamId });
    if (!user) continue;

    // Reset prior dummy assignments for this user, then re-grant.
    await userRoles.deleteMany({
      userId: user._id,
      seedTag: DUMMY_SEED_TAG,
    });

    const assignments: Array<{
      roleCode: RoleCode;
      source: string;
      expiresAt: Date | null;
    }> = [
      { roleCode: "USER", source: "SYSTEM", expiresAt: null },
      ...fixture.roles.map((r) => ({
        roleCode: r.roleCode,
        source: r.source,
        expiresAt:
          r.expiresInDays != null
            ? new Date(
                now.getTime() + r.expiresInDays * 24 * 60 * 60 * 1000,
              )
            : null,
      })),
    ];

    for (const assignment of assignments) {
      const role = roleByCode.get(assignment.roleCode);
      if (!role) {
        console.warn(`Skipping missing role ${assignment.roleCode}`);
        continue;
      }

      const assignmentId = crypto.randomUUID();
      await userRoles.insertOne({
        _id: assignmentId,
        userId: user._id,
        roleId: role._id,
        roleCode: assignment.roleCode,
        source: assignment.source,
        grantedBy: null,
        grantedAt: now,
        expiresAt: assignment.expiresAt,
        active: true,
        seedTag: DUMMY_SEED_TAG,
      });

      if (assignment.roleCode !== "USER") {
        await audit.insertOne({
          _id: crypto.randomUUID(),
          adminId: null,
          adminSteamId: null,
          action: "GRANT_ROLE",
          targetUserId: user._id,
          targetSteamId: fixture.steamId,
          targetPersonaName: fixture.personaName,
          oldValue: null,
          newValue: {
            roleCode: assignment.roleCode,
            source: assignment.source,
            expiresAt: assignment.expiresAt,
            assignmentId,
            seedTag: DUMMY_SEED_TAG,
          },
          timestamp: now,
          seedTag: DUMMY_SEED_TAG,
        });
      }
    }

    console.log(
      `  ✓ ${fixture.personaName} (${fixture.steamId}) → ${highestRole(displayRoles)}`,
    );
  }

  await client.close();
  console.log(
    `\nSeeded ${DUMMY_USERS.length} dummy users into "${dbName}".\n` +
      `Search in Admin for "[TEST]" or a SteamID starting with 9000000000000000.\n` +
      `Remove later with: npm run remove:dummy-users`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
