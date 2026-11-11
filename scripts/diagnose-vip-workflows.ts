import { MongoClient, type Document } from "mongodb";

import type { PaymentDoc, VipHistoryDoc } from "@/types/payments";
import type { UserRoleDoc, AuditLogDoc } from "@/types/permissions";
import { serverIdsFromRecord } from "@/lib/payments/entitlements-logic";

/** Read-only preflight for VIP payment, history, role, and registry integrity. */
async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "wallbang";
  if (!uri) throw new Error("MONGODB_URI is required.");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 7000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const hello = await db.admin().command({ hello: 1 });
    const transactionTopologyAvailable = Boolean(hello.setName || hello.msg === "isdbgrid") && Boolean(hello.logicalSessionTimeoutMinutes);
    let snapshotTransactionReadSucceeded = false;
    if (transactionTopologyAvailable) {
      const session = client.startSession();
      try {
        session.startTransaction({ readConcern: { level: "snapshot" } });
        await db.collection("users").findOne({}, { session });
        await session.abortTransaction();
        snapshotTransactionReadSucceeded = true;
      } finally {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
      }
    }
    const payments = db.collection<PaymentDoc>("payments");
    const history = db.collection<VipHistoryDoc>("vip_history");
    const roles = db.collection<UserRoleDoc>("user_roles");
    const audits = db.collection<AuditLogDoc>("audit_logs");

    const [paymentRows, historyRows, gameServers, activeRoleDuplicates, activeVipAssignments, paymentIndexes, historyIndexes, roleIndexes, offlineAudits, roleRevocations] = await Promise.all([
      payments.find({ status: { $in: ["captured", "disputed", "refunded"] } }).toArray(),
      history.find({}).toArray(),
      db.collection<{ id: string } & Document>("game_servers").find({}, { projection: { id: 1 } }).toArray(),
      roles.aggregate<{ count: number }>([
        { $match: { active: true } },
        { $group: { _id: { userId: "$userId", roleCode: "$roleCode" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: "count" },
      ]).toArray(),
      roles.find({ roleCode: "VIP", active: true }, { projection: { _id: 1, userId: 1, expiresAt: 1, source: 1 } }).toArray(),
      payments.listIndexes().toArray(),
      history.listIndexes().toArray(),
      roles.listIndexes().toArray(),
      audits.find({ action: "GRANT_ROLE", adminId: null, "newValue.roleCode": "VIP" }).toArray(),
      audits.find({ action: "REVOKE_ROLE", "oldValue.roleCode": "VIP" }, { projection: { targetUserId: 1 } }).toArray(),
    ]);

    const historyPaymentIds = new Set(historyRows.map((record) => record.paymentId));
    const historyUserIds = new Set(historyRows.map((record) => record.userId));
    const activeVipWithoutHistory = activeVipAssignments.filter((assignment) => !historyUserIds.has(assignment.userId));
    const usersWithRoleRevocations = new Set(roleRevocations.map((audit) => audit.targetUserId));
    const ambiguousPaidHistory = historyRows.filter((record) =>
      usersWithRoleRevocations.has(record.userId) &&
      (record.source === "PURCHASE" || record.amount > 0 || typeof record.paymentId !== "string" || !record.paymentId.startsWith("complimentary:")) &&
      !record.grantId,
    );
    const captured = paymentRows.filter((payment) => payment.status === "captured" || payment.status === "disputed");
    const capturedWithoutEntitlement = captured.filter((payment) => !historyPaymentIds.has(payment._id));
    const incompleteProvisioning = captured.filter((payment) => !payment.fulfilledAt || !historyPaymentIds.has(payment._id));

    const grantIdsWithAutomaticRoleAudits = new Set(
      offlineAudits.flatMap((audit) => {
        const value = audit.newValue as Record<string, unknown> | null;
        return typeof value?.assignmentId === "string" ? [value.assignmentId] : [];
      }),
    );
    const unexpectedOfflineCandidates = historyRows.filter(
      (record) =>
        record.paymentId.startsWith("offline-purchase:") &&
        record.source === "PURCHASE" &&
        Boolean(record.grantId && grantIdsWithAutomaticRoleAudits.has(record.grantId)),
    );

    const currentServerIds = new Set(gameServers.map((server) => server.id));
    const invalidLegacyServers = historyRows.flatMap((record) => {
      const invalid = serverIdsFromRecord(record).filter((serverId) => !currentServerIds.has(serverId));
      return invalid.length ? [{ historyId: record._id, invalidServerIds: invalid }] : [];
    });

    const expiryInconsistencies = historyRows.flatMap((record) => {
      if (record.status === "SUPERSEDED" || record.status === "REVOKED") return [];
      const actualDuration = record.endDate.getTime() - record.startDate.getTime();
      const expectedDuration = record.durationDays * 86_400_000;
      return Math.abs(actualDuration - expectedDuration) > 1000
        ? [{ historyId: record._id, discrepancyMs: actualDuration - expectedDuration }]
        : [];
    });

    const hasIndex = (
      indexes: Array<{ key: Record<string, number>; unique?: boolean; partialFilterExpression?: Document }>,
      key: Record<string, number>,
      predicate: (index: { unique?: boolean; partialFilterExpression?: Document }) => boolean,
    ) => indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(key) && predicate(index));

    const requiredIndexes = {
      payments: {
        uniqueOrderId: hasIndex(paymentIndexes, { razorpayOrderId: 1 }, (index) => index.unique === true),
        uniquePaymentId: hasIndex(
          paymentIndexes,
          { razorpayPaymentId: 1 },
          (index) => index.unique === true && index.partialFilterExpression?.razorpayPaymentId?.$type === "string",
        ),
      },
      vipHistory: {
        uniquePaymentId: hasIndex(historyIndexes, { paymentId: 1 }, (index) => index.unique === true),
      },
      userRoles: {
        uniqueActiveUserRole: hasIndex(
          roleIndexes,
          { userId: 1, roleCode: 1 },
          (index) => index.unique === true && index.partialFilterExpression?.active === true,
        ),
      },
    };

    console.log(JSON.stringify({
      database: dbName,
      topology: {
        replicaSet: hello.setName ?? null,
        sharded: hello.msg === "isdbgrid",
        logicalSessions: Boolean(hello.logicalSessionTimeoutMinutes),
        transactionTopologyAvailable,
        snapshotTransactionReadSucceeded,
      },
      counts: {
        capturedPayments: captured.length,
        capturedPaymentsWithoutPaidEntitlement: capturedWithoutEntitlement.length,
        capturedPaymentsWithIncompleteProvisioning: incompleteProvisioning.length,
        unexpectedOfflinePurchaseCandidates: unexpectedOfflineCandidates.length,
        invalidLegacyServerRows: invalidLegacyServers.length,
        duplicateActiveVipAssignmentGroups: activeRoleDuplicates[0]?.count ?? 0,
        activeVipAssignmentsWithoutEntitlementHistory: activeVipWithoutHistory.length,
        paidHistoryWithoutGrantLinkWithRoleRevocation: ambiguousPaidHistory.length,
        entitlementExpiryInconsistencies: expiryInconsistencies.length,
      },
      requiredIndexes,
      samples: {
        capturedPaymentsWithoutPaidEntitlement: capturedWithoutEntitlement.slice(0, 20).map((payment) => ({ paymentId: payment._id, userId: payment.userId })),
        incompleteProvisioning: incompleteProvisioning.slice(0, 20).map((payment) => ({ paymentId: payment._id, fulfilledAt: payment.fulfilledAt })),
        unexpectedOfflinePurchaseCandidates: unexpectedOfflineCandidates.slice(0, 20).map((record) => ({ historyId: record._id, grantId: record.grantId ?? null })),
        activeVipAssignmentsWithoutEntitlementHistory: activeVipWithoutHistory.slice(0, 20).map((assignment) => ({ assignmentId: assignment._id, userId: assignment.userId, source: assignment.source, expiresAt: assignment.expiresAt ?? null })),
        invalidLegacyServers: invalidLegacyServers.slice(0, 20),
        expiryInconsistencies: expiryInconsistencies.slice(0, 20),
      },
      readOnly: true,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("VIP workflow diagnostics failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
