/**
 * Backfill per-server VIP entitlements for users who currently have a global
 * VIP role (launch giveaway / manual / etc.) with no matching vip_history.
 *
 * Default target: retake-1-mumbai (existing prod VIP → that server only).
 *
 * Usage:
 *   npm run migrate:vip-server -- --dry-run
 *   npm run migrate:vip-server -- --server-id retake-1-mumbai
 *   MONGODB_URI=... MONGODB_DB=wallbang npm run migrate:vip-server -- --dry-run
 *
 * After this + website deploy with ?serverId= scoping, VIP perks only apply on
 * the target server (All Retakes / other servers stay unentitled unless bought).
 */
import { MongoClient } from "mongodb";

import {
  computeEntitlementExpiry,
  hasActiveVipEntitlementForServer,
  serverIdsFromRecord,
} from "../lib/payments/entitlements-logic";
import type { VipHistoryDoc } from "../types/payments";
import type { UserRoleDoc } from "../types/permissions";

const MS_PER_DAY = 86_400_000;
const LIFETIME_DURATION_DAYS = 365 * 100;

type CliOptions = {
  dryRun: boolean;
  serverId: string;
};

type UserDoc = {
  _id: string;
  steamId: string;
  personaName?: string;
};

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let serverId = "retake-1-mumbai";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--server-id") {
      const raw = argv[i + 1]?.trim();
      if (!raw) throw new Error("--server-id requires a value.");
      serverId = raw;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  npm run migrate:vip-server -- [--dry-run] [--server-id retake-1-mumbai]
`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, serverId };
}

function remainingDurationDays(expiresAt: Date | null, now: Date): number {
  if (!expiresAt) return LIFETIME_DURATION_DAYS;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

function pickPlan(durationDays: number): VipHistoryDoc["plan"] {
  if (durationDays >= 365) return "1_year";
  if (durationDays >= 180) return "6_months";
  if (durationDays >= 90) return "3_months";
  return "1_month";
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "wallbang";
  if (!uri) throw new Error("MONGODB_URI is required.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  const vipRoles = (await db
    .collection<UserRoleDoc>("user_roles")
    .find({
      roleCode: "VIP",
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
    .toArray()) as UserRoleDoc[];

  console.log(
    `[migrate-vip-server] db=${dbName} serverId=${opts.serverId} dryRun=${opts.dryRun} activeVip=${vipRoles.length}`,
  );

  let inserted = 0;
  let skipped = 0;
  let expiredSkip = 0;

  for (const role of vipRoles) {
    const user = (await db.collection<UserDoc>("users").findOne({
      _id: role.userId,
    })) as UserDoc | null;
    if (!user) {
      console.warn(`  skip missing user ${role.userId}`);
      skipped += 1;
      continue;
    }

    const history = (await db
      .collection<VipHistoryDoc>("vip_history")
      .find({ userId: user._id })
      .toArray()) as VipHistoryDoc[];

    if (
      hasActiveVipEntitlementForServer({
        history,
        serverId: opts.serverId,
        now,
      })
    ) {
      const existing = computeEntitlementExpiry(
        history.filter((r) => serverIdsFromRecord(r).includes(opts.serverId)),
      );
      console.log(
        `  skip ${user.steamId} (${user.personaName ?? "?"}) — already entitled until ${existing?.toISOString() ?? "?"}`,
      );
      skipped += 1;
      continue;
    }

    const durationDays = remainingDurationDays(role.expiresAt, now);
    if (durationDays <= 0) {
      expiredSkip += 1;
      continue;
    }

    const endDate = role.expiresAt
      ? role.expiresAt
      : new Date(now.getTime() + durationDays * MS_PER_DAY);

    const doc: VipHistoryDoc = {
      _id: crypto.randomUUID(),
      userId: user._id,
      steamId: user.steamId,
      bundleId: opts.serverId,
      bundleKind: "server",
      accessType: "INDIVIDUAL_SERVER",
      serverId: opts.serverId,
      serverIds: [opts.serverId],
      plan: pickPlan(durationDays),
      amount: 0,
      durationDays,
      startDate: now,
      endDate,
      paymentId: `migrate-global-vip:${role._id}`,
      createdAt: now,
    };

    console.log(
      `  ${opts.dryRun ? "would insert" : "insert"} ${user.steamId} (${user.personaName ?? "?"}) source=${role.source} days=${durationDays} until=${endDate.toISOString()}`,
    );

    if (!opts.dryRun) {
      await db.collection<VipHistoryDoc>("vip_history").insertOne(doc);
    }
    inserted += 1;
  }

  console.log(
    `[migrate-vip-server] done inserted=${inserted} skipped=${skipped} expiredSkip=${expiredSkip}`,
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
