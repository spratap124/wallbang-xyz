import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import { durationMetas, readPricingEnv } from "@/lib/payments/vip-pricing";
import { listVipBundleDocs } from "@/lib/payments/bundles";
import { getGameServers } from "@/lib/servers/registry";
import type {
  VipDurationOption,
  VipPlanId,
  VipPromotionDoc,
  VipPromotionPrice,
  VipPromotionTarget,
  VipPromotionTargetType,
  VipPromotionView,
  VipShopCatalog,
} from "@/types/vip";
import { isPromotionActiveAt, mergeDefined, promotionPrice } from "@/lib/payments/promotion-logic";

const COLLECTION = "vip_promotions";
const LOCKS = "vip_promotion_locks";
const MUTATION_LOCK_ID = "promotion-mutations";
const LOCK_LEASE_MS = 120_000;
let indexesReady: Promise<void> | null = null;

async function collection(): Promise<Collection<VipPromotionDoc>> {
  const db = await getDb();
  return db.collection<VipPromotionDoc>(COLLECTION);
}

export async function ensureVipPromotionIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await collection();
      await Promise.all([
        col.createIndex({ id: 1 }, { unique: true }),
        col.createIndex({ enabled: 1, startsAt: 1, endsAt: 1 }),
        col.createIndex({ "targets.targetType": 1, "targets.targetId": 1, enabled: 1 }),
      ]);
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  return indexesReady;
}

export async function withPromotionMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const db = await getDb();
  const locks = db.collection<{ _id: string; owner: string; expiresAt: Date }>(LOCKS);
  const now = new Date();
  const owner = crypto.randomUUID();
  await locks.deleteOne({ _id: MUTATION_LOCK_ID, expiresAt: { $lte: now } });
  try {
    await locks.insertOne({
      _id: MUTATION_LOCK_ID,
      owner,
      expiresAt: new Date(now.getTime() + LOCK_LEASE_MS),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new Error("Another promotion change is being saved. Try again shortly.");
    }
    throw error;
  }
  try {
    return await operation();
  } finally {
    await locks.deleteOne({ _id: MUTATION_LOCK_ID, owner });
  }
}

export function promotionStatus(promotion: VipPromotionDoc, now = new Date()): VipPromotionView["status"] {
  if (!promotion.enabled) return "disabled";
  if (now < promotion.startsAt) return "scheduled";
  return isPromotionActiveAt(promotion, now) ? "active" : "expired";
}

export function toPromotionView(promotion: VipPromotionDoc, now = new Date()): VipPromotionView {
  return {
    ...promotion,
    targets: Array.isArray(promotion.targets) ? promotion.targets : [],
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
    status: promotionStatus(promotion, now),
  };
}

export async function listVipPromotions(): Promise<VipPromotionView[]> {
  await ensureVipPromotionIndexes();
  const docs = await (await collection()).find({}).sort({ startsAt: -1, createdAt: -1 }).toArray();
  const now = new Date();
  return docs.map((doc) => toPromotionView(doc, now));
}

export async function getVipPromotion(id: string): Promise<VipPromotionDoc | null> {
  await ensureVipPromotionIndexes();
  return (await collection()).findOne({ id });
}

