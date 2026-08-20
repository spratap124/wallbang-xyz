import "server-only";

import { vipHistoryCollection } from "@/lib/payments/collections";
import { getVipAccessStatus } from "@/lib/payments/service";
import type { VipHistoryDoc } from "@/types/payments";
import type {
  VipEntitlement,
  VipMembershipSummary,
  VipMembershipView,
  VipServerRef,
} from "@/types/vip";

export type VipMembershipServer = {
  id: string;
  shortName: string;
  name: string;
};

function isAllRetakesRecord(record: VipHistoryDoc): boolean {
  return (
    record.accessType === "ALL_RETAKES" ||
    record.bundleKind === "all" ||
    record.bundleId === "all" ||
    record.bundleId === "all_retakes"
  );
}

function serverIdsFromRecord(record: VipHistoryDoc): string[] {
  if (isAllRetakesRecord(record)) return [];
  if (record.serverId) return [record.serverId];
  if (record.serverIds.length > 0) return record.serverIds;
  if (record.bundleId && !record.bundleId.includes("+")) {
    return [record.bundleId];
  }
  if (record.bundleId.includes("+")) {
    return record.bundleId.split("+").filter(Boolean);
  }
  return [];
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

function buildSummary(
  entitlements: VipEntitlement[],
  lifetime: boolean,
  overallExpiresAt: Date | null,
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

function buildEntitlementsFromHistory(input: {
  history: VipHistoryDoc[];
  vipActive: boolean;
  lifetime: boolean;
  overallExpiresAt: Date | null;
  eligibleServers: VipMembershipServer[];
}): VipEntitlement[] {
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

  if (!input.vipActive) {
    return [];
  }

  const expiresIso = input.overallExpiresAt?.toISOString() ?? null;
  const hasBundle = input.history.some(isAllRetakesRecord);

  if (hasBundle) {
    return [
      {
        kind: "bundle",
        bundleId: "all_retakes",
        label: "All Retakes Bundle",
        expiresAt: expiresIso,
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
      expiresAt: expiresIso,
      status: "active" as const,
    }));
  }

  return [
    {
      kind: "general",
      label: "WallBang VIP",
      expiresAt: expiresIso,
      status: "active",
    },
  ];
}

export async function getUserVipMembership(input: {
  userId: string;
  eligibleServers: VipMembershipServer[];
}): Promise<VipMembershipView> {
  const [status, historyCol] = await Promise.all([
    getVipAccessStatus(input.userId),
    vipHistoryCollection(),
  ]);

  const history = await historyCol
    .find({ userId: input.userId })
    .sort({ createdAt: -1 })
    .toArray();

  const now = new Date();
  const vipActive =
    status.isVip &&
    (status.lifetime || (status.expiresAt ? status.expiresAt > now : false));

  const lastExpiredAt =
    !vipActive && history.length > 0
      ? history
          .map((record) => record.endDate)
          .filter((date) => date <= now)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
      : status.expiresAt && status.expiresAt <= now
        ? status.expiresAt
        : null;

  const entitlements = buildEntitlementsFromHistory({
    history,
    vipActive,
    lifetime: status.lifetime,
    overallExpiresAt: status.expiresAt,
    eligibleServers: input.eligibleServers,
  });

  const summary =
    vipActive || status.lifetime
      ? buildSummary(entitlements, status.lifetime, status.expiresAt)
      : null;

  return {
    hasActiveVip: vipActive || status.lifetime,
    lifetime: status.lifetime,
    overallExpiresAt: status.expiresAt?.toISOString() ?? null,
    lastExpiredAt: lastExpiredAt?.toISOString() ?? null,
    entitlements,
    summary,
  };
}
