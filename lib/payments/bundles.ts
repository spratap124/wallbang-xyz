import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/mongo";
import { buildBundleDurationOptions } from "@/lib/payments/vip-pricing";
import { getGameServers } from "@/lib/servers/registry";
import type {
  VipBundleDoc,
  VipBundleView,
  VipPlanId,
  VipPricingByPlan,
  VipServerRef,
} from "@/types/vip";
import { VIP_PLAN_IDS } from "@/types/vip";

const COLLECTION = "vip_bundles";
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let indexesReady: Promise<void> | null = null;

async function collection(): Promise<Collection<VipBundleDoc>> {
  const db = await getDb();
  return db.collection<VipBundleDoc>(COLLECTION);
}

export async function ensureVipBundleIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = await collection();
      await Promise.all([
        col.createIndex({ id: 1 }, { unique: true }),
        col.createIndex({ enabled: 1, featured: -1 }),
      ]);
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  return indexesReady;
}

export function isValidVipBundleId(id: string): boolean {
  return ID_RE.test(id) && id.length >= 2 && id.length <= 64;
}

/** All four durations must be priced; a bundle with a gap is not sellable. */
export function normalizeBundlePricing(input: VipPricingByPlan): VipPricingByPlan {
  const pricing: VipPricingByPlan = {};
  for (const plan of VIP_PLAN_IDS) {
    const amount = input[plan];
    if (!Number.isInteger(amount) || (amount ?? 0) <= 0) {
      throw new Error(`Set a price for ${plan.replace("_", " ")}.`);
    }
    pricing[plan as VipPlanId] = amount as number;
  }
  return pricing;
}

export async function listVipBundleDocs(): Promise<VipBundleDoc[]> {
  await ensureVipBundleIndexes();
  const col = await collection();
  return col.find({}).sort({ featured: -1, id: 1 }).toArray();
}

async function serverRefs(): Promise<Map<string, VipServerRef>> {
  const servers = await getGameServers({ includeDisabled: true });
  return new Map(
    servers.map((server) => [
      server.id,
      { id: server.id, name: server.shortName || server.name },
    ]),
  );
}

function toView(doc: VipBundleDoc, refs: Map<string, VipServerRef>): VipBundleView {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    durations: buildBundleDurationOptions(doc),
    servers: doc.serverIds
      .map((id) => refs.get(id))
      .filter((ref): ref is VipServerRef => Boolean(ref)),
  };
}

export async function listVipBundleViews(): Promise<VipBundleView[]> {
  const [docs, refs] = await Promise.all([listVipBundleDocs(), serverRefs()]);
  return docs.map((doc) => toView(doc, refs));
}

export async function getVipBundleDoc(id: string): Promise<VipBundleDoc | null> {
  await ensureVipBundleIndexes();
  const col = await collection();
  return col.findOne({ id });
}

async function assertServersExist(serverIds: string[]): Promise<string[]> {
  const unique = [...new Set(serverIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Select at least one server.");
  }
  const known = await getGameServers({ includeDisabled: true });
  const knownIds = new Set(known.map((server) => server.id));
  const unknown = unique.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown server(s): ${unknown.join(", ")}`);
  }
  return unique;
}

export async function createVipBundle(input: {
  id: string;
  name: string;
  description?: string | null;
  serverIds: string[];
  pricingByPlan: VipPricingByPlan;
  enabled?: boolean;
  featured?: boolean;
}): Promise<VipBundleView> {
  const id = input.id.trim().toLowerCase();
  if (!isValidVipBundleId(id)) {
    throw new Error("Bundle id must be lowercase letters, numbers, and hyphens.");
  }
  await ensureVipBundleIndexes();
  const col = await collection();
  if (await col.findOne({ id })) {
    throw new Error("A bundle with that id already exists.");
  }

  const serverIds = await assertServersExist(input.serverIds);
  const pricingByPlan = normalizeBundlePricing(input.pricingByPlan);
  const now = new Date();
  const doc: VipBundleDoc = {
    _id: id,
    id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    serverIds,
    pricingByPlan,
    enabled: input.enabled ?? true,
    featured: input.featured ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return toView(doc, await serverRefs());
}

export async function updateVipBundle(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    serverIds?: string[];
    pricingByPlan?: VipPricingByPlan;
    enabled?: boolean;
    featured?: boolean;
  },
): Promise<VipBundleView | null> {
  await ensureVipBundleIndexes();
  const col = await collection();
  const existing = await col.findOne({ id });
  if (!existing) return null;

  const $set: Partial<VipBundleDoc> = { updatedAt: new Date() };
  if (input.name !== undefined) $set.name = input.name.trim();
  if (input.description !== undefined) {
    $set.description = input.description?.trim() || null;
  }
  if (input.serverIds !== undefined) {
    $set.serverIds = await assertServersExist(input.serverIds);
  }
  if (input.pricingByPlan !== undefined) {
    $set.pricingByPlan = normalizeBundlePricing(input.pricingByPlan);
  }
  if (input.enabled !== undefined) $set.enabled = input.enabled;
  if (input.featured !== undefined) {
    $set.featured = input.featured;
    if (input.featured) {
      await col.updateMany(
        { id: { $ne: id }, featured: true },
        { $set: { featured: false, updatedAt: new Date() } },
      );
    }
  }

  await col.updateOne({ id }, { $set });
  const updated = await col.findOne({ id });
  if (!updated) return null;
  return toView(updated, await serverRefs());
}

export async function deleteVipBundle(id: string): Promise<boolean> {
  await ensureVipBundleIndexes();
  const col = await collection();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
