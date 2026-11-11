import type { VipHistoryDoc } from "@/types/payments";
import type { AuditLogDoc } from "@/types/permissions";

/**
 * Identify historical complimentary rows with an unambiguous grant and a
 * subsequent explicit role-revocation audit. This is read-only evidence;
 * it does not change or delete the underlying history.
 *
 * A role assignment alone is not evidence: the assignment can be reused and
 * paid entitlements must not be inferred from it.
 */
export function historicalRevokedComplimentaryIds(
  history: VipHistoryDoc[],
  audits: AuditLogDoc[],
): Set<string> {
  const result = new Set<string>();
  for (const row of history) {
    if (!row.grantId || !row.paymentId?.startsWith("complimentary:") || row.source === "PURCHASE" || row.amount > 0) continue;
    if (row.paymentId !== `complimentary:${row.grantId}`) continue;

    const grants = audits.filter((audit) => {
      const value = audit.newValue;
      const assignmentId = value?.assignmentId;
      const keys = value?.entitlementKeys;
      return audit.targetUserId === row.userId && audit.action === "GRANT_ROLE" &&
        audit.adminId != null && value?.roleCode === "VIP" &&
        value?.automaticVipSync !== true && typeof assignmentId === "string" &&
        Array.isArray(keys) && keys.includes(row.bundleId) &&
        row.grantId === `${assignmentId}:${row.bundleId}`;
    });
    if (grants.length !== 1) continue;
    const grant = grants[0]!;
    const assignmentId = grant.newValue!.assignmentId;
    const revoked = audits.some((audit) =>
      audit.targetUserId === row.userId && audit.action === "REVOKE_ROLE" &&
      audit.adminId != null && audit.oldValue?.roleCode === "VIP" &&
      audit.oldValue?.automaticVipSync !== true &&
      audit.oldValue?.assignmentId === assignmentId &&
      audit.timestamp.getTime() >= grant.timestamp.getTime() &&
      audit.timestamp.getTime() >= row.createdAt.getTime(),
    );
    if (revoked) result.add(row._id);
  }
  return result;
}

/** Overlay verified legacy revocations in memory, without modifying history. */
export function applyHistoricalRevocationEvidence(
  history: VipHistoryDoc[],
  audits: AuditLogDoc[],
): VipHistoryDoc[] {
  const revoked = historicalRevokedComplimentaryIds(history, audits);
  for (const audit of audits) {
    if (audit.action !== "REVOKE_VIP_ACCESS" || audit.adminId == null || audit.oldValue?.scope !== "grant") continue;
    const id = audit.oldValue.historyId;
    if (typeof id === "string" && history.some((row) => row._id === id && row.userId === audit.targetUserId)) revoked.add(id);
  }
  return history.map((row) => revoked.has(row._id) ? { ...row, status: "REVOKED" as const } : row);
}
