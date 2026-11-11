import assert from "node:assert/strict";
import test from "node:test";

import { getDb, getMongoClient } from "@/lib/mongo";
import { fulfillOnlineVipPurchase, markPaymentRefunded } from "@/lib/payments/service";
import { grantManualVip } from "@/lib/payments/manual-vip-service";
import { revokeVipEntitlement } from "@/lib/permissions/service";
import { getPlayerPermissions } from "@/lib/permissions/service";
import { loadEffectiveVipHistory } from "@/lib/payments/effective-vip-history";
import { hasActiveVipEntitlementForServer } from "@/lib/payments/entitlements-logic";
import { withVipEntitlementTransaction } from "@/lib/payments/entitlement-transaction";
import { synchronizeVipRole } from "@/lib/permissions/vip-role-service";
import type { PaymentDoc, VipHistoryDoc } from "@/types/payments";
import type { UserDoc } from "@/lib/auth/users";
import type { GameServerDoc } from "@/types/servers";
import type { VipBundleDoc } from "@/types/vip";
import type { AuditLogDoc, UserRoleDoc } from "@/types/permissions";

const testDbName = process.env.MONGODB_DB ?? "";
const enabled =
  process.env.WALLBANG_VIP_PERSISTENCE_TESTS === "1" &&
  /^wallbang_vip_test_[a-z0-9_]+$/.test(testDbName) &&
  Boolean(process.env.MONGODB_URI);

