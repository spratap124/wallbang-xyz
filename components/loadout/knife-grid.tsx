"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef } from "@/types/loadout";

type KnifeGridProps = {
  knives: WeaponDef[];
  equippedKnife: EquippedItem | null;
  filter: string;
  onSelectKnife: (knifeId: string) => void;
  selectedKnife?: string | null;
  onPreview: (item: EquippedItem | null, knifeId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function KnifeGrid({
  knives,
  equippedKnife,
  filter,
  onSelectKnife,
  selectedKnife,
  onPreview,
  loading = false,
  error = null,
}: KnifeGridProps) {
  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Loading knives…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-destructive">{error}</p>
    );
  }

  const query = filter.trim().toLowerCase();
  const filtered = knives.filter((k) => {
    if (!query) return true;
    return (
      k.name.toLowerCase().includes(query) ||
      (equippedKnife?.weapon === k.id &&
        (equippedKnife.skinName.toLowerCase().includes(query) ||
          equippedKnife.rarity.toLowerCase().includes(query)))
    );
  });

  if (knives.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No knives in the catalog yet.
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No knives match your search.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((knife) => {
        const eq =
          equippedKnife?.weapon === knife.id ? equippedKnife : null;
        return (
          <WeaponCard
            key={knife.id}
            name={knife.name}
            weaponId={knife.id}
            defIndex={knife.defIndex}
            equipped={eq}
            large
            selected={selectedKnife === knife.id}
            onClick={() => {
              onPreview(eq, knife.id);
              onSelectKnife(knife.id);
            }}
          />
        );
      })}
    </div>
  );
}
