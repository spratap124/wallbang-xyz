import "server-only";

import type { ClientSession } from "mongodb";
import { vipHistoryCollection } from "@/lib/payments/collections";
import { auditLogsCollection } from "@/lib/permissions/collections";
import { applyHistoricalRevocationEvidence } from "@/lib/payments/legacy-vip-evidence";
import type { VipHistoryDoc } from "@/types/payments";

/** Read history with verified legacy revocations applied only in memory. */
export async function loadEffectiveVipHistory(userId: string, session?: ClientSession): Promise<VipHistoryDoc[]> {
  const history = await (await vipHistoryCollection()).find({ userId }, { session }).sort({ createdAt: 1 }).toArray();
  const audits = await (await auditLogsCollection()).find({
    targetUserId: userId,
    action: { $in: ["GRANT_ROLE", "REVOKE_ROLE", "REVOKE_VIP_ACCESS"] },
  }, { session }).toArray();
  return applyHistoricalRevocationEvidence(history, audits);
}
