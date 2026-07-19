"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import { GLOVES } from "@/lib/loadout/mock-data";
import type { EquippedItem } from "@/types/loadout";

type GloveGridProps = {
  equippedGloves: EquippedItem | null;
  filter: string;
  onSelectGloves: (gloveName: string) => void;
  selectedGloves?: string | null;
  onPreview: (item: EquippedItem | null, gloveName: string) => void;
};

export function GloveGrid({
  equippedGloves,
  filter,
  onSelectGloves,
  selectedGloves,
  onPreview,
}: GloveGridProps) {
  const query = filter.trim().toLowerCase();
  const gloves = GLOVES.filter((g) => {
    if (!query) return true;
    return (
      g.name.toLowerCase().includes(query) ||
      (equippedGloves?.weapon === g.name &&
        (equippedGloves.skinName.toLowerCase().includes(query) ||
          equippedGloves.rarity.toLowerCase().includes(query)))
    );
  });

  if (gloves.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No gloves match your search.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {gloves.map((glove) => {
        const eq =
          equippedGloves?.weapon === glove.name ? equippedGloves : null;
        return (
          <WeaponCard
            key={glove.id}
            name={glove.name}
            equipped={eq}
            large
            selected={selectedGloves === glove.name}
            onClick={() => {
              onPreview(eq, glove.name);
              onSelectGloves(glove.name);
            }}
          />
        );
      })}
    </div>
  );
}
