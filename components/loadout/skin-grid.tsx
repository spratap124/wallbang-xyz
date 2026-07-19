"use client";

import { SkinCard } from "@/components/loadout/skin-card";
import type { Skin } from "@/types/loadout";

type SkinGridProps = {
  skins: Skin[];
  equippedSkinId: string | null;
  favorites: string[];
  selectedSkinId: string | null;
  loading?: boolean;
  onSelect: (skin: Skin) => void;
  onEquip: (skin: Skin) => void;
  onToggleFavorite: (skinId: string) => void;
};

export function SkinGrid({
  skins,
  equippedSkinId,
  favorites,
  selectedSkinId,
  loading = false,
  onSelect,
  onEquip,
  onToggleFavorite,
}: SkinGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl bg-secondary"
          />
        ))}
      </div>
    );
  }

  if (skins.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No skins match your filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {skins.map((skin) => (
        <SkinCard
          key={skin.id}
          skin={skin}
          isEquipped={equippedSkinId === skin.id}
          isFavorite={favorites.includes(skin.id)}
          selected={selectedSkinId === skin.id}
          onSelect={() => onSelect(skin)}
          onEquip={() => onEquip(skin)}
          onToggleFavorite={() => onToggleFavorite(skin.id)}
        />
      ))}
    </div>
  );
}
