import type {
  VipAccessType,
  VipDurationMeta,
  VipDurationOption,
  VipPlanId,
  VipPricingByPlan,
  VipQuote,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
} from "@/types/vip";

export type VipPricingServer = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  city: string;
  region: string;
  map: string;
  maxPlayers: number;
  pingMs: number;
  status: "live" | "offline" | "maintenance";
  vipPricingByPlan?: VipPricingByPlan;
};

type PricingEnv = {
  individualDefaultPaise: Record<VipPlanId, number>;
  allRetakesPaise: Record<VipPlanId, number>;
};

function parsePaise(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readPricingEnv(
  env: Record<string, string | undefined> = process.env,
): PricingEnv {
  return {
    individualDefaultPaise: {
      "1_month": parsePaise(env.VIP_SERVER_PRICE_1M_PAISE, 9_900),
      "3_months": parsePaise(env.VIP_SERVER_PRICE_3M_PAISE, 27_900),
      "6_months": parsePaise(env.VIP_SERVER_PRICE_6M_PAISE, 54_900),
      "1_year": parsePaise(env.VIP_SERVER_PRICE_1Y_PAISE, 99_900),
    },
    allRetakesPaise: {
      "1_month": parsePaise(env.VIP_ALL_RETAKES_1M_PAISE, 14_900),
      "3_months": parsePaise(env.VIP_ALL_RETAKES_3M_PAISE, 39_900),
      "6_months": parsePaise(env.VIP_ALL_RETAKES_6M_PAISE, 79_900),
      "1_year": parsePaise(env.VIP_ALL_RETAKES_1Y_PAISE, 169_900),
    },
  };
}

export function durationMetas(): VipDurationMeta[] {
  return [
    {
      id: "1_month",
      name: "1 Month",
      months: 1,
      durationDays: 30,
    },
    {
      id: "3_months",
      name: "3 Months",
      months: 3,
      durationDays: 90,
    },
    {
      id: "6_months",
      name: "6 Months",
      months: 6,
      durationDays: 180,
      badge: "popular",
    },
    {
      id: "1_year",
      name: "1 Year",
      months: 12,
      durationDays: 365,
      badge: "best-value",
    },
  ];
}

export function getVipDurationMeta(id: string): VipDurationMeta | null {
  return durationMetas().find((item) => item.id === id) ?? null;
}

export function isVipPlanId(value: string): value is VipPlanId {
  return (
    value === "1_month" ||
    value === "3_months" ||
    value === "6_months" ||
    value === "1_year"
  );
}

export function isVipAccessType(value: string): value is VipAccessType {
  return value === "INDIVIDUAL_SERVER" || value === "ALL_RETAKES";
}

function individualServerPaise(
  server: VipPricingServer,
  planId: VipPlanId,
  env: PricingEnv,
): number {
  const overridden = server.vipPricingByPlan?.[planId];
  if (Number.isFinite(overridden) && (overridden ?? 0) > 0) {
    return overridden as number;
  }
  return env.individualDefaultPaise[planId];
}

function toDurationOptions(
  prices: Record<VipPlanId, number>,
): VipDurationOption[] {
  return durationMetas().map((meta) => {
    const amountPaise = prices[meta.id];
    return {
      id: meta.id,
      name: meta.name,
      months: meta.months,
      badge: meta.badge,
      amountPaise,
      perMonthPaise:
        meta.months > 1 ? Math.round(amountPaise / meta.months) : null,
    };
  });
}

export function buildServerDurationOptions(
  server: VipPricingServer,
  env: PricingEnv = readPricingEnv(),
): VipDurationOption[] {
  const prices = durationMetas().reduce(
    (acc, meta) => {
      acc[meta.id] = individualServerPaise(server, meta.id, env);
      return acc;
    },
    {} as Record<VipPlanId, number>,
  );
  return toDurationOptions(prices);
}

export function buildAllRetakesDurationOptions(
  env: PricingEnv = readPricingEnv(),
): VipDurationOption[] {
  return toDurationOptions(env.allRetakesPaise);
}

export function buildVipShopQuote(input: {
  accessType: VipAccessType;
  serverId?: string | null;
  servers: VipPricingServer[];
  env?: PricingEnv;
}): VipShopQuote {
  const env = input.env ?? readPricingEnv();

  if (input.accessType === "ALL_RETAKES") {
    return {
      accessType: "ALL_RETAKES",
      serverId: null,
      durations: buildAllRetakesDurationOptions(env),
    };
  }

  const liveIds = new Set(input.servers.map((server) => server.id));
  const serverId =
    input.serverId && liveIds.has(input.serverId)
      ? input.serverId
      : (input.servers[0]?.id ?? null);
  const server = input.servers.find((row) => row.id === serverId) ?? null;

  return {
    accessType: "INDIVIDUAL_SERVER",
    serverId,
    durations: server
      ? buildServerDurationOptions(server, env)
      : durationMetas().map((meta) => ({
          id: meta.id,
          name: meta.name,
          months: meta.months,
          badge: meta.badge,
          amountPaise: 0,
          perMonthPaise: null,
        })),
  };
}

export function quoteVipOrder(input: {
  accessType: VipAccessType;
  serverId?: string | null;
  planId: string;
  servers: VipPricingServer[];
  env?: PricingEnv;
}): VipQuote {
  const env = input.env ?? readPricingEnv();
  const meta = getVipDurationMeta(input.planId);
  if (!meta) {
    throw new Error("Unknown VIP duration.");
  }

  if (input.accessType === "ALL_RETAKES") {
    if (input.serverId) {
      throw new Error("All Retakes purchases must not include a server.");
    }
    return {
      accessType: "ALL_RETAKES",
      amountPaise: env.allRetakesPaise[meta.id],
      durationId: meta.id,
      durationDays: meta.durationDays,
      serverId: null,
      bundleKind: "all",
      bundleId: "all_retakes",
    };
  }

  if (!input.serverId) {
    throw new Error("Select a server.");
  }

  const server = input.servers.find((row) => row.id === input.serverId);
  if (!server) {
    throw new Error("Unknown server.");
  }

  return {
    accessType: "INDIVIDUAL_SERVER",
    amountPaise: individualServerPaise(server, meta.id, env),
    durationId: meta.id,
    durationDays: meta.durationDays,
    serverId: server.id,
    bundleKind: "server",
    bundleId: server.id,
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
  env: PricingEnv = readPricingEnv(),
): VipShopCatalog {
  const shopServers: VipShopServer[] = servers.map((server) => {
    const pricingServer: VipPricingServer = {
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
    };
    return {
      ...pricingServer,
      durationOptions: buildServerDurationOptions(pricingServer, env),
    };
  });

  const firstServerId = shopServers[0]?.id ?? null;

  return {
    servers: shopServers,
    allRetakes: {
      durations: buildAllRetakesDurationOptions(env),
    },
    quote: buildVipShopQuote({
      accessType: "INDIVIDUAL_SERVER",
      serverId: firstServerId,
      servers: shopServers,
      env,
    }),
  };
}

export function resolveVipEntitledServerIds(input: {
  accessType?: VipAccessType;
  bundleKind: VipQuote["bundleKind"] | "all" | "server";
  bundleId: string;
  serverId: string | null;
  serverIds: string[];
  eligibleServerIds: string[];
}): string[] | "all" {
  if (
    input.accessType === "ALL_RETAKES" ||
    input.bundleKind === "all" ||
    input.bundleId === "all" ||
    input.bundleId === "all_retakes"
  ) {
    return "all";
  }

  if (input.serverId) {
    return [input.serverId];
  }

  if (input.serverIds.length === 1) {
    return [input.serverIds[0]!];
  }

  if (input.serverIds.length > 1) {
    return input.serverIds.filter((id) => input.eligibleServerIds.includes(id));
  }

  if (input.bundleId.includes("+")) {
    return input.bundleId.split("+").filter(Boolean);
  }

  return input.bundleId ? [input.bundleId] : [];
}
