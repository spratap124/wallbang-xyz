import type { VipHistoryDoc } from "@/types/payments";
import type {
  VipEntitlement,
  VipMembershipSummary,
  VipPlanId,
  VipServerRef,
} from "@/types/vip";
import { durationDaysToMs } from "@/lib/payments/expiry";

/** Complimentary VIP (giveaway / admin grant) — same server as the global-VIP backfill. */
export const COMPLIMENTARY_VIP_SERVER_ID = "retake-1-mumbai";

/** Approximate lifetime when a VIP role has no expiry (`expiresAt: null`). */
export const COMPLIMENTARY_LIFETIME_DURATION_DAYS = 365 * 100;

export type VipMembershipServer = {
  id: string;
  shortName: string;
  name: string;
};

/** Prefer accessType/serverId; never treat individual-server purchases as All Retakes. */
export function isAllRetakesRecord(record: VipHistoryDoc): boolean {
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

export function serverIdsFromRecord(record: VipHistoryDoc): string[] {
  if (isAllRetakesRecord(record)) return [];
  if (record.serverId) return [record.serverId];
  if (record.serverIds.length > 0) return record.serverIds;
  if (
    record.bundleId &&
    record.bundleId !== "all" &&
    record.bundleId !== "all_retakes" &&
    !record.bundleId.includes("+")
  ) {
    return [record.bundleId];
  }
  if (record.bundleId.includes("+")) {
    return record.bundleId.split("+").filter(Boolean);
  }
  return [];
}

/** Stable key: one individual server, or All Retakes. Keys do not stack with each other. */
export function entitlementKeyFromRecord(record: VipHistoryDoc): string | null {
  if (isAllRetakesRecord(record)) return "all_retakes";
  const serverIds = serverIdsFromRecord(record);
  if (serverIds.length === 1) return serverIds[0]!;
  if (serverIds.length > 1) return [...serverIds].sort().join("+");
  return null;
}

export function entitlementKeyFromPurchase(input: {
  accessType?: VipHistoryDoc["accessType"];
  serverId?: string | null;
  serverIds?: string[];
  bundleId?: string | null;
  bundleKind?: VipHistoryDoc["bundleKind"];
}): string | null {
  return entitlementKeyFromRecord({
    _id: "probe",
    userId: "probe",
    steamId: "probe",
    bundleId: input.bundleId ?? input.serverId ?? "all_retakes",
    bundleKind:
      input.bundleKind ??
      (input.serverId || (input.serverIds?.length ?? 0) > 0 ? "server" : "all"),
    accessType: input.accessType,
    serverId: input.serverId ?? null,
    serverIds: input.serverIds ?? [],
    plan: "1_month",
    amount: 0,
    durationDays: 0,
    startDate: new Date(0),
    endDate: new Date(0),
    paymentId: "probe",
    createdAt: new Date(0),
  });
}

/**
 * Per-entitlement expiry (one server or All Retakes):
 * 1. No prior access → purchase date + duration
 * 2. Same entitlement still active → remaining time + new duration
 * 3. Different entitlement → independent (caller passes only that key's records)
 *
 * Never uses the global VIP role expiry.
 */
export function computeEntitlementExpiry(
  records: VipHistoryDoc[],
): Date | null {
  if (records.length === 0) return null;

  const sorted = [...records].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  let expiry: Date | null = null;
  for (const record of sorted) {
    const purchasedAt = record.createdAt;
    // Renew while still active: stack onto remaining end. Otherwise start from purchase.
    const base: Date =
      expiry && expiry.getTime() > purchasedAt.getTime()
        ? expiry
        : purchasedAt;
    expiry = new Date(base.getTime() + durationDaysToMs(record.durationDays));
  }

  return expiry;
}

/** Furthest active entitlement end across all keys (for global VIP role coverage). */
export function furthestEntitlementExpiry(
  history: VipHistoryDoc[],
): Date | null {
  const byKey = new Map<string, VipHistoryDoc[]>();
  for (const record of history) {
    const key = entitlementKeyFromRecord(record);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(record);
    byKey.set(key, list);
  }

  let furthest: Date | null = null;
  for (const records of byKey.values()) {
    const expiry = computeEntitlementExpiry(records);
    if (!expiry) continue;
    if (!furthest || expiry.getTime() > furthest.getTime()) {
      furthest = expiry;
    }
  }
  return furthest;
}

/**
 * True when purchase history grants VIP on this game server right now:
 * active All Retakes bundle, or an active individual entitlement for serverId.
 */
export function hasActiveVipEntitlementForServer(input: {
  history: VipHistoryDoc[];
  serverId: string;
  now?: Date;
}): boolean {
  const serverId = input.serverId.trim();
  if (!serverId) return false;
  const now = input.now ?? new Date();

  const bundleExpiry = computeEntitlementExpiry(
    input.history.filter(isAllRetakesRecord),
  );
  if (bundleExpiry && bundleExpiry.getTime() > now.getTime()) {
    return true;
  }

  const serverRecords = input.history.filter((record) =>
    serverIdsFromRecord(record).includes(serverId),
  );
  const serverExpiry = computeEntitlementExpiry(serverRecords);
  return Boolean(serverExpiry && serverExpiry.getTime() > now.getTime());
}

export function pickComplimentaryVipPlan(durationDays: number): VipPlanId {
  if (durationDays >= 365) return "1_year";
  if (durationDays >= 180) return "6_months";
  if (durationDays >= 90) return "3_months";
  return "1_month";
}

/**
 * Days to insert so stacked individual-server expiry reaches `coversUntil`.
 * `null` means already covered, or the target is not in the future.
 */
export function durationDaysToCoverUntil(input: {
  currentExpiry: Date | null;
  coversUntil: Date;
  now?: Date;
}): number | null {
  const now = input.now ?? new Date();
  const target = input.coversUntil;
  if (target.getTime() <= now.getTime()) return null;
  if (input.currentExpiry && input.currentExpiry.getTime() >= target.getTime()) {
    return null;
  }
  const base =
    input.currentExpiry && input.currentExpiry.getTime() > now.getTime()
      ? input.currentExpiry
      : now;
  return Math.max(
    1,
    Math.ceil((target.getTime() - base.getTime()) / durationDaysToMs(1)),
  );
}

function serverName(
  serverId: string,
  serversById: Map<string, VipMembershipServer>,
): string {
  return (
    serversById.get(serverId)?.shortName ??
    serversById.get(serverId)?.name ??
    serverId
  );
}

export function buildSummary(
  entitlements: VipEntitlement[],
  lifetime: boolean,
): VipMembershipSummary | null {
  if (lifetime) {
    return {
      activeCount: 1,
      serverCount: entitlements.reduce(
        (count, item) =>
          item.kind === "bundle"
            ? count + item.includedServers.length
            : item.kind === "individual"
              ? count + 1
              : count,
        0,
      ),
      headline: "Lifetime VIP",
      subline: "Your VIP access does not expire.",
    };
  }

  const active = entitlements.filter((item) => item.status === "active");
  if (active.length === 0) return null;

  const bundle = active.find((item) => item.kind === "bundle");
  if (bundle && bundle.kind === "bundle") {
    return {
      activeCount: 1,
      serverCount: bundle.includedServers.length,
      headline: "VIP Active",
      subline: `All Retakes Bundle · ${bundle.includedServers.length} server${
        bundle.includedServers.length === 1 ? "" : "s"
      } included`,
    };
  }

  const individuals = active.filter((item) => item.kind === "individual");
  const serverCount = individuals.length;

  return {
    activeCount: serverCount,
    serverCount,
    headline: "VIP Active",
    subline: `${serverCount} active membership${serverCount === 1 ? "" : "s"} · ${serverCount} server${serverCount === 1 ? "" : "s"}`,
  };
}

export function buildEntitlementsFromHistory(input: {
  history: VipHistoryDoc[];
  lifetime: boolean;
  overallExpiresAt: Date | null;
  eligibleServers: VipMembershipServer[];
  now?: Date;
}): VipEntitlement[] {
  const now = input.now ?? new Date();
  const serversById = new Map(
    input.eligibleServers.map((server) => [server.id, server]),
  );
  const includedServers: VipServerRef[] = input.eligibleServers.map(
    (server) => ({
      id: server.id,
      name: server.shortName || server.name,
    }),
  );

  if (input.lifetime) {
    const hasBundle = input.history.some(isAllRetakesRecord);
    if (hasBundle) {
      return [
        {
          kind: "bundle",
          bundleId: "all_retakes",
          label: "All Retakes Bundle",
          expiresAt: null,
          status: "active",
          includedServers,
        },
      ];
    }

    const serverIds = new Set<string>();
    for (const record of input.history) {
      for (const id of serverIdsFromRecord(record)) {
        serverIds.add(id);
      }
    }

    if (serverIds.size > 0) {
      return [...serverIds].map((serverId) => ({
        kind: "individual" as const,
        serverId,
        serverName: serverName(serverId, serversById),
        expiresAt: null,
        status: "active" as const,
      }));
    }

    return [
      {
        kind: "lifetime",
        label: "WallBang VIP",
        expiresAt: null,
        status: "active",
      },
    ];
  }

  const bundleRecords = input.history.filter(isAllRetakesRecord);
  const bundleExpiry = computeEntitlementExpiry(bundleRecords);
  if (bundleExpiry && bundleExpiry.getTime() > now.getTime()) {
    return [
      {
        kind: "bundle",
        bundleId: "all_retakes",
        label: "All Retakes Bundle",
        expiresAt: bundleExpiry.toISOString(),
        status: "active",
        includedServers,
      },
    ];
  }

  const recordsByServer = new Map<string, VipHistoryDoc[]>();
  for (const record of input.history) {
    for (const serverId of serverIdsFromRecord(record)) {
      const list = recordsByServer.get(serverId) ?? [];
      list.push(record);
      recordsByServer.set(serverId, list);
    }
  }

  const individuals: VipEntitlement[] = [];
  for (const [serverId, records] of recordsByServer) {
    const expiresAt = computeEntitlementExpiry(records);
    if (!expiresAt) continue;
    if (expiresAt.getTime() <= now.getTime()) continue;
    individuals.push({
      kind: "individual",
      serverId,
      serverName: serverName(serverId, serversById),
      expiresAt: expiresAt.toISOString(),
      status: "active",
    });
  }

  if (individuals.length > 0) {
    return individuals.sort((a, b) =>
      a.kind === "individual" && b.kind === "individual"
        ? a.serverName.localeCompare(b.serverName)
        : 0,
    );
  }

  if (
    input.overallExpiresAt &&
    input.overallExpiresAt.getTime() > now.getTime()
  ) {
    return [
      {
        kind: "general",
        label: "WallBang VIP",
        expiresAt: input.overallExpiresAt.toISOString(),
        status: "active",
      },
    ];
  }

  return [];
}
