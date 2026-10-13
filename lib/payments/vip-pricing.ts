import type {
  VipAccessType,
  VipBundleDoc,
  VipDurationMeta,
  VipDurationOption,
  VipPlanId,
  VipPricingByPlan,
  VipQuote,
  VipShopBundle,
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

/** Minimal bundle shape needed for pricing/quotes. */
export type VipPricingBundle = Pick<
  VipBundleDoc,
  "id" | "name" | "serverIds" | "pricingByPlan" | "enabled"
> & {
  /** Optional: marks the bundle as the shop's "Recommended" option. */
  featured?: boolean;
};

type PricingEnv = {
  individualDefaultPaise: Record<VipPlanId, number>;
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
  return (
    value === "INDIVIDUAL_SERVER" ||
    value === "ALL_RETAKES" ||
    value === "BUNDLE"
  );
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
      durationDays: meta.durationDays,
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

function bundlePaise(bundle: VipPricingBundle, planId: VipPlanId): number {
  const amount = bundle.pricingByPlan?.[planId];
  if (!Number.isFinite(amount) || (amount ?? 0) <= 0) {
    throw new Error("Bundle pricing is incomplete for this duration.");
  }
  return amount as number;
}

export function buildBundleDurationOptions(
  bundle: VipPricingBundle,
): VipDurationOption[] {
  const prices = durationMetas().reduce(
    (acc, meta) => {
      acc[meta.id] = bundlePaise(bundle, meta.id);
      return acc;
    },
    {} as Record<VipPlanId, number>,
  );
  return toDurationOptions(prices);
}

function toShopBundle(
  bundle: VipPricingBundle,
  servers: VipPricingServer[],
): VipShopBundle {
  const serverIds = bundle.serverIds.filter((id) =>
    servers.some((server) => server.id === id),
  );
  return {
    id: bundle.id,
    name: bundle.name,
    description: (bundle as VipBundleDoc).description ?? null,
    serverIds,
    servers: serverIds.map((id) => {
      const server = servers.find((row) => row.id === id)!;
      return { id: server.id, name: server.shortName || server.name };
    }),
    durations: buildBundleDurationOptions(bundle),
    featured: bundle.featured ?? false,
  };
}

export function buildVipShopQuote(input: {
  accessType: VipAccessType;
  serverId?: string | null;
  bundleId?: string | null;
  servers: VipPricingServer[];
  bundles?: VipPricingBundle[];
  env?: PricingEnv;
}): VipShopQuote {
  const env = input.env ?? readPricingEnv();

  if (input.accessType === "ALL_RETAKES") {
    // Retired: kept only so historical records remain readable.
    throw new Error("All Retakes is no longer available.");
  }

  if (input.accessType === "BUNDLE") {
    const bundle =
      input.bundles?.find((row) => row.id === input.bundleId && row.enabled) ??
      input.bundles?.find((row) => row.enabled) ??
      null;
    if (!bundle) {
      throw new Error("No VIP bundles are available.");
    }
    return {
      accessType: "BUNDLE",
      serverId: null,
      bundleId: bundle.id,
      durations: buildBundleDurationOptions(bundle),
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
    bundleId: null,
    durations: server
      ? buildServerDurationOptions(server, env)
      : durationMetas().map((meta) => ({
          id: meta.id,
          name: meta.name,
          months: meta.months,
          durationDays: meta.durationDays,
          badge: meta.badge,
          amountPaise: 0,
          perMonthPaise: null,
        })),
  };
}

export function quoteVipOrder(input: {
  accessType: VipAccessType;
  serverId?: string | null;
  bundleId?: string | null;
  planId: string;
  servers: VipPricingServer[];
  bundles?: VipPricingBundle[];
  env?: PricingEnv;
}): VipQuote {
  const env = input.env ?? readPricingEnv();
  const meta = getVipDurationMeta(input.planId);
  if (!meta) {
    throw new Error("Unknown VIP duration.");
  }

  if (input.accessType === "ALL_RETAKES") {
    // Retired: existing purchases keep their entitlements, nothing new is sold.
    throw new Error("All Retakes is no longer available.");
  }

  if (input.accessType === "BUNDLE") {
    if (!input.bundleId) {
      throw new Error("Select a bundle.");
    }
    const bundle = input.bundles?.find((row) => row.id === input.bundleId);
    if (!bundle) {
      throw new Error("Unknown bundle.");
    }
    if (!bundle.enabled) {
      throw new Error("This bundle is not available.");
    }
    const serverIds = bundle.serverIds.filter((id) =>
      input.servers.some((server) => server.id === id),
    );
    if (serverIds.length === 0) {
      throw new Error("This bundle has no available servers.");
    }
    return {
      accessType: "BUNDLE",
      amountPaise: bundlePaise(bundle, meta.id),
      durationId: meta.id,
      durationDays: meta.durationDays,
      serverId: null,
      serverIds,
      bundleKind: "custom",
      bundleId: bundle.id,
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
    serverIds: [server.id],
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
  options: { bundles?: VipPricingBundle[]; env?: PricingEnv } = {},
): VipShopCatalog {
  const env = options.env ?? readPricingEnv();
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
  const enabledBundles = (options.bundles ?? []).filter(
    (bundle) => bundle.enabled,
  );

  return {
    servers: shopServers,
    bundles: enabledBundles.map((bundle) => toShopBundle(bundle, shopServers)),
    quote: buildVipShopQuote({
      accessType: "INDIVIDUAL_SERVER",
      serverId: firstServerId,
      servers: shopServers,
      bundles: enabledBundles,
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
