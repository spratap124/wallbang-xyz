"use client";

import { SkinImage } from "@/components/loadout/skin-image";
import type { EquippedItem } from "@/types/loadout";

type RecentlyEquippedProps = {
  items: EquippedItem[];
  onSelect: (item: EquippedItem) => void;
  /** Resolve CS2 catalog id → display name for the subtitle. */
  resolveWeaponLabel?: (weaponId: string) => string;
};

export function RecentlyEquipped({
  items,
  onSelect,
  resolveWeaponLabel,
}: RecentlyEquippedProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-3 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Recently Equipped
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const weaponLabel =
            resolveWeaponLabel?.(item.weapon) ?? item.weapon;
          return (
            <button
              key={`${item.weapon}-${item.skinId}-${item.updatedAt}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-36 shrink-0 overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-all hover:ring-primary/40"
            >
              <SkinImage
                name={item.skinName}
                rarity={item.rarity}
                image={item.image}
                size="sm"
                className="rounded-none"
                alt={`${weaponLabel} | ${item.skinName}`}
              />
              <div className="p-2">
                <p className="truncate text-xs font-semibold">{item.skinName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {weaponLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
