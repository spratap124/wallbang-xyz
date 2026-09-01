"use client";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef, WeaponGroup } from "@/types/loadout";

type WeaponGridProps = {
  group: WeaponGroup;
  weapons: WeaponDef[];
  equipped: Record<string, EquippedItem>;
  weaponFilter: string;
  onSelectWeapon: (weaponId: string) => void;
  selectedWeapon?: string | null;
  onPreview: (item: EquippedItem | null, weaponId: string) => void;
  onBack: () => void;
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
  onPreview,
  onBack,
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
      <div className="mb-6 flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to weapon categories"
          className="mt-0.5 shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Weapons
          </p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {group}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} weapon{items.length === 1 ? "" : "s"}
          </p>
        </div>
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
                onClick={() => {
                  onPreview(eq, weapon.id);
                  onSelectWeapon(weapon.id);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
