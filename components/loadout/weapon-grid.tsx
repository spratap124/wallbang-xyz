"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef, WeaponGroup } from "@/types/loadout";

type WeaponGridProps = {
  group: WeaponGroup;
  weapons: WeaponDef[];
  equipped: Record<string, EquippedItem>;
  weaponFilter: string;
  onSelectWeapon: (weaponId: string) => void;
  selectedWeapon?: string | null;
  favorites?: string[];
  onToggleFavorite?: (skinId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function WeaponGrid({
  group,
  weapons,
  equipped,
  weaponFilter,
  onSelectWeapon,
  selectedWeapon,
  favorites = [],
  onToggleFavorite,
  loading = false,
  error = null,
}: WeaponGridProps) {
  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Loading weapons…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-destructive">{error}</p>
    );
  }

  const query = weaponFilter.trim().toLowerCase();

  const items = weapons.filter((w) => {
    if (w.group !== group) return false;
    if (!query) return true;
    const eq = equipped[w.id];
    return (
      w.name.toLowerCase().includes(query) ||
      eq?.skinName.toLowerCase().includes(query) ||
      eq?.rarity.toLowerCase().includes(query)
    );
  });

  if (weapons.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No weapons in the catalog yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {group}
        </h2>
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No weapons match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((weapon) => {
            const eq = equipped[weapon.id] ?? null;
            return (
              <WeaponCard
                key={weapon.id}
                name={weapon.name}
                weaponId={weapon.id}
                defIndex={weapon.defIndex}
                equipped={eq}
                selected={selectedWeapon === weapon.id}
                isFavorite={eq ? favorites.includes(eq.skinId) : false}
                onToggleFavorite={
                  eq && onToggleFavorite
                    ? () => onToggleFavorite(eq.skinId)
                    : undefined
                }
                onClick={() => onSelectWeapon(weapon.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
