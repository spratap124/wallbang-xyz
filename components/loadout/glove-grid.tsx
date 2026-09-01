"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef } from "@/types/loadout";

type GloveGridProps = {
  gloves: WeaponDef[];
  equippedGloves: EquippedItem | null;
  filter: string;
  onSelectGloves: (gloveId: string) => void;
  selectedGloves?: string | null;
  favorites?: string[];
  onToggleFavorite?: (skinId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function GloveGrid({
  gloves,
  equippedGloves,
  filter,
  onSelectGloves,
  selectedGloves,
  favorites = [],
  onToggleFavorite,
  loading = false,
  error = null,
}: GloveGridProps) {
  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Loading gloves…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-destructive">{error}</p>
    );
  }

  const query = filter.trim().toLowerCase();
  const filtered = gloves.filter((g) => {
    if (!query) return true;
    return (
      g.name.toLowerCase().includes(query) ||
      (equippedGloves?.weapon === g.id &&
        (equippedGloves.skinName.toLowerCase().includes(query) ||
          equippedGloves.rarity.toLowerCase().includes(query)))
    );
  });

  if (gloves.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No gloves in the catalog yet.
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No gloves match your search.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Gloves
        </h2>
        <p className="text-xs text-muted-foreground">
          {filtered.length} item{filtered.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((glove) => {
          const eq =
            equippedGloves?.weapon === glove.id ? equippedGloves : null;
          return (
            <WeaponCard
              key={glove.id}
              name={glove.name}
              weaponId={glove.id}
              defIndex={glove.defIndex}
              equipped={eq}
              muted={!eq}
              selected={selectedGloves === glove.id}
              isFavorite={eq ? favorites.includes(eq.skinId) : false}
              onToggleFavorite={
                eq && onToggleFavorite
                  ? () => onToggleFavorite(eq.skinId)
                  : undefined
              }
              onClick={() => onSelectGloves(glove.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