function testUser(id: string, suffix: number): UserDoc {
  const now = new Date();
  return {
    _id: id,
    steamId: `76561198000000${String(suffix).padStart(3, "0")}`,
    personaName: `VIP Test ${suffix}`,
    avatarUrl: "",
    profileUrl: `https://steamcommunity.com/profiles/76561198000000${String(suffix).padStart(3, "0")}`,
    role: "USER",
    chatTag: null,
    nameTag: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

function payment(input: {
  id: string;
  user: UserDoc;
  orderId: string;
  providerPaymentId: string;
  serverId: string;
  durationDays?: number;
}): PaymentDoc {
  const now = new Date();
  return {
    _id: input.id,
    userId: input.user._id,
    steamId: input.user.steamId,
    provider: "razorpay",
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.providerPaymentId,
    email: null,
    phone: null,
    bundleId: input.serverId,
    bundleKind: "server",
    bundleName: null,
    accessType: "INDIVIDUAL_SERVER",
    serverId: input.serverId,
    serverIds: [input.serverId],
    plan: "1_month",
    durationDays: input.durationDays ?? 30,
    amount: 5000,
    originalAmount: 5000,
    discountAmount: 0,
    promotionId: null,
    promotionName: null,
    promotionTargetType: "server",
    promotionTargetId: input.serverId,
    promotionEndsAt: null,
    currency: "INR",
    status: "created",
    paidAt: null,
    refundedAt: null,
    fulfilledAt: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function gameServer(id: string, name: string) {
  const now = new Date();
  return {
    _id: id,
    id,
    name,
    shortName: name,
    mode: "Retake",
    map: "de_mirage",
    region: "Mumbai",
    city: "Mumbai",
    host: "127.0.0.1",
    port: 27015,
    tickRate: 128,
    maxPlayers: 20,
    maxPlayersOverride: null,
    pingUrl: null,
    status: "live" as const,
    featured: false,
    enabled: true,
    powerState: "running" as const,
    vipPricingByPlan: null,
    createdAt: now,
    updatedAt: now,
  };
}

test("VIP workflow persistence and recovery", { skip: !enabled }, async (t) => {
  const client = await getMongoClient();
  const db = await getDb();
  try {
    // The guard above restricts all destructive setup/cleanup to a disposable test DB.
    await db.dropDatabase();
    const users = db.collection<UserDoc>("users");
    const payments = db.collection<PaymentDoc>("payments");
    const history = db.collection<VipHistoryDoc>("vip_history");
    const roles = db.collection<UserRoleDoc>("user_roles");
    const servers = db.collection<GameServerDoc>("game_servers");
    const bundles = db.collection<VipBundleDoc>("vip_bundles");

    const serverOne = "vip-test-retake-one";
    const serverTwo = "vip-test-retake-two";
    await servers.insertMany([
      gameServer(serverOne, "VIP Test Retake One"),
      gameServer(serverTwo, "VIP Test Retake Two"),
    ]);

    const onlineUser = testUser("vip-online-user", 101);
    await users.insertOne(onlineUser);
    const firstPayment = payment({
      id: "online-payment-one",
      user: onlineUser,
      orderId: "order-one",
      providerPaymentId: "provider-payment-one",
      serverId: serverOne,
    });
    await payments.insertOne(firstPayment);

    await t.test("rejects invalid captured amounts without fulfilling the order", async () => {
      for (const amount of [undefined, NaN, 0, -1]) {
        await assert.rejects(fulfillOnlineVipPurchase({
          razorpayOrderId: firstPayment.razorpayOrderId,
          razorpayPaymentId: firstPayment.razorpayPaymentId!,
          amount,
        }));
      }
      assert.equal((await payments.findOne({ _id: firstPayment._id }))?.fulfilledAt, null);
      assert.equal(await history.countDocuments({ paymentId: firstPayment._id }), 0);
      assert.equal(await fulfillOnlineVipPurchase({
        razorpayOrderId: firstPayment.razorpayOrderId,
        razorpayPaymentId: firstPayment.razorpayPaymentId!,
        amount: firstPayment.amount + 1,
      }), null);
      assert.equal((await payments.findOne({ _id: firstPayment._id }))?.fulfilledAt, null);
      assert.equal(await history.countDocuments({ paymentId: firstPayment._id }), 0);
    });

    await t.test("duplicate webhook and interruption retry create one paid row", async () => {
      const concurrentDuplicateResults = await Promise.all([0, 1].map(() => fulfillOnlineVipPurchase({
        razorpayOrderId: firstPayment.razorpayOrderId,
        razorpayPaymentId: firstPayment.razorpayPaymentId!,
        amount: firstPayment.amount,
      })));
      assert.ok(concurrentDuplicateResults.every(Boolean));
      const persisted = await history.findOne({ paymentId: firstPayment._id });
      assert.ok(persisted);
      const endDate = persisted.endDate.toISOString();
      assert.equal(persisted.paymentId, firstPayment._id);
      assert.equal(persisted.amount, firstPayment.amount);

      // Simulate a legacy/interrupted fulfillment state after the entitlement write.
      await payments.updateOne(
        { _id: firstPayment._id },
        { $set: { fulfilledAt: null, status: "captured" } },
      );
      await fulfillOnlineVipPurchase({
        razorpayOrderId: firstPayment.razorpayOrderId,
        razorpayPaymentId: firstPayment.razorpayPaymentId!,
        amount: firstPayment.amount,
      });
      await fulfillOnlineVipPurchase({
        razorpayOrderId: firstPayment.razorpayOrderId,
        razorpayPaymentId: firstPayment.razorpayPaymentId!,
        amount: firstPayment.amount,
      });

      assert.equal(await history.countDocuments({ paymentId: firstPayment._id }), 1);
      assert.equal((await history.findOne({ paymentId: firstPayment._id }))?.endDate.toISOString(), endDate);
      assert.equal(await history.countDocuments({ paymentId: /^offline-purchase:/ }), 0);
      assert.equal(await roles.countDocuments({ userId: onlineUser._id, roleCode: "VIP", active: true }), 1);
      assert.ok((await payments.findOne({ _id: firstPayment._id }))?.fulfilledAt);
    });

    await t.test("verified legacy revocation is honored by synchronization, plugin access and renewal", async () => {
      const user = testUser("vip-legacy-fixture", 107);
      await users.insertOne(user);
      const vipRole = await db.collection<{ _id: string; code: string }>("roles").findOne({ code: "VIP" });
      assert.ok(vipRole);
      const legacy = (id: string, createdAt: string, endDate: string, durationDays: number): VipHistoryDoc => ({
        _id: id, userId: user._id, steamId: user.steamId, bundleId: serverOne,
        bundleKind: "server", accessType: "INDIVIDUAL_SERVER", serverId: serverOne,
        serverIds: [serverOne], plan: "1_month", amount: 0, durationDays,
        createdAt: new Date(createdAt), startDate: new Date(createdAt), endDate: new Date(endDate),
        source: "ADMIN", status: "ACTIVE", grantId: `${id}:${serverOne}`,
        paymentId: `complimentary:${id}:${serverOne}`,
      });
      const old = legacy("legacy-revoked-role", "2026-11-08T18:32:12.621Z", "2126-10-15T18:32:12.621Z", 36500);
      const finite = legacy("legacy-finite-role", "2026-11-08T18:32:19.764Z", "2026-12-08T18:32:19.764Z", 30);
      await history.insertMany([old, finite]);
      await roles.insertOne({
        _id: "legacy-finite-role", userId: user._id, roleId: vipRole._id, roleCode: "VIP",
        source: "MANUAL", grantedBy: "fixture-admin", grantedAt: finite.createdAt,
        expiresAt: new Date("2026-12-08T18:32:19.556Z"), active: true,
      });
      const auditBase = { adminId: "fixture-admin", adminSteamId: null, targetUserId: user._id,
        targetSteamId: user.steamId, targetPersonaName: user.personaName };
      await db.collection<AuditLogDoc>("audit_logs").insertMany([
        { ...auditBase, _id: "legacy-grant-audit", action: "GRANT_ROLE", oldValue: null,
          newValue: { roleCode: "VIP", assignmentId: "legacy-revoked-role", entitlementKeys: [serverOne] },
          timestamp: new Date("2026-11-08T18:32:12.634Z") },
        { ...auditBase, _id: "legacy-revoke-audit", action: "REVOKE_ROLE", newValue: null,
          oldValue: { roleCode: "VIP", assignmentId: "legacy-revoked-role" },
          timestamp: new Date("2026-11-08T18:32:16.702Z") },
      ]);
      const effective = await loadEffectiveVipHistory(user._id);
      assert.equal(effective.find((row) => row._id === old._id)?.status, "REVOKED");
      assert.equal((await history.findOne({ _id: old._id }))?.status, "ACTIVE");
      assert.equal(hasActiveVipEntitlementForServer({ history: effective, serverId: serverOne, now: new Date("2026-12-09T00:00:00Z") }), false);
      await withVipEntitlementTransaction({ userId: user._id, run: ({ session }) => synchronizeVipRole({
        userId: user._id, steamId: user.steamId, personaName: user.personaName,
        source: "MANUAL", grantedBy: null, mode: "extend", session,
      }) });
      assert.equal((await roles.findOne({ _id: "legacy-finite-role" }))?.expiresAt?.toISOString(), finite.endDate.toISOString());
      assert.ok((await getPlayerPermissions(user.steamId, { serverId: serverOne }))?.roles.includes("VIP"));

      const row = payment({ id: "legacy-renewal-payment", user, orderId: "legacy-renewal-order",
        providerPaymentId: "legacy-renewal-provider", serverId: serverOne });
      await payments.insertOne(row);
      await fulfillOnlineVipPurchase({ razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: row.razorpayPaymentId!, amount: row.amount });
      await fulfillOnlineVipPurchase({ razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: row.razorpayPaymentId!, amount: row.amount });
      const renewed = await history.findOne({ paymentId: row._id });
      assert.ok(renewed);
      assert.equal(renewed.startDate.toISOString(), finite.endDate.toISOString());
      assert.equal(renewed.endDate.getTime(), finite.endDate.getTime() + 30 * 86_400_000);
      assert.equal(await history.countDocuments({ paymentId: row._id }), 1);
      assert.equal(await history.countDocuments({ userId: user._id, paymentId: /^offline-purchase:/ }), 0);
      assert.equal((await history.findOne({ _id: old._id }))?.endDate.toISOString(), old.endDate.toISOString());
      const manualExpiry = new Date(finite.endDate.getTime() + 60 * 86_400_000);
      await grantManualVip({
        targetUserId: user._id, roleCode: "VIP", source: "PURCHASE",
        grantedBy: { id: "fixture-admin", steamId: "76561198000000999" },
        expiresAt: manualExpiry, entitlementKeys: [serverOne],
        entitlementAmounts: [{ key: serverOne, amountPaise: 7000 }],
        requestId: "95a3e6e8-e98e-4a8d-9cb6-952471bf4a92",
      });
      const manual = await history.findOne({ userId: user._id, paymentId: /^offline-purchase:/ });
      assert.ok(manual);
      assert.equal(manual.amount, 7000);
      assert.equal(manual.startDate.toISOString(), renewed.endDate.toISOString());
      assert.equal(manual.endDate.toISOString(), manualExpiry.toISOString());
      assert.equal((await history.findOne({ _id: old._id }))?.status, "ACTIVE");
      assert.equal((await roles.findOne({ _id: "legacy-finite-role" }))?.expiresAt?.toISOString(), manualExpiry.toISOString());
    });

    await t.test("concurrent distinct payments stack from authoritative history", async () => {
      const user = testUser("vip-concurrent-user", 102);
      await users.insertOne(user);
      const rows = [
        payment({ id: "concurrent-payment-one", user, orderId: "concurrent-order-one", providerPaymentId: "concurrent-provider-one", serverId: serverOne }),
        payment({ id: "concurrent-payment-two", user, orderId: "concurrent-order-two", providerPaymentId: "concurrent-provider-two", serverId: serverOne }),
      ];
      await payments.insertMany(rows);
      await Promise.all(rows.map((row) => fulfillOnlineVipPurchase({
        razorpayOrderId: row.razorpayOrderId,
        razorpayPaymentId: row.razorpayPaymentId!,
        amount: row.amount,
      })));

      const entitlements = await history.find({ userId: user._id }).sort({ endDate: 1 }).toArray();
      assert.equal(entitlements.length, 2);
      assert.equal(entitlements[1]!.endDate.getTime() - entitlements[0]!.endDate.getTime(), 30 * 86_400_000);
      const activeRoles = await roles.find({ userId: user._id, roleCode: "VIP", active: true }).toArray();
      assert.equal(activeRoles.length, 1);
      assert.equal(activeRoles[0]!.expiresAt?.toISOString(), entitlements[1]!.endDate.toISOString());
      const invoiceNumbers = await payments.find({ userId: user._id }, { projection: { invoiceNumber: 1 } }).toArray();
      assert.equal(new Set(invoiceNumbers.map((row) => row.invoiceNumber)).size, 2);
    });

    await t.test("refund revokes its entitlement and reconciles the global role", async () => {
      const user = testUser("vip-refund-user", 106);
      await users.insertOne(user);
      const row = payment({
        id: "refund-payment",
        user,
        orderId: "refund-order",
        providerPaymentId: "refund-provider-payment",
        serverId: serverOne,
      });
      await payments.insertOne(row);
      await fulfillOnlineVipPurchase({
        razorpayOrderId: row.razorpayOrderId,
        razorpayPaymentId: row.razorpayPaymentId!,
        amount: row.amount,
      });
      await markPaymentRefunded({ razorpayPaymentId: row.razorpayPaymentId! });

      assert.equal((await payments.findOne({ _id: row._id }))?.status, "refunded");
      assert.equal((await history.findOne({ paymentId: row._id }))?.status, "REVOKED");
      assert.equal(await roles.countDocuments({ userId: user._id, roleCode: "VIP", active: true }), 0);
    });

    const manualUser = testUser("vip-manual-user", 103);
    await users.insertOne(manualUser);
    await t.test("manual individual purchases preserve distinct amounts and request idempotency", async () => {
      const grant = {
        targetUserId: manualUser._id,
        roleCode: "VIP" as const,
        source: "PURCHASE" as const,
        grantedBy: { id: "admin-1", steamId: "76561198000000999" },
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        entitlementKeys: [serverOne, serverTwo],
        entitlementAmounts: [
          { key: serverOne, amountPaise: 5000 },
          { key: serverTwo, amountPaise: 6000 },
        ],
        requestId: "8e6e9fd4-9444-4dc6-9a5d-5f0a3642ab35",
      };
      await grantManualVip(grant);
      await grantManualVip(grant);

      const records = await history.find({ userId: manualUser._id }).toArray();
      assert.equal(records.length, 2);
      assert.deepEqual(new Map(records.map((row) => [row.serverId, row.amount])), new Map([[serverOne, 5000], [serverTwo, 6000]]));
      assert.ok(records.every((row) => row.paymentId.startsWith("offline-purchase:")));
      assert.equal(await roles.countDocuments({ userId: manualUser._id, roleCode: "VIP", active: true }), 1);
    });

    await bundles.insertOne({
      _id: "bundle-vip-test",
      id: "bundle-vip-test",
      name: "VIP Test Bundle",
      description: null,
      serverIds: [serverOne, serverTwo],
      pricingByPlan: { "1_month": 12000, "3_months": 30000, "6_months": 50000, "1_year": 90000 },
      enabled: true,
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bundleUser = testUser("vip-bundle-user", 104);
    await users.insertOne(bundleUser);
    await t.test("manual bundle purchase persists one row for all included servers", async () => {
      await grantManualVip({
        targetUserId: bundleUser._id,
        roleCode: "VIP",
        source: "PURCHASE",
        grantedBy: { id: "admin-1", steamId: "76561198000000999" },
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        entitlementKeys: ["bundle-vip-test"],
        purchaseAmountPaise: 12000,
        requestId: "fdac8c63-c564-4dc5-b548-c5ccf5e1933c",
      });
      const rows = await history.find({ userId: bundleUser._id }).toArray();
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.accessType, "BUNDLE");
      assert.deepEqual(rows[0]?.serverIds, [serverOne, serverTwo]);
      assert.equal(rows[0]?.amount, 12000);
      await assert.rejects(grantManualVip({
        targetUserId: bundleUser._id, roleCode: "VIP", source: "PURCHASE",
        grantedBy: { id: "admin-1", steamId: "76561198000000999" },
        expiresAt: new Date(Date.now() + 86_400_000), entitlementKeys: ["bundle-vip-test"],
        purchaseAmountPaise: 12000, requestId: "5e7c6974-14b4-4d64-b117-9dbaea07362a",
      }), /adds no VIP entitlement coverage/);
      assert.equal(await history.countDocuments({ userId: bundleUser._id }), 1);
    });

    const complimentaryUser = testUser("vip-complimentary-user", 105);
    await users.insertOne(complimentaryUser);
    await t.test("complimentary grants are explicit and never enter offline revenue", async () => {
      await grantManualVip({
        targetUserId: complimentaryUser._id,
        roleCode: "VIP",
        source: "MANUAL",
        grantedBy: { id: "admin-1", steamId: "76561198000000999" },
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        entitlementKeys: [serverOne],
        requestId: "3cf2e4cb-0ee2-4d0c-b024-6c3af673673a",
      });
      const row = await history.findOne({ userId: complimentaryUser._id });
      assert.ok(row);
      assert.equal(row.source, "MANUAL");
      assert.equal(row.amount, 0);
      assert.ok(row.paymentId.startsWith("complimentary:"));
      assert.equal(await history.countDocuments({ userId: complimentaryUser._id, paymentId: /^offline-purchase:/ }), 0);
    });

    await t.test("targeted revocation retains another grant on the same bundle and is idempotent", async () => {
      const user = testUser("vip-targeted-user", 108);
      await users.insertOne(user);
      const purchase = { ...payment({ id: "targeted-paid", user, orderId: "targeted-order",
        providerPaymentId: "targeted-provider", serverId: serverOne }), bundleId: "bundle-vip-test",
        bundleKind: "custom" as const, accessType: "BUNDLE" as const, serverId: null, serverIds: [serverOne, serverTwo] };
      await payments.insertOne(purchase);
      await fulfillOnlineVipPurchase({ razorpayOrderId: purchase.razorpayOrderId, razorpayPaymentId: purchase.razorpayPaymentId!, amount: purchase.amount });
      const paid = await history.findOne({ paymentId: purchase._id });
      assert.ok(paid);
      await grantManualVip({ targetUserId: user._id, roleCode: "VIP", source: "MANUAL",
        grantedBy: { id: "fixture-admin", steamId: "76561198000000999" },
        expiresAt: new Date(paid.endDate.getTime() + 30 * 86_400_000), entitlementKeys: ["bundle-vip-test"],
        requestId: "f15e76af-67fe-46d4-874c-acf47bcd69b2" });
      const before = await history.find({ userId: user._id }).sort({ _id: 1 }).toArray();
      assert.equal(before.length, 2);
      const complimentary = before.find((row) => row._id !== paid._id);
      assert.ok(complimentary);
      assert.equal(complimentary.startDate.toISOString(), paid.endDate.toISOString());
      assert.equal(complimentary.durationDays, 30);
      const admin = { id: "fixture-admin", steamId: "76561198000000999" };
      await assert.rejects(revokeVipEntitlement({ targetUserId: user._id,
        entitlementKey: [serverOne, serverTwo].sort().join("+"), revokedBy: admin }), /Multiple grants/);
      await assert.rejects(revokeVipEntitlement({ targetUserId: bundleUser._id, entitlementId: paid._id, revokedBy: admin }), /not found/);
      await assert.rejects(revokeVipEntitlement({ targetUserId: user._id, entitlementId: paid._id, revokedBy: null }), /administrator/);
      const revoked = await revokeVipEntitlement({ targetUserId: user._id, entitlementId: paid._id, revokedBy: admin });
      assert.equal(revoked.alreadyRevoked, false);
      assert.equal(revoked.deletedHistoryRows, 0);
      assert.equal((await revokeVipEntitlement({ targetUserId: user._id, entitlementId: paid._id, revokedBy: admin })).alreadyRevoked, true);
      assert.deepEqual(await history.find({ userId: user._id }).sort({ _id: 1 }).toArray(), before);
      assert.equal((await loadEffectiveVipHistory(user._id)).find((row) => row._id === paid._id)?.status, "REVOKED");
      assert.equal((await loadEffectiveVipHistory(user._id)).filter((row) => row.status !== "REVOKED").length, 1);
      assert.ok((await getPlayerPermissions(user.steamId, { serverId: serverOne }))?.roles.includes("VIP"));
      assert.equal((await roles.findOne({ userId: user._id, roleCode: "VIP", active: true }))?.expiresAt?.toISOString(), complimentary.endDate.toISOString());
      assert.equal((await payments.findOne({ _id: purchase._id }))?.status, "captured");
      const renewal = { ...payment({ id: "targeted-renewal", user, orderId: "targeted-renewal-order",
        providerPaymentId: "targeted-renewal-provider", serverId: serverOne }), bundleId: "bundle-vip-test",
        bundleKind: "custom" as const, accessType: "BUNDLE" as const, serverId: null, serverIds: [serverOne, serverTwo] };
      await payments.insertOne(renewal);
      await fulfillOnlineVipPurchase({ razorpayOrderId: renewal.razorpayOrderId, razorpayPaymentId: renewal.razorpayPaymentId!, amount: renewal.amount });
      const renewed = await history.findOne({ paymentId: renewal._id });
      assert.ok(renewed);
      assert.equal(renewed.startDate.toISOString(), complimentary.endDate.toISOString());
      assert.deepEqual(await history.findOne({ _id: paid._id }), paid);
      assert.deepEqual(await history.findOne({ _id: complimentary._id }), complimentary);
    });

    await t.test("revoking a bundle preserves a separate individual server purchase", async () => {
      const user = testUser("vip-bundle-individual", 111);
      await users.insertOne(user);
      const bundle = { ...payment({ id: "separate-bundle", user, orderId: "separate-bundle-order",
        providerPaymentId: "separate-bundle-provider", serverId: serverOne }), bundleId: "bundle-vip-test",
        bundleKind: "custom" as const, accessType: "BUNDLE" as const, serverId: null, serverIds: [serverOne, serverTwo] };
      const individual = payment({ id: "separate-individual", user, orderId: "separate-individual-order",
        providerPaymentId: "separate-individual-provider", serverId: serverOne });
      await payments.insertMany([bundle, individual]);
      for (const row of [bundle, individual]) await fulfillOnlineVipPurchase({
        razorpayOrderId: row.razorpayOrderId, razorpayPaymentId: row.razorpayPaymentId!, amount: row.amount,
      });
      const bundleHistory = await history.findOne({ paymentId: bundle._id });
      const individualHistory = await history.findOne({ paymentId: individual._id });
      assert.ok(bundleHistory && individualHistory);
      await revokeVipEntitlement({ targetUserId: user._id, entitlementId: bundleHistory._id,
        revokedBy: { id: "fixture-admin", steamId: "76561198000000999" } });
      assert.deepEqual(await history.findOne({ _id: individualHistory._id }), individualHistory);
      assert.ok((await getPlayerPermissions(user.steamId, { serverId: serverOne }))?.roles.includes("VIP"));
      assert.equal((await getPlayerPermissions(user.steamId, { serverId: serverTwo }))?.roles.includes("VIP"), false);
    });

    await t.test("a specifically selected managed lifetime grant can be revoked", async () => {
      const user = testUser("vip-lifetime-targeted", 109);
      await users.insertOne(user);
      await grantManualVip({ targetUserId: user._id, roleCode: "VIP", source: "MANUAL",
        grantedBy: { id: "fixture-admin", steamId: "76561198000000999" }, expiresAt: null,
        entitlementKeys: [serverOne], requestId: "171b90eb-af12-435f-a11a-e375a527ad01" });
      const row = await history.findOne({ userId: user._id });
      assert.ok(row?.lifetimeGrant);
      const before = await history.findOne({ _id: row._id });
      const paid = payment({ id: "lifetime-other-paid", user, orderId: "lifetime-other-order",
        providerPaymentId: "lifetime-other-provider", serverId: serverTwo });
      await payments.insertOne(paid);
      await fulfillOnlineVipPurchase({ razorpayOrderId: paid.razorpayOrderId, razorpayPaymentId: paid.razorpayPaymentId!, amount: paid.amount });
      const paidHistory = await history.findOne({ paymentId: paid._id });
      assert.ok(paidHistory);
      const paidOutcome = await revokeVipEntitlement({ targetUserId: user._id, entitlementId: paidHistory._id,
        revokedBy: { id: "fixture-admin", steamId: "76561198000000999" } });
      assert.equal(paidOutcome.vipDeactivated, false);
      assert.equal(paidOutcome.vipExpiresAt, null);
      const replacement = payment({ id: "lifetime-other-paid-2", user, orderId: "lifetime-other-order-2",
        providerPaymentId: "lifetime-other-provider-2", serverId: serverTwo });
      await payments.insertOne(replacement);
      await fulfillOnlineVipPurchase({ razorpayOrderId: replacement.razorpayOrderId, razorpayPaymentId: replacement.razorpayPaymentId!, amount: replacement.amount });
      const replacementHistory = await history.findOne({ paymentId: replacement._id });
      assert.ok(replacementHistory);
      const outcome = await revokeVipEntitlement({ targetUserId: user._id, entitlementId: row._id,
        revokedBy: { id: "fixture-admin", steamId: "76561198000000999" } });
      assert.equal(outcome.vipDeactivated, false);
      assert.equal(outcome.vipExpiresAt?.toISOString(), replacementHistory.endDate.toISOString());
      assert.deepEqual(await history.findOne({ _id: row._id }), before);
      assert.equal((await loadEffectiveVipHistory(user._id)).find((record) => record._id === row._id)?.status, "REVOKED");
      assert.ok((await getPlayerPermissions(user.steamId, { serverId: serverTwo }))?.roles.includes("VIP"));
      assert.equal((await getPlayerPermissions(user.steamId, { serverId: serverOne }))?.roles.includes("VIP"), false);
    });

    await t.test("concurrent purchase and targeted revocation preserve the new purchase", async () => {
      const user = testUser("vip-revoke-race", 110);
      await users.insertOne(user);
      const old = payment({ id: "race-old", user, orderId: "race-old-order", providerPaymentId: "race-old-provider", serverId: serverOne });
      const next = payment({ id: "race-new", user, orderId: "race-new-order", providerPaymentId: "race-new-provider", serverId: serverOne });
      await payments.insertMany([old, next]);
      await fulfillOnlineVipPurchase({ razorpayOrderId: old.razorpayOrderId, razorpayPaymentId: old.razorpayPaymentId!, amount: old.amount });
      const oldHistory = await history.findOne({ paymentId: old._id });
      assert.ok(oldHistory);
      await Promise.all([
        revokeVipEntitlement({ targetUserId: user._id, entitlementId: oldHistory._id,
          revokedBy: { id: "fixture-admin", steamId: "76561198000000999" } }),
        fulfillOnlineVipPurchase({ razorpayOrderId: next.razorpayOrderId, razorpayPaymentId: next.razorpayPaymentId!, amount: next.amount }),
      ]);
      const effective = await loadEffectiveVipHistory(user._id);
      assert.equal(effective.find((row) => row.paymentId === old._id)?.status, "REVOKED");
      assert.notEqual(effective.find((row) => row.paymentId === next._id)?.status, "REVOKED");
      assert.equal(await history.countDocuments({ userId: user._id }), 2);
      assert.ok((await getPlayerPermissions(user.steamId, { serverId: serverOne }))?.roles.includes("VIP"));
    });

    await t.test("manual revocation reconciles role expiry from remaining history", async () => {
      const before = await roles.findOne({ userId: manualUser._id, roleCode: "VIP", active: true });
      assert.ok(before?.expiresAt);
      const result = await revokeVipEntitlement({
        targetUserId: manualUser._id,
        entitlementKey: serverTwo,
        revokedBy: { id: "admin-1", steamId: "76561198000000999" },
      });
      assert.equal(result.vipDeactivated, false);
      const after = await roles.findOne({ userId: manualUser._id, roleCode: "VIP", active: true });
      assert.ok(after?.expiresAt);
      assert.equal(after?.expiresAt.toISOString(), before.expiresAt.toISOString());
    });
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
