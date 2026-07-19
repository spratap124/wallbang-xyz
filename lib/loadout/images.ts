/**
 * Skin preview helpers for the cosmetics catalog.
 *
 * `skin-images.json` keys (ByMykel/CSGO-API):
 * - `"defIndex:paintKit"` — preferred (paint kits are shared across weapons)
 * - `"weaponId:paintKit"` — catalog id fallback (e.g. `glock:3`)
 * - `"Weapon|Skin"` — display-name fallback
 */

import skinImages from "@/lib/loadout/skin-images.json";

type SkinImageFile = {
  generatedAt?: string;
  source?: string;
  images?: Record<string, string>;
  agents?: Record<string, string>;
};

const data = skinImages as unknown as SkinImageFile;

type AnyImageIndex = {
  byDefIndex: Record<string, string>;
  byWeaponId: Record<string, string>;
  byDisplayName: Record<string, string>;
};

let anyImageIndex: AnyImageIndex | null = null;

function getAnyImageIndex(): AnyImageIndex {
  if (anyImageIndex) return anyImageIndex;

  const byDefIndex: Record<string, string> = {};
  const byWeaponId: Record<string, string> = {};
  const byDisplayName: Record<string, string> = {};

  for (const [key, url] of Object.entries(data.images ?? {})) {
    if (!url) continue;
    const pipe = key.indexOf("|");
    if (pipe !== -1) {
      const weaponName = key.slice(0, pipe);
      if (weaponName && !byDisplayName[weaponName]) {
        byDisplayName[weaponName] = url;
      }
      continue;
    }
    const colon = key.indexOf(":");
    if (colon === -1) continue;
    const left = key.slice(0, colon);
    if (!left) continue;
    if (/^\d+$/.test(left)) {
      if (!byDefIndex[left]) byDefIndex[left] = url;
    } else if (!byWeaponId[left]) {
      byWeaponId[left] = url;
    }
  }

  anyImageIndex = { byDefIndex, byWeaponId, byDisplayName };
  return anyImageIndex;
}

/** Name-based CDN lookup (`"AK-47|Asiimov"`). */
export function resolveSkinImageByName(name: string): string | undefined {
  if (!name) return undefined;
  return data.images?.[name] ?? data.images?.[name.trim()];
}

/**
 * Resolve preview art for a specific weapon + paint kit.
 * Prefer defIndex (unique per item definition); fall back to catalog weapon id.
 */
export function resolveSkinImage(
  weaponRef: { defIndex?: number | null; id?: string | null } | number | string,
  paintKit: number,
): string | undefined {
  if (!Number.isFinite(paintKit) || paintKit < 0) return undefined;
  const images = data.images;
  if (!images) return undefined;

  const paint = String(paintKit);
  if (typeof weaponRef === "number") {
    return images[`${weaponRef}:${paint}`];
  }
  if (typeof weaponRef === "string") {
    return images[`${weaponRef}:${paint}`];
  }

  if (weaponRef.defIndex != null && weaponRef.defIndex > 0) {
    const byDef = images[`${weaponRef.defIndex}:${paint}`];
    if (byDef) return byDef;
  }
  if (weaponRef.id) {
    return images[`${weaponRef.id}:${paint}`];
  }
  return undefined;
}

/**
 * Pick any available skin preview for a weapon / knife / glove.
 * Used when nothing is equipped so cards aren't empty placeholders.
 */
export function resolveAnySkinImage(weaponRef: {
  defIndex?: number | null;
  id?: string | null;
  name?: string | null;
}): string | undefined {
  const index = getAnyImageIndex();
  if (weaponRef.defIndex != null && weaponRef.defIndex > 0) {
    const byDef = index.byDefIndex[String(weaponRef.defIndex)];
    if (byDef) return byDef;
  }
  if (weaponRef.id) {
    const byId = index.byWeaponId[weaponRef.id];
    if (byId) return byId;
  }
  if (weaponRef.name) {
    return index.byDisplayName[weaponRef.name];
  }
  return undefined;
}

export function resolveAgentImage(name: string): string | undefined {
  if (!name) return undefined;
  return data.agents?.[name];
}
