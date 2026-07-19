"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import { WEAPON_GROUPS } from "@/lib/loadout/constants";
import { WEAPONS } from "@/lib/loadout/mock-data";
import type { EquippedItem, WeaponGroup } from "@/types/loadout";

type WeaponGridProps = {
  equipped: Record<string, EquippedItem>;
  weaponFilter: string;
  onSelectWeapon: (weaponName: string) => void;
  selectedWeapon?: string | null;
  onPreview: (item: EquippedItem | null, weaponName: string) => void;
};

export function WeaponGrid({
  equipped,
  weaponFilter,
  onSelectWeapon,
  selectedWeapon,
  onPreview,
}: WeaponGridProps) {
  const query = weaponFilter.trim().toLowerCase();

  const grouped = WEAPON_GROUPS.map((group) => {
    const items = WEAPONS.filter((w) => {
      if (w.group !== group) return false;
      if (!query) return true;
      const eq = equipped[w.name];
      return (
        w.name.toLowerCase().includes(query) ||
        eq?.skinName.toLowerCase().includes(query) ||
        eq?.rarity.toLowerCase().includes(query)
      );
    });
    return { group, items };
  }).filter((g) => g.items.length > 0);

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
              const eq = equipped[weapon.name] ?? null;
              return (
                <WeaponCard
                  key={weapon.id}
                  name={weapon.name}
                  equipped={eq}
                  selected={selectedWeapon === weapon.name}
                  onClick={() => {
                    onPreview(eq, weapon.name);
                    onSelectWeapon(weapon.name);
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
