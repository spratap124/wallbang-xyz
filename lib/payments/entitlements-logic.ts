import type { VipHistoryDoc } from "@/types/payments";
import type {
  VipBundleEntitlement,
  VipEntitlement,
  VipIndividualEntitlement,
  VipPurchaseRecord,
  VipMembershipSummary,
  VipPlanId,
  VipServerRef,
} from "@/types/vip";
import { computeVipExtension, durationDaysToMs } from "@/lib/payments/expiry";

/** Complimentary VIP (giveaway / admin grant) — same server as the global-VIP backfill. */
export const COMPLIMENTARY_VIP_SERVER_ID = "retake-3-mumbai";

/** Entitlement key covering every retake server. */
export const ALL_RETAKES_ENTITLEMENT_KEY = "all_retakes";

/** Dedup admin keys and collapse All Retakes so it is never stacked with servers. */
export function normalizeAdminEntitlementKeys(
  keys: string[],
  validServerIds: Iterable<string>,
): { keys: string[]; unknown: string[] } {
  const valid = new Set(validServerIds);
  const unique = [
    ...new Set(keys.map((key) => key.trim()).filter(Boolean)),
  ];
  const unknown = unique.filter(
    (key) => key !== ALL_RETAKES_ENTITLEMENT_KEY && !valid.has(key),
  );
  return {
    keys: unique.includes(ALL_RETAKES_ENTITLEMENT_KEY)
      ? [ALL_RETAKES_ENTITLEMENT_KEY]
      : unique,
    unknown,
  };
}

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

