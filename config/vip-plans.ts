import "server-only";

import { isVipPlanId } from "@/lib/payments/quote";
import type {
  VipDuration,
  VipDurationOption,
  VipPlanId,
  VipPricingByPlan,
  VipQuote,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
} from "@/types/vip";

export type {
  VipDuration,
  VipDurationOption,
  VipPlanId,
  VipPricingByPlan,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
};
export { isVipPlanId };

function parsePaise(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function durations(): VipDuration[] {
  return [
    {
      id: "1_month",
      name: "1 Month",
      months: 1,
      durationDays: 30,
      perServerPaise: parsePaise(process.env.VIP_SERVER_PRICE_1M_PAISE, 9_900),
      allServersPaise: parsePaise(process.env.VIP_PRICE_1M_PAISE, 9_900),
    },
    {
      id: "3_months",
      name: "3 Months",
      months: 3,
      durationDays: 90,
      perServerPaise: parsePaise(process.env.VIP_SERVER_PRICE_3M_PAISE, 27_900),
      allServersPaise: parsePaise(process.env.VIP_PRICE_3M_PAISE, 27_900),
    },
    {
      id: "6_months",
      name: "6 Months",
      months: 6,
      durationDays: 180,
      perServerPaise: parsePaise(process.env.VIP_SERVER_PRICE_6M_PAISE, 54_900),
      allServersPaise: parsePaise(process.env.VIP_PRICE_6M_PAISE, 54_900),
      badge: "popular" as const,
    },
    {
      id: "1_year",
      name: "1 Year",
      months: 12,
      durationDays: 365,
      perServerPaise: parsePaise(process.env.VIP_SERVER_PRICE_1Y_PAISE, 99_900),
      allServersPaise: parsePaise(process.env.VIP_PRICE_1Y_PAISE, 99_900),
      badge: "best-value" as const,
    },
  ];
}

export function getVipDuration(id: string): VipDuration | null {
  return durations().find((item) => item.id === id) ?? null;
}

function sanitizeSelectedServerIds(input: {
  selectedServerIds: string[];
  liveServerIds: string[];
}): string[] {
  const live = new Set(input.liveServerIds);
  return [...new Set(input.selectedServerIds)]
    .filter((id) => live.has(id))
    .sort();
}

function effectivePerServerPaise(server: VipShopServer, duration: VipDuration): number {
  const overridden = server.vipPricingByPlan?.[duration.id];
  return Number.isFinite(overridden) && (overridden ?? 0) > 0
    ? (overridden as number)
    : duration.perServerPaise;
}

function quoteVipSelectionByServers(input: {
  selectedServerIds: string[];
  servers: VipShopServer[];
  duration: VipDuration;
}): VipQuote {
  const liveServerIds = input.servers.map((server) => server.id);
  const serverIds = sanitizeSelectedServerIds({
    selectedServerIds: input.selectedServerIds,
    liveServerIds,
  });
  const selectedServers = input.servers.filter((server) => serverIds.includes(server.id));
  const serverCount = selectedServers.length;
  const stacked = selectedServers.reduce(
    (sum, server) => sum + effectivePerServerPaise(server, input.duration),
    0,
  );
  const usesCustomPricing = selectedServers.some((server) => {
    const override = server.vipPricingByPlan?.[input.duration.id];
    return Number.isFinite(override) && (override ?? 0) > 0;
  });
  const allLiveSelected =
    serverCount > 0 && serverCount === input.servers.length;
  // Global fleet cap applies only for default pricing when all servers are selected.
  const amountPaise =
    serverCount === 0
      ? 0
      : usesCustomPricing || !allLiveSelected
        ? stacked
        : Math.min(stacked, input.duration.allServersPaise);
  const fleetRate =
    !usesCustomPricing &&
    allLiveSelected &&
    amountPaise === input.duration.allServersPaise;

  return {
    amountPaise,
    serverCount,
    fleetRate,
    durationId: input.duration.id,
    durationDays: input.duration.durationDays,
    serverIds,
  };
}

function serverAmountsForDuration(input: {
  selectedServers: VipShopServer[];
  duration: VipDuration;
}): Array<{ serverId: string; amountPaise: number }> {
  return input.selectedServers.map((server) => ({
    serverId: server.id,
    amountPaise: effectivePerServerPaise(server, input.duration),
  }));
}

export function buildVipShopQuote(input: {
  servers: VipShopServer[];
  selectedServerIds: string[];
}): VipShopQuote {
  const liveIds = input.servers.map((server) => server.id);
  const firstServerId = liveIds[0];
  const selectedServerIds =
    input.selectedServerIds.length > 0
      ? input.selectedServerIds
      : firstServerId
        ? [firstServerId]
        : [];

  const durationOptions: VipDurationOption[] = durations().map((duration) => {
    const priced = quoteVipSelectionByServers({
      selectedServerIds,
      servers: input.servers,
      duration,
    });
    const selectedServers = input.servers.filter((server) =>
      priced.serverIds.includes(server.id),
    );
    return {
      id: duration.id,
      name: duration.name,
      months: duration.months,
      badge: duration.badge,
      amountPaise: priced.amountPaise,
      perMonthPaise:
        duration.months > 1
          ? Math.round(priced.amountPaise / duration.months)
          : null,
      serverAmounts: serverAmountsForDuration({
        selectedServers,
        duration,
      }),
    };
  });

  const serverIds = quoteVipSelectionByServers({
    selectedServerIds,
    servers: input.servers,
    duration: durations()[0]!,
  }).serverIds;

  return {
    serverIds,
    durations: durationOptions,
  };
}

export function getVipShopCatalog(
  servers: Array<{
    id: string;
    name: string;
    shortName: string;
    mode: string;
    city: string;
    region: string;
    map: string;
    maxPlayers: number;
    maxPlayersOverride?: number | null;
    pingMs: number;
    status: "live" | "offline" | "maintenance";
    vipPricingByPlan?: VipPricingByPlan | null;
  }>,
): VipShopCatalog {
  const shopServers: VipShopServer[] = servers.map((server) => ({
    id: server.id,
    name: server.name,
    shortName: server.shortName || server.name,
    mode: server.mode,
    city: server.city,
    region: server.region,
    map: server.map,
    maxPlayers: server.maxPlayersOverride ?? server.maxPlayers,
    pingMs: server.pingMs,
    status: server.status,
    vipPricingByPlan: server.vipPricingByPlan ?? undefined,
  }));

  return {
    servers: shopServers,
    quote: buildVipShopQuote({
      servers: shopServers,
      selectedServerIds: shopServers.slice(0, 1).map((server) => server.id),
    }),
  };
}

export function quoteVipOrder(input: {
  servers: VipShopServer[];
  selectedServerIds: string[];
  planId: string;
}): VipQuote {
  const duration = getVipDuration(input.planId);
  if (!duration) {
    throw new Error("Unknown VIP duration.");
  }
  const quote = quoteVipSelectionByServers({
    selectedServerIds: input.selectedServerIds,
    servers: input.servers,
    duration,
  });
  if (quote.serverCount === 0) {
    throw new Error("Select at least one server.");
  }
  return quote;
}

export { formatInrFromPaise } from "@/lib/payments/format";
