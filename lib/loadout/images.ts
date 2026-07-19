/**
 * Optional skin preview URLs.
 * Valve extract has no images — resolve via paintKit when a CDN map is available.
 */

import skinImages from "@/lib/loadout/skin-images.json";

type SkinImageMap = Record<string, string>;

const byPaintKit = skinImages as SkinImageMap;

/** Look up a CDN preview by paint kit id. Returns undefined when unknown. */
export function resolveSkinImage(paintKit: number): string | undefined {
  if (!Number.isFinite(paintKit) || paintKit <= 0) return undefined;
  return byPaintKit[String(paintKit)] ?? byPaintKit[paintKit];
}
