/**
 * Canonicalize legacy giveaway VIP history.
 *
 * Default is a dry run. Use --execute only after reviewing the report:
 *   node scripts/migrate-giveaway-entitlements.mjs --dry-run
 *   node scripts/migrate-giveaway-entitlements.mjs --execute
 *
 * This file intentionally has no TypeScript or tsx dependency so it can run
 * inside the production Next.js container, whose image contains production
 * dependencies only.
 */
import { MongoClient } from "mongodb";

const MS_PER_DAY = 86_400_000;
const LAUNCH_GIVEAWAY_ENTITLEMENT_KEY = "mumbai-retake-bundle-all";

function isGiveaway(record) {
  return (
    record.source === "GIVEAWAY" ||
    record.paymentId?.startsWith("complimentary:")
  );
}

function planFor(durationDays) {
  if (durationDays >= 365) return "1_year";
  if (durationDays >= 180) return "6_months";
  if (durationDays >= 90) return "3_months";
  return "1_month";
}

function durationDays(start, end) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

async function main() {
  const execute = process.argv.includes("--execute");
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "wallbang";
  if (!uri) throw new Error("MONGODB_URI is required.");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const now = new Date();
    const bundle = await db
      .collection("vip_bundles")
      .findOne({ id: LAUNCH_GIVEAWAY_ENTITLEMENT_KEY });
    if (!bundle) {
      throw new Error(`Missing bundle ${LAUNCH_GIVEAWAY_ENTITLEMENT_KEY}.`);
    }

    const roles = await db
      .collection("user_roles")
      .find({
        roleCode: "VIP",
        source: "GIVEAWAY",
        active: true,
        expiresAt: { $gt: now },
      })
      .sort({ grantedAt: 1 })
      .toArray();

    let changed = 0;
    let skipped = 0;
    const processedUsers = new Set();

    for (const role of roles) {
      if (processedUsers.has(role.userId)) {
        console.warn(`skip ${role._id}: another active giveaway role was already processed for ${role.userId}`);
        skipped += 1;
        continue;
      }
      processedUsers.add(role.userId);

      if (!role.expiresAt) {
        console.warn(`skip ${role._id}: giveaway role has no expiry`);
        skipped += 1;
        continue;
      }

      const user = await db.collection("users").findOne({ _id: role.userId });
      if (!user) {
        console.warn(`skip ${role._id}: user ${role.userId} is missing`);
        skipped += 1;
        continue;
      }

      const history = await db
        .collection("vip_history")
        .find({ userId: role.userId })
        .toArray();
      const activeGiveawayRows = history
        .filter(isGiveaway)
        .filter((row) => row.status !== "SUPERSEDED");

      if (activeGiveawayRows.length === 0) {
        console.log(`skip ${user.steamId}: no giveaway history`);
        skipped += 1;
        continue;
      }

      const canonicalPaymentId =
        `complimentary:${role._id}:${LAUNCH_GIVEAWAY_ENTITLEMENT_KEY}`;
      const canonical =
        activeGiveawayRows.find(
          (row) => row.paymentId === canonicalPaymentId,
        ) ??
        activeGiveawayRows.find(
          (row) => row.bundleId === LAUNCH_GIVEAWAY_ENTITLEMENT_KEY,
        ) ?? activeGiveawayRows[0];
      const canonicalId = canonical._id;
      const startDate = role.grantedAt;
      const days = durationDays(startDate, role.expiresAt);
      const superseded = activeGiveawayRows.filter(
        (row) => row._id !== canonicalId,
      );

      console.log(
        `${execute ? "migrate" : "would migrate"} ${user.steamId} (${user.personaName ?? "?"}) ` +
          `rows=${activeGiveawayRows.length} supersede=${superseded.length} ` +
          `until=${role.expiresAt.toISOString()}`,
      );

      if (!execute) {
        changed += 1;
        continue;
      }

      const historyCol = db.collection("vip_history");
      await historyCol.updateOne(
        { _id: canonicalId },
        {
          $set: {
            bundleId: LAUNCH_GIVEAWAY_ENTITLEMENT_KEY,
            bundleKind: "custom",
            accessType: "BUNDLE",
            serverId: null,
            serverIds: bundle.serverIds,
            plan: planFor(days),
            amount: 0,
            durationDays: days,
            startDate,
            endDate: role.expiresAt,
            paymentId: canonicalPaymentId,
            source: "GIVEAWAY",
            grantId: role._id,
            status: "ACTIVE",
            supersededBy: null,
            supersededAt: null,
          },
        },
      );

      if (superseded.length > 0) {
        await historyCol.updateMany(
          { _id: { $in: superseded.map((row) => row._id) } },
          {
            $set: {
              status: "SUPERSEDED",
              supersededBy: canonicalId,
              supersededAt: now,
            },
          },
        );
      }

      await db
        .collection("user_roles")
        .updateOne({ _id: role._id }, { $set: { expiresAt: role.expiresAt } });
      changed += 1;
    }

    console.log(
      `[migrate-giveaway-entitlements] db=${dbName} execute=${execute} changed=${changed} skipped=${skipped}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
