import "server-only";

import { isVipPlanId, quoteVipSelection } from "@/lib/payments/quote";
import type {
  VipDuration,
  VipPlanId,
  VipQuote,
  VipShopCatalog,
  VipShopServer,
} from "@/types/vip";

export type { VipDuration, VipPlanId, VipShopCatalog, VipShopServer };
export { isVipPlanId, quoteVipSelection };

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
  }>,
): VipShopCatalog {
  return {
    servers: servers.map((server) => ({
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
    })),
    durations: durations(),
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
  const quote = quoteVipSelection({
    selectedServerIds: input.selectedServerIds,
    liveServerIds: input.servers.map((server) => server.id),
    duration,
  });
  if (quote.serverCount === 0) {
    throw new Error("Select at least one server.");
  }
  return quote;
}

export { formatInrFromPaise } from "@/lib/payments/format";
