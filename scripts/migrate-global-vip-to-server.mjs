/**
 * Standalone prod-safe migration (no tsx). Backfills vip_history for active VIP
 * roles onto one server (default retake-1-mumbai).
 *
 * On Hostinger (wallbang-next already has MONGODB_*):
 *   docker cp scripts/migrate-global-vip-to-server.mjs wallbang-next:/tmp/
 *   docker exec -w /app wallbang-next \
 *     node /tmp/migrate-global-vip-to-server.mjs --dry-run --server-id retake-1-mumbai
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { MongoClient } = require("mongodb");

const MS_PER_DAY = 86_400_000;
const LIFETIME_DURATION_DAYS = 365 * 100;

function isAllRetakesRecord(record) {
  if (record.accessType === "INDIVIDUAL_SERVER") return false;
  if (record.serverId) return false;
  if ((record.serverIds?.length ?? 0) > 0) return false;
  if (record.accessType === "ALL_RETAKES") return true;
  if (record.bundleId === "all" || record.bundleId === "all_retakes") return true;
  if (
    record.bundleId &&
    record.bundleId !== "all" &&
    record.bundleId !== "all_retakes"
  ) {
    return false;
  }
  return record.bundleKind === "all";
}

function serverIdsFromRecord(record) {
  if (isAllRetakesRecord(record)) return [];
  if (record.serverId) return [record.serverId];
  if (record.serverIds?.length > 0) return record.serverIds;
  if (
    record.bundleId &&
    record.bundleId !== "all" &&
    record.bundleId !== "all_retakes" &&
    !String(record.bundleId).includes("+")
  ) {
    return [record.bundleId];
  }
  if (String(record.bundleId || "").includes("+")) {
    return String(record.bundleId).split("+").filter(Boolean);
  }
  return [];
}

function computeEntitlementExpiry(records) {
  if (!records.length) return null;
  const sorted = [...records].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  let expiry = null;
  for (const record of sorted) {
    const purchasedAt = new Date(record.createdAt);
    const base =
      expiry && expiry.getTime() > purchasedAt.getTime() ? expiry : purchasedAt;
    expiry = new Date(base.getTime() + record.durationDays * MS_PER_DAY);
  }
  return expiry;
}

function hasActiveVipEntitlementForServer({ history, serverId, now }) {
  const sid = serverId.trim();
  if (!sid) return false;
  const bundleExpiry = computeEntitlementExpiry(
    history.filter(isAllRetakesRecord),
  );
  if (bundleExpiry && bundleExpiry.getTime() > now.getTime()) return true;
  const serverExpiry = computeEntitlementExpiry(
    history.filter((r) => serverIdsFromRecord(r).includes(sid)),
  );
  return Boolean(serverExpiry && serverExpiry.getTime() > now.getTime());
}

function parseArgs(argv) {
  let dryRun = false;
  let serverId = "retake-1-mumbai";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--server-id") {
      const raw = argv[++i]?.trim();
      if (!raw) throw new Error("--server-id requires a value.");
      serverId = raw;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node migrate-global-vip-to-server.mjs [--dry-run] [--server-id retake-1-mumbai]",
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { dryRun, serverId };
}

function remainingDurationDays(expiresAt, now) {
  if (!expiresAt) return LIFETIME_DURATION_DAYS;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

function pickPlan(durationDays) {
  if (durationDays >= 365) return "1_year";
  if (durationDays >= 180) return "6_months";
  if (durationDays >= 90) return "3_months";
  return "1_month";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "wallbang";
  if (!uri) throw new Error("MONGODB_URI is required.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  const vipRoles = await db
    .collection("user_roles")
    .find({
      roleCode: "VIP",
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
    .toArray();

  console.log(
    `[migrate-vip-server] db=${dbName} serverId=${opts.serverId} dryRun=${opts.dryRun} activeVip=${vipRoles.length}`,
  );

  let inserted = 0;
  let skipped = 0;
  let expiredSkip = 0;

  for (const role of vipRoles) {
    const user = await db.collection("users").findOne({ _id: role.userId });
    if (!user) {
      console.warn(`  skip missing user ${role.userId}`);
      skipped += 1;
      continue;
    }

    const history = await db
      .collection("vip_history")
      .find({ userId: user._id })
      .toArray();

    if (
      hasActiveVipEntitlementForServer({
        history,
        serverId: opts.serverId,
        now,
      })
    ) {
      const existing = computeEntitlementExpiry(
        history.filter((r) =>
          serverIdsFromRecord(r).includes(opts.serverId),
        ),
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
      ? new Date(role.expiresAt)
      : new Date(now.getTime() + durationDays * MS_PER_DAY);

    const doc = {
      _id: randomUUID(),
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
      await db.collection("vip_history").insertOne(doc);
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
