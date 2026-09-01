"use client";

import { ChevronRight } from "lucide-react";

import { SkinImage } from "@/components/loadout/skin-image";
import { WEAPON_GROUPS } from "@/lib/loadout/constants";
import {
  resolveDefaultWeaponImage,
  resolveSkinImage,
  resolveSkinImageByName,
} from "@/lib/loadout/images";
import { cn } from "@/lib/utils";
import type { EquippedItem, WeaponDef, WeaponGroup } from "@/types/loadout";

type WeaponGroupPickerProps = {
  weapons: WeaponDef[];
  equipped: Record<string, EquippedItem>;
  filter: string;
  onSelectGroup: (group: WeaponGroup) => void;
  loading?: boolean;
  error?: string | null;
};

function groupHero(
  items: WeaponDef[],
  equipped: Record<string, EquippedItem>,
): { weapon: WeaponDef; equipped: EquippedItem | null } | null {
  if (items.length === 0) return null;
  const withSkin = items.find((w) => equipped[w.id]);
  const weapon = withSkin ?? items[0];
  return { weapon, equipped: equipped[weapon.id] ?? null };
}

export function WeaponGroupPicker({
  weapons,
  equipped,
  filter,
  onSelectGroup,
  loading = false,
  error = null,
}: WeaponGroupPickerProps) {
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

  const query = filter.trim().toLowerCase();

  const groups = WEAPON_GROUPS.map((group) => {
    const items = weapons.filter((w) => w.group === group);
    return { group, items };
  }).filter(({ group, items }) => {
    if (items.length === 0) return false;
    if (!query) return true;
    if (group.toLowerCase().includes(query)) return true;
    return items.some((w) => {
      const eq = equipped[w.id];
      return (
        w.name.toLowerCase().includes(query) ||
        eq?.skinName.toLowerCase().includes(query) ||
        eq?.rarity.toLowerCase().includes(query)
      );
    });
  });

  if (weapons.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No weapons in the catalog yet.
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No weapon categories match your search.
      </p>
    );
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Categories
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {groups.map(({ group, items }) => {
          const hero = groupHero(items, equipped);
          const eq = hero?.equipped ?? null;
          const weaponRef = hero
            ? {
                id: hero.weapon.id,
                defIndex: hero.weapon.defIndex,
                name: hero.weapon.name,
              }
            : null;
          const image = eq
            ? (eq.image ??
              (weaponRef
                ? (resolveSkinImage(weaponRef, eq.paintKit) ??
                  resolveSkinImageByName(`${hero.weapon.name}|${eq.skinName}`))
                : undefined))
            : weaponRef
              ? resolveDefaultWeaponImage(weaponRef)
              : undefined;
          const equippedCount = items.filter((w) => equipped[w.id]).length;

          return (
            <button
              key={group}
              type="button"
              onClick={() => onSelectGroup(group)}
              className={cn(
                "group flex w-full flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-all",
                "hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              <SkinImage
                name={eq?.skinName ?? group}
                rarity={eq?.rarity ?? "Consumer Grade"}
                image={image}
                size="lg"
                className="rounded-none"
                alt={group}
              />
              <div className="flex flex-1 items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-semibold">
                    {group}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {items.length} weapon{items.length === 1 ? "" : "s"}
                    {equippedCount > 0 ? ` · ${equippedCount} equipped` : ""}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
