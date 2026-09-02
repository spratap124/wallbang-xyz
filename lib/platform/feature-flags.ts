import "server-only";

import type { Collection } from "mongodb";

import {
  featureFlags as staticFeatureFlags,
  writableFeatureFlags,
  type FeatureFlags,
  type WritableFeatureFlag,
} from "@/config/features.flags";
import { getDb, isMongoConfigured } from "@/lib/mongo";

const COLLECTION = "platform_settings";
const DOC_ID = "feature_flags";

const ENV_NAMES: Record<WritableFeatureFlag, string> = {
  vipPage: "FEATURE_VIP_PAGE",
  vipAllRetakes: "FEATURE_VIP_ALL_RETAKES",
  vipCheckout: "FEATURE_VIP_CHECKOUT",
  loadoutPage: "FEATURE_LOADOUT_PAGE",
  featuresPage: "FEATURE_FEATURES_PAGE",
  profilePage: "FEATURE_PROFILE_PAGE",
  settingsPage: "FEATURE_SETTINGS_PAGE",
};

type FeatureFlagDoc = {
  _id: string;
  vipPage?: boolean;
  vipAllRetakes?: boolean;
  vipCheckout?: boolean;
  loadoutPage?: boolean;
  featuresPage?: boolean;
  profilePage?: boolean;
  settingsPage?: boolean;
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

  try {
    const col = await settingsCollection();
    const doc = await col.findOne({ _id: DOC_ID });
    return doc ?? null;
  } catch (error) {
    console.error(
      "[feature-flags] Mongo unavailable; using env/static flags.",
      error,
    );
    return null;
  }
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
  const runtime: { -readonly [K in keyof FeatureFlags]: boolean } = {
    ...staticFeatureFlags,
  };

  for (const key of writableFeatureFlags) {
    runtime[key] = resolveFlag(
      ENV_NAMES[key],
      overrides?.[key],
      staticFeatureFlags[key],
    );
  }

  return runtime;
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

export async function isLoadoutPageEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.loadoutPage;
}

export async function isFeaturesPageEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.featuresPage;
}

export async function isProfilePageEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.profilePage;
}

export async function isSettingsPageEnabled(): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags();
  return flags.settingsPage;
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

export async function setRuntimeFeatureFlag(
  key: WritableFeatureFlag,
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  return setFeatureFlag(key, enabled, updatedBy);
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
