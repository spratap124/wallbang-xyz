"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import { WEAPON_GROUPS } from "@/lib/loadout/constants";
import type { EquippedItem, WeaponDef, WeaponGroup } from "@/types/loadout";

type WeaponGridProps = {
  weapons: WeaponDef[];
  equipped: Record<string, EquippedItem>;
  weaponFilter: string;
  onSelectWeapon: (weaponId: string) => void;
  selectedWeapon?: string | null;
  onPreview: (item: EquippedItem | null, weaponId: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function WeaponGrid({
  weapons,
  equipped,
  weaponFilter,
  onSelectWeapon,
  selectedWeapon,
  onPreview,
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

  const grouped = WEAPON_GROUPS.map((group) => {
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
    return { group, items };
  }).filter((g) => g.items.length > 0);

  if (weapons.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No weapons in the catalog yet.
      </p>
    );
  }

  if (grouped.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No weapons match your search.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h3 className="mb-3 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {group as WeaponGroup}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
                  onClick={() => {
                    onPreview(eq, weapon.id);
                    onSelectWeapon(weapon.id);
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
