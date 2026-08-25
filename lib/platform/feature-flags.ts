import "server-only";

import type { Collection } from "mongodb";

import {
  featureFlags as staticFeatureFlags,
  type FeatureFlags,
  type WritableFeatureFlag,
} from "@/config/features.flags";
import { getDb, isMongoConfigured } from "@/lib/mongo";

const COLLECTION = "platform_settings";
const DOC_ID = "feature_flags";

type FeatureFlagDoc = {
  _id: string;
  vipPage?: boolean;
  vipAllRetakes?: boolean;
  vipCheckout?: boolean;
  updatedAt?: Date;
  updatedBy?: string;
};

function parseEnvBoolean(
  raw: string | undefined,
): boolean | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

async function settingsCollection(): Promise<Collection<FeatureFlagDoc>> {
  const db = await getDb();
  return db.collection<FeatureFlagDoc>(COLLECTION);
}

async function readOverrides(): Promise<FeatureFlagDoc | null> {
  if (!isMongoConfigured()) return null;

  const col = await settingsCollection();
  const doc = await col.findOne({ _id: DOC_ID });

  return doc ?? null;
}

function resolveFlag(
  envName: string,
  mongoValue: boolean | undefined,
  fallback: boolean,
): boolean {
  const envOverride = parseEnvBoolean(process.env[envName]);
  if (envOverride !== undefined) return envOverride;
  if (mongoValue !== undefined) return mongoValue;
  return fallback;
}

export async function getRuntimeFeatureFlags(): Promise<FeatureFlags> {
  const overrides = await readOverrides();
  return {
    ...staticFeatureFlags,
    vipPage: resolveFlag(
      "FEATURE_VIP_PAGE",
      overrides?.vipPage,
      staticFeatureFlags.vipPage,
    ),
    vipAllRetakes: resolveFlag(
      "FEATURE_VIP_ALL_RETAKES",
      overrides?.vipAllRetakes,
      staticFeatureFlags.vipAllRetakes,
    ),
    vipCheckout: resolveFlag(
      "FEATURE_VIP_CHECKOUT",
      overrides?.vipCheckout,
      staticFeatureFlags.vipCheckout,
    ),
  };
}

export async function isVipPageEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.vipPage;
}

export async function isVipAllRetakesEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.vipAllRetakes;
}

export async function isVipCheckoutEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.vipCheckout;
}

export async function setVipPageEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  return setFeatureFlag("vipPage", enabled, updatedBy);
}

export async function setVipAllRetakesEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  return setFeatureFlag("vipAllRetakes", enabled, updatedBy);
}

export async function setVipCheckoutEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  return setFeatureFlag("vipCheckout", enabled, updatedBy);
}

async function setFeatureFlag(
  key: WritableFeatureFlag,
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  if (!isMongoConfigured()) {
    throw new Error("Database is not configured.");
  }

  const col = await settingsCollection();
  await col.updateOne(
    { _id: DOC_ID },
    {
      $set: {
        [key]: enabled,
        updatedAt: new Date(),
        updatedBy,
      },
    },
    { upsert: true },
  );

  return enabled;
}
