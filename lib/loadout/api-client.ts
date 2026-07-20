/**
 * Browser / RSC helpers for the public cosmetics catalog API.
 * Weapon ids match CS2 generate output (usp_silencer, m4a1_silencer, …).
 */

import type {
  CatalogGlove,
  CatalogKnife,
  CatalogSkin,
  CatalogWeapon,
  CatalogWearPresets,
  KnifeFinish,
} from "@/types/catalog";
import type { Skin, WeaponDef } from "@/types/loadout";
import { enrichSkinMeta, lookupSkinMetadata } from "@/lib/loadout/skin-metadata";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || !body.ok) {
    const msg = !body.ok ? body.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body.data;
}

export type SkinsIndexResponse = {
  weapons: WeaponDef[];
  categories: Record<string, WeaponDef[]>;
  wearPresets: CatalogWearPresets;
  manifest: {
    weapons: number;
    weaponSkins: number;
    knives: number;
    finishes: number;
    gloves: number;
    gloveSkins: number;
  } | null;
  generatedAt: string | null;
};

export type WeaponSkinsResponse = {
  weapon: string;
  skins: Skin[];
};

export type KnivesIndexResponse = {
  knives: Array<WeaponDef & { finishSet?: string | null }>;
  finishSets: Record<string, string[]>;
  wearPresets: CatalogWearPresets["knives"];
};

export type KnifeDetailResponse = {
  knife: CatalogKnife;
  finishes: KnifeFinish[];
  wearPresets: CatalogWearPresets["knives"];
};

export type GlovesIndexResponse = {
  gloves: Array<WeaponDef & { skinCount: number }>;
  wearPresets: CatalogWearPresets["gloves"];
};

export type GloveDetailResponse = {
  glove: CatalogGlove;
  skins: Skin[];
  wearPresets: CatalogWearPresets["gloves"];
};

/** GET /api/skins — weapons index + wear presets. */
export function fetchCatalogIndex(
  baseUrl = "",
): Promise<SkinsIndexResponse> {
  return getJson<SkinsIndexResponse>(`${baseUrl}/api/skins`);
}

/** GET /api/skins?weapon=ak47 */
export function fetchSkinsForWeapon(
  weaponId: string,
  baseUrl = "",
): Promise<WeaponSkinsResponse> {
  const q = new URLSearchParams({ weapon: weaponId });
  return getJson<WeaponSkinsResponse>(`${baseUrl}/api/skins?${q}`);
}

/** GET /api/skins?category=knives */
export function fetchKnivesIndex(baseUrl = ""): Promise<KnivesIndexResponse> {
  return getJson<KnivesIndexResponse>(`${baseUrl}/api/skins?category=knives`);
}

/** GET /api/skins?knife=karambit */
export function fetchKnifeDetail(
  knifeId: string,
  baseUrl = "",
): Promise<KnifeDetailResponse> {
  const q = new URLSearchParams({ knife: knifeId });
  return getJson<KnifeDetailResponse>(`${baseUrl}/api/skins?${q}`);
}

/** GET /api/skins?category=gloves */
export function fetchGlovesIndex(baseUrl = ""): Promise<GlovesIndexResponse> {
  return getJson<GlovesIndexResponse>(`${baseUrl}/api/skins?category=gloves`);
}

/** GET /api/skins?glove=driver */
export function fetchGloveDetail(
  gloveId: string,
  baseUrl = "",
): Promise<GloveDetailResponse> {
  const q = new URLSearchParams({ glove: gloveId });
  return getJson<GloveDetailResponse>(`${baseUrl}/api/skins?${q}`);
}

/** Map knife finishes → loadout Skin rows for the browser UI. */
export function knifeFinishesToSkins(
  knifeId: string,
  finishes: KnifeFinish[],
): Skin[] {
  return finishes.map((f) => {
    const meta = lookupSkinMetadata({
      weaponId: knifeId,
      paintKit: f.paintKit,
      skinName: f.displayName,
    });
    const base: Skin = {
      id: `${knifeId}:${f.id}`,
      weapon: knifeId,
      paintKit: f.paintKit,
      skinName: f.displayName,
      rarity: meta?.rarity ?? "Covert",
      collection: meta?.collection ?? "",
      wearSupported: !f.skipWear,
      stattrakSupported: true,
      image: f.image,
    };
    return enrichSkinMeta(base, { id: knifeId });
  });
}

export type LoadoutSkinCategory = "weapons" | "knives" | "gloves";

/**
 * Load skins for a weapon / knife / glove slot from `/api/skins`.
 * Knife detail returns finishes; mapped to Skin[] here.
 */
export async function loadSkinsForSlot(
  category: LoadoutSkinCategory,
  id: string,
  baseUrl = "",
): Promise<Skin[]> {
  if (category === "knives") {
    const detail = await fetchKnifeDetail(id, baseUrl);
    return knifeFinishesToSkins(detail.knife.id, detail.finishes);
  }
  if (category === "gloves") {
    const detail = await fetchGloveDetail(id, baseUrl);
    return detail.skins;
  }
  const detail = await fetchSkinsForWeapon(id, baseUrl);
  return detail.skins;
}

async function mutateJson<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || !json.ok) {
    const msg = !json.ok ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

export type SavedLoadoutResponse = {
  loadout: import("@/types/loadout").UserLoadoutState;
  game: import("@/types/player-loadout").GameLoadout;
  updatedAt: string;
};

/** GET /api/loadout — session user's saved loadout. */
export function fetchSavedLoadout(
  baseUrl = "",
): Promise<SavedLoadoutResponse> {
  return getJson<SavedLoadoutResponse>(`${baseUrl}/api/loadout`);
}

/** PUT /api/loadout — persist full loadout for the signed-in player. */
export function saveSavedLoadout(
  loadout: import("@/types/loadout").UserLoadoutState,
  baseUrl = "",
): Promise<SavedLoadoutResponse> {
  return mutateJson<SavedLoadoutResponse>(
    `${baseUrl}/api/loadout`,
    "PUT",
    loadout,
  );
}

/** Re-export raw catalog shapes for advanced UI. */
export type {
  CatalogSkin,
  CatalogWeapon,
  CatalogKnife,
  CatalogGlove,
  KnifeFinish,
};
