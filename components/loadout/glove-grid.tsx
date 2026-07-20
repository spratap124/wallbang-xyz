"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef } from "@/types/loadout";

type GloveGridProps = {
  gloves: WeaponDef[];
  equippedGloves: EquippedItem | null;
  filter: string;
  onSelectGloves: (gloveId: string) => void;
  selectedGloves?: string | null;
  onPreview: (item: EquippedItem | null, gloveId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function GloveGrid({
  gloves,
  equippedGloves,
  filter,
  onSelectGloves,
  selectedGloves,
  onPreview,
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            large
            selected={selectedGloves === glove.id}
            onClick={() => {
              onPreview(eq, glove.id);
              onSelectGloves(glove.id);
            }}
          />
        );
      })}
    </div>
  );
}
