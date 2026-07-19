/**
 * Skin preview helpers for the cosmetics catalog.
 *
 * Existing `skin-images.json` is name-keyed (`"AK-47|Asiimov"`), not paintKit-keyed.
 * Cast via `unknown` so it typechecks against that shape.
 */

import skinImages from "@/lib/loadout/skin-images.json";

type SkinImageFile = {
  generatedAt?: string;
  source?: string;
  images?: Record<string, string>;
  agents?: Record<string, string>;
};

const data = skinImages as unknown as SkinImageFile;

/** Name-based CDN lookup (`"AK-47|Asiimov"`). */
export function resolveSkinImageByName(name: string): string | undefined {
  if (!name) return undefined;
  return data.images?.[name] ?? data.images?.[name.trim()];
}

/**
 * Catalog path (paintKit only). Returns a URL only if the JSON map has a
 * numeric key; otherwise undefined (UI still works without previews).
 */
export function resolveSkinImage(paintKit: number): string | undefined {
  if (!Number.isFinite(paintKit) || paintKit <= 0) return undefined;
  const images = data.images;
  if (!images) return undefined;
  return images[String(paintKit)];
}

export function resolveAgentImage(name: string): string | undefined {
  if (!name) return undefined;
  return data.agents?.[name];
}