/** True for purchases of an admin-managed custom bundle. */
export function isCustomBundleRecord(record: VipHistoryDoc): boolean {
  if (isAllRetakesRecord(record)) return false;
  return record.accessType === "BUNDLE" || record.bundleKind === "custom";
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

/** Bundle label captured at purchase time when available. */
export function bundleLabelFromRecord(record: VipHistoryDoc): string {
  const label = (record as VipHistoryDoc & { bundleName?: string | null }).bundleName;
  return label?.trim() || record.bundleId || "Bundle";
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

/**
 * Build a `vip_history` row for an admin-issued entitlement — one server, or
 * `all_retakes` for every server. Stacks onto `currentExpiry` when that
 * entitlement is still active so granted days are never swallowed.
 */
export function buildGrantedEntitlementRecord(input: {
  id: string;
  userId: string;
  steamId: string;
  entitlementKey: string;
  durationDays: number;
  paymentId: string;
  currentExpiry: Date | null;
  now: Date;
}): VipHistoryDoc {
  const key = input.entitlementKey.trim();
  const allRetakes = key === ALL_RETAKES_ENTITLEMENT_KEY;
  const { startDate, endDate } = computeVipExtension({
    currentExpiresAt: input.currentExpiry,
    now: input.now,
    durationDays: input.durationDays,
  });

  return {
    _id: input.id,
    userId: input.userId,
    steamId: input.steamId,
    bundleId: allRetakes ? ALL_RETAKES_ENTITLEMENT_KEY : key,
    bundleKind: allRetakes ? "all" : "server",
    accessType: allRetakes ? "ALL_RETAKES" : "INDIVIDUAL_SERVER",
    serverId: allRetakes ? null : key,
    serverIds: allRetakes ? [] : [key],
    plan: pickComplimentaryVipPlan(input.durationDays),
    amount: 0,
    durationDays: input.durationDays,
    startDate,
    endDate,
    paymentId: input.paymentId,
    createdAt: input.now,
  };
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

export type VipMembershipAggregate = {
  entitlements: VipEntitlement[];
  purchaseHistory: VipPurchaseRecord[];
};

export function buildMembershipFromHistory(input: {
  history: VipHistoryDoc[];
  lifetime: boolean;
  overallExpiresAt: Date | null;
  eligibleServers: VipMembershipServer[];
  now?: Date;
}): VipMembershipAggregate {
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
      return {
        entitlements: [
          {
            kind: "bundle",
            bundleId: "all_retakes",
            label: "All Retakes Bundle",
            expiresAt: null,
            status: "active",
            includedServers,
          },
        ],
        purchaseHistory: [],
      };
    }

    const serverIds = new Set<string>();
    for (const record of input.history) {
      for (const id of serverIdsFromRecord(record)) {
        serverIds.add(id);
      }
    }

    if (serverIds.size > 0) {
      return {
        entitlements: [...serverIds].map((serverId) => ({
          kind: "individual" as const,
          serverId,
          serverName: serverName(serverId, serversById),
          expiresAt: null,
          status: "active" as const,
        })),
        purchaseHistory: [],
      };
    }

    return {
      entitlements: [
        {
          kind: "lifetime",
          label: "WallBang VIP",
          expiresAt: null,
          status: "active",
        },
      ],
      purchaseHistory: [],
    };
  }

  const nowMs = now.getTime();
  const active = (expiry: Date | null): Date | null =>
    expiry && expiry.getTime() > nowMs ? expiry : null;

  // --- bundles: legacy All Retakes plus each custom bundle ---
  const legacyAllRetakes = input.history.filter(isAllRetakesRecord);
  const legacyExpiry = active(computeEntitlementExpiry(legacyAllRetakes));

  const customByBundle = new Map<string, VipHistoryDoc[]>();
  for (const record of input.history) {
    if (!isCustomBundleRecord(record)) continue;
    const list = customByBundle.get(record.bundleId) ?? [];
    list.push(record);
    customByBundle.set(record.bundleId, list);
  }

  const bundles: VipBundleEntitlement[] = [];
  if (legacyExpiry) {
    bundles.push({
      kind: "bundle",
      bundleId: "all_retakes",
      label: "All Retakes Bundle",
      expiresAt: legacyExpiry.toISOString(),
      status: "active",
      includedServers,
    });
  }

  /** Server ids each bundle currently covers, and its expiry. */
  const bundleServerIds = new Map<string, { expiry: Date; serverIds: string[] }>();
  for (const [bundleId, records] of customByBundle) {
    const expiry = active(computeEntitlementExpiry(records));
    if (!expiry) continue;
    const serverIds = [
      ...new Set(records.flatMap((record) => serverIdsFromRecord(record))),
    ];
    bundles.push({
      kind: "bundle",
      bundleId,
      label: bundleLabelFromRecord(records[0]!),
      expiresAt: expiry.toISOString(),
      status: "active",
      includedServers: serverIds.flatMap((id) => {
        const server = serversById.get(id);
        return server
          ? [{ id: server.id, name: server.shortName || server.name }]
          : [];
      }),
    });
    bundleServerIds.set(bundleId, { expiry, serverIds });
  }

  // Effective bundle coverage per server = the latest bundle expiry covering it.
  const bundleCoverage = new Map<string, Date>();
  for (const { expiry, serverIds } of bundleServerIds.values()) {
    for (const serverId of serverIds) {
      const current = bundleCoverage.get(serverId);
      if (!current || expiry.getTime() > current.getTime()) {
        bundleCoverage.set(serverId, expiry);
      }
    }
  }

  // --- individual purchases ---
  const individualRecords = input.history.filter(
    (record) =>
      !isAllRetakesRecord(record) &&
      !isCustomBundleRecord(record) &&
      serverIdsFromRecord(record).length > 0,
  );

  const purchasedAtOf = (records: VipHistoryDoc[]): Date =>
    records.reduce(
      (earliest, record) =>
        record.createdAt.getTime() < earliest.getTime() ? record.createdAt : earliest,
      records[0]!.createdAt,
    );

  const individuals: VipIndividualEntitlement[] = [];
  const purchaseHistory: VipPurchaseRecord[] = [];
  const individualsByServer = new Map<string, VipHistoryDoc[]>();
  for (const record of individualRecords) {
    for (const serverId of serverIdsFromRecord(record)) {
      const list = individualsByServer.get(serverId) ?? [];
      list.push(record);
      individualsByServer.set(serverId, list);
    }
  }

  for (const [serverId, records] of individualsByServer) {
    const expiry = computeEntitlementExpiry(records);
    const bundleCovers = bundleCoverage.get(serverId) ?? null;
    const effective = expiry ?? bundleCovers;
    const coveredByBundle = Boolean(
      bundleCovers &&
        (!expiry ||
          bundleCovers.getTime() >= expiry.getTime() ||
          bundleCovers.getTime() > nowMs),
    );

    purchaseHistory.push({
      serverId,
      serverName: serverName(serverId, serversById),
      purchasedAt: purchasedAtOf(records).toISOString(),
      expiresAt: expiry ? expiry.toISOString() : null,
      coveredByBundle,
    });

    // Only surface an individual row when it is what actually grants access:
    // no bundle covers the server, or the individual term outlasts the bundle.
    const bundleLonger = bundleCovers && (!expiry || bundleCovers.getTime() >= expiry.getTime());
    if (bundleLonger || !effective || effective.getTime() <= nowMs) continue;

    individuals.push({
      kind: "individual",
      serverId,
      serverName: serverName(serverId, serversById),
      expiresAt: effective.toISOString(),
      status: "active",
    });
  }

  purchaseHistory.sort(
    (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime(),
  );

  if (bundles.length > 0 || individuals.length > 0) {
    return {
      entitlements: [
        ...bundles,
        ...individuals.sort((a, b) => a.serverName.localeCompare(b.serverName)),
      ],
      purchaseHistory,
    };
  }

  if (
    input.overallExpiresAt &&
    input.overallExpiresAt.getTime() > now.getTime()
  ) {
    return {
      entitlements: [
        {
          kind: "general",
          label: "WallBang VIP",
          expiresAt: input.overallExpiresAt.toISOString(),
          status: "active",
        },
      ],
      purchaseHistory,
    };
  }

  return { entitlements: [], purchaseHistory };
}

/** @deprecated Use buildMembershipFromHistory for purchase history too. */
export function buildEntitlementsFromHistory(input: {
  history: VipHistoryDoc[];
  lifetime: boolean;
  overallExpiresAt: Date | null;
  eligibleServers: VipMembershipServer[];
  now?: Date;
}): VipEntitlement[] {
  return buildMembershipFromHistory(input).entitlements;
}
