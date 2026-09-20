import type {
  CatalogKnife,
  KnifeFinish,
  KnifeFinishVariant,
} from "@/types/catalog";

/** Valve paint kits for Doppler / Gamma Doppler phases (ByMykel / items_game). */
export const KNIFE_VARIANT_PAINT_KITS: Record<string, Record<string, number>> = {
  doppler: {
    ruby: 415,
    sapphire: 416,
    black_pearl: 417,
    phase1: 418,
    phase2: 419,
    phase3: 420,
    phase4: 421,
  },
  gamma_doppler: {
    emerald: 568,
    phase1: 569,
    phase2: 570,
    phase3: 571,
    phase4: 572,
  },
};

export type KnifeFinishRow = {
  id: string;
  finishId: string;
  displayName: string;
  paintKit: number;
  seed?: number;
  wearSupported: boolean;
  image?: string;
};

export function resolveKnifeVariantPaintKit(
  finish: KnifeFinish,
  variant: KnifeFinishVariant,
): number {
  return (
    KNIFE_VARIANT_PAINT_KITS[finish.id]?.[variant.id] ??
    variant.paintKit ??
    finish.paintKit
  );
}

/**
 * Expand catalog finishes into one UI row per variant (Doppler phases,
 * Fade %, Crimson Web, …). Finishes without variants stay a single row.
 */
export function expandKnifeFinishRows(finish: KnifeFinish): KnifeFinishRow[] {
  const variants = finish.variants?.filter((v) => v.id) ?? [];
  if (variants.length === 0) {
    return [
      {
        id: finish.id,
        finishId: finish.id,
        displayName: finish.displayName,
        paintKit: finish.paintKit,
        wearSupported: !finish.skipWear,
        image: finish.image,
      },
    ];
  }

  return variants.map((variant) => {
    const paintKit = resolveKnifeVariantPaintKit(finish, variant);
    return {
      id: `${finish.id}:${variant.id}`,
      finishId: finish.id,
      displayName: `${finish.displayName} | ${variant.displayName}`,
      paintKit,
      seed: variant.seed ?? undefined,
      wearSupported: !finish.skipWear,
      image:
        variant.image ??
        (paintKit === finish.paintKit ? finish.image : undefined),
    };
  });
}

/**
 * Resolve finishes for a knife model.
 *
 * Default knives (`finishSet` empty) have no cosmetics.
 * Every other knife gets the full finish catalog: case-era subsets like
 * `chroma` omit Gamma Doppler / Lore / Autotronic even though those paint
 * kits exist and apply in-game (Flip Knife, Karambit, Bayonet, …).
 */
export function resolveKnifeFinishes(
  knife: Pick<CatalogKnife, "finishSet">,
  catalog: {
    finishes: Record<string, KnifeFinish>;
    finishSets: Record<string, string[]>;
  },
): KnifeFinish[] {
  if (!knife.finishSet) return [];

  const seen = new Set<string>();
  const ids: string[] = [];

  const preferred = catalog.finishSets[knife.finishSet] ?? [];
  for (const id of preferred) {
    if (seen.has(id) || !catalog.finishes[id]) continue;
    seen.add(id);
    ids.push(id);
  }

  for (const id of Object.keys(catalog.finishes)) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids
    .map((id) => catalog.finishes[id])
    .filter((f): f is KnifeFinish => Boolean(f));
}