function key(targetType: VipPromotionTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

export async function validatePromotionTargets(targets: VipPromotionTarget[]): Promise<void> {
  const servers = await getGameServers({ includeDisabled: true });
  const bundles = await listVipBundleDocs();
  const serverById = new Map(servers.map((row) => [row.id, row]));
  const bundleById = new Map(bundles.map((row) => [row.id, row]));
  const defaults = readPricingEnv().individualDefaultPaise;
  const seen = new Set<string>();
  for (const target of targets) {
    const targetKey = key(target.targetType, target.targetId);
    if (seen.has(targetKey)) throw new Error("Each target can only be selected once.");
    seen.add(targetKey);
    const server = target.targetType === "server" ? serverById.get(target.targetId) : null;
    const bundle = target.targetType === "bundle" ? bundleById.get(target.targetId) : null;
    if (!server && !bundle) throw new Error(`Unknown ${target.targetType}: ${target.targetId}.`);
    if (!durationMetas().some(({ id }) => target.pricingByPlan[id] !== undefined)) {
      throw new Error(`Set at least one promotional duration for ${target.targetId}.`);
    }
    for (const meta of durationMetas()) {
      const price = target.pricingByPlan[meta.id];
      if (price === undefined) continue;
      const base = server
        ? (server.vipPricingByPlan?.[meta.id] ?? undefined)
        : bundle?.pricingByPlan[meta.id];
      const basePrice = server
        ? Number.isFinite(base) && (base ?? 0) > 0 ? base : defaults[meta.id]
        : base;
      if (!Number.isInteger(price) || price <= 0) throw new Error(`Set a valid price for ${meta.name}.`);
      if (!basePrice || price >= basePrice) throw new Error(`${meta.name} promotional price must be lower than the base price.`);
    }
  }
  if (targets.length === 0) throw new Error("Select at least one server or bundle.");
}

export async function assertNoPromotionOverlap(input: {
  startsAt: Date;
  endsAt: Date;
  targets: VipPromotionTarget[];
  excludingId?: string;
}): Promise<void> {
  if (!Array.isArray(input.targets) || input.targets.length === 0) {
    throw new Error("Select at least one server or bundle before enabling this offer.");
  }
  const col = await collection();
  for (const target of input.targets) {
    const conflict = await col.findOne({
      enabled: true,
      ...(input.excludingId ? { id: { $ne: input.excludingId } } : {}),
      startsAt: { $lt: input.endsAt },
      endsAt: { $gt: input.startsAt },
      targets: { $elemMatch: { targetType: target.targetType, targetId: target.targetId } },
    });
    if (conflict) throw new Error(`This schedule overlaps enabled offer “${conflict.name}” for ${target.targetId}.`);
  }
}

export async function createVipPromotion(input: Omit<VipPromotionDoc, "_id" | "id" | "createdAt" | "updatedAt"> & { createdBy: string }): Promise<VipPromotionDoc> {
  return withPromotionMutationLock(async () => {
    if (!(input.startsAt < input.endsAt)) throw new Error("Start time must be earlier than end time.");
    await validatePromotionTargets(input.targets);
    if (input.enabled) await assertNoPromotionOverlap(input);
    await ensureVipPromotionIndexes();
    const now = new Date();
    const id = crypto.randomUUID();
    const doc: VipPromotionDoc = { ...input, _id: id, id, createdAt: now, updatedAt: now };
    await (await collection()).insertOne(doc);
    return doc;
  });
}

export async function updateVipPromotion(id: string, patch: Partial<Pick<VipPromotionDoc, "name" | "description" | "enabled" | "startsAt" | "endsAt" | "targets">>, updatedBy: string): Promise<VipPromotionDoc | null> {
  return withPromotionMutationLock(async () => {
    const col = await collection();
    const current = await col.findOne({ id });
    if (!current) return null;
    if (promotionStatus(current) === "active" && (patch.name !== undefined || patch.description !== undefined || patch.startsAt !== undefined || patch.endsAt !== undefined || patch.targets !== undefined)) {
      throw new Error("Active offers cannot be edited. Disable this offer and create a replacement.");
    }
    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as typeof patch;
    const next = mergeDefined(current, definedPatch);
    if (!(next.startsAt < next.endsAt)) throw new Error("Start time must be earlier than end time.");
    if (patch.targets) await validatePromotionTargets(patch.targets);
    if (next.enabled) await assertNoPromotionOverlap({ startsAt: next.startsAt, endsAt: next.endsAt, targets: next.targets, excludingId: id });
    await col.updateOne({ id }, { $set: { ...definedPatch, updatedBy, updatedAt: new Date() } });
    return col.findOne({ id });
  });
}

export async function resolvePromotionPrices<T extends { id: string; durationOptions: VipDurationOption[] }>(
  items: T[], targetType: VipPromotionTargetType, now = new Date(),
): Promise<T[]> {
  await ensureVipPromotionIndexes();
  const ids = items.map((item) => item.id);
  const docs = await (await collection()).find({
    enabled: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
    targets: { $elemMatch: { targetType, targetId: { $in: ids } } },
  }).toArray();
  const byId = new Map<string, { promotion: VipPromotionDoc; target: VipPromotionTarget }>();
  for (const promotion of docs) {
    for (const target of promotion.targets) {
      if (target.targetType === targetType && ids.includes(target.targetId)) byId.set(target.targetId, { promotion, target });
    }
  }
  return items.map((item) => {
    const active = byId.get(item.id);
    if (!active) return item;
    return {
      ...item,
      durationOptions: item.durationOptions.map((option) => {
        const sale = active.target.pricingByPlan[option.id];
        if (!Number.isInteger(sale) || sale <= 0 || sale >= option.amountPaise) return option;
        const discount = option.amountPaise - sale;
        return {
          ...option,
          amountPaise: sale,
          baseAmountPaise: option.amountPaise,
          perMonthPaise: option.months > 1 ? Math.round(sale / option.months) : null,
          promotion: {
            id: active.promotion.id,
            name: active.promotion.name,
            discountAmountPaise: discount,
            discountPercentage: Math.round((discount / option.amountPaise) * 100),
            endsAt: active.promotion.endsAt.toISOString(),
          } satisfies VipPromotionPrice,
        };
      }),
    };
  });
}

export async function applyPromotionsToCatalog(catalog: VipShopCatalog, now = new Date()): Promise<VipShopCatalog> {
  const [servers, bundles] = await Promise.all([
    resolvePromotionPrices(catalog.servers, "server", now),
    resolvePromotionPrices(catalog.bundles.map((bundle) => ({ ...bundle, durationOptions: bundle.durations })), "bundle", now),
  ]);
  const mappedBundles = bundles.map(({ durationOptions, ...bundle }) => ({ ...bundle, durations: durationOptions }));
  const quote = servers.length ? {
    ...catalog.quote,
    durations: servers.find((server) => server.id === catalog.quote.serverId)?.durationOptions ?? catalog.quote.durations,
  } : catalog.quote;
  return { ...catalog, servers, bundles: mappedBundles, quote };
}

export async function applyPromotionsToQuote<T extends { accessType: string; serverId: string | null; bundleId: string | null; durations: VipDurationOption[] }>(quote: T, now = new Date()): Promise<T> {
  const targetType: VipPromotionTargetType = quote.accessType === "BUNDLE" ? "bundle" : "server";
  const targetId = targetType === "bundle" ? quote.bundleId : quote.serverId;
  if (!targetId) return quote;
  const [resolved] = await resolvePromotionPrices([{ id: targetId, durationOptions: quote.durations }], targetType, now);
  return resolved ? { ...quote, durations: resolved.durationOptions } : quote;
}

export async function resolveVipPrice(input: { targetType: VipPromotionTargetType; targetId: string; plan: VipPlanId; basePrice: number; now?: Date }): Promise<{ basePrice: number; finalPrice: number; promotion: VipPromotionDoc | null }> {
  await ensureVipPromotionIndexes();
  const now = input.now ?? new Date();
  const docs = await (await collection()).find({
    enabled: true, startsAt: { $lte: now }, endsAt: { $gt: now },
    targets: { $elemMatch: { targetType: input.targetType, targetId: input.targetId } },
  }).toArray();
  for (const promotion of docs) {
    const amount = promotionPrice({ ...input, promotion, now });
    if (amount !== null) return { basePrice: input.basePrice, finalPrice: amount, promotion };
  }
  return { basePrice: input.basePrice, finalPrice: input.basePrice, promotion: null };
}
