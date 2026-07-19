"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import { KNIVES } from "@/lib/loadout/mock-data";
import type { EquippedItem } from "@/types/loadout";

type KnifeGridProps = {
  equippedKnife: EquippedItem | null;
  filter: string;
  onSelectKnife: (knifeName: string) => void;
  selectedKnife?: string | null;
  onPreview: (item: EquippedItem | null, knifeName: string) => void;
};

export function KnifeGrid({
  equippedKnife,
  filter,
  onSelectKnife,
  selectedKnife,
  onPreview,
}: KnifeGridProps) {
  const query = filter.trim().toLowerCase();
  const knives = KNIVES.filter((k) => {
    if (!query) return true;
    return (
      k.name.toLowerCase().includes(query) ||
      (equippedKnife?.weapon === k.name &&
        (equippedKnife.skinName.toLowerCase().includes(query) ||
          equippedKnife.rarity.toLowerCase().includes(query)))
    );
  });

  if (knives.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No knives match your search.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {knives.map((knife) => {
        const eq =
          equippedKnife?.weapon === knife.name ? equippedKnife : null;
        return (
          <WeaponCard
            key={knife.id}
            name={knife.name}
            equipped={eq}
            large
            selected={selectedKnife === knife.name}
            onClick={() => {
              onPreview(eq, knife.name);
              onSelectKnife(knife.name);
            }}
          />
        );
      })}
    </div>
  );
}
