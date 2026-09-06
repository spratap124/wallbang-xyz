"use client";

import { WeaponCard } from "@/components/loadout/weapon-card";
import type { EquippedItem, WeaponDef } from "@/types/loadout";

type OverviewGridProps = {
  weapons: WeaponDef[];
  knives: WeaponDef[];
  gloves: WeaponDef[];
  equippedWeapons: Record<string, EquippedItem>;
  equippedKnife: EquippedItem | null;
  equippedGloves: EquippedItem | null;
  selectedWeapon?: string | null;
  favorites?: string[];
  onToggleFavorite?: (skinId: string) => void;
  onSelectWeapon: (weaponId: string, kind: "weapons" | "knives" | "gloves") => void;
};

export function OverviewGrid({
  weapons,
  knives,
  gloves,
  equippedWeapons,
  equippedKnife,
  equippedGloves,
  selectedWeapon,
  favorites = [],
  onToggleFavorite,
  onSelectWeapon,
}: OverviewGridProps) {
  const equippedList = weapons
    .map((w) => ({ def: w, item: equippedWeapons[w.id], kind: "weapons" as const }))
    .filter((row) => row.item);

  const knifeDef = equippedKnife
    ? knives.find((k) => k.id === equippedKnife.weapon)
    : null;
  const gloveDef = equippedGloves
    ? gloves.find((g) => g.id === equippedGloves.weapon)
    : null;

  const total =
    equippedList.length + (knifeDef ? 1 : 0) + (gloveDef ? 1 : 0);

  if (total === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nothing equipped on this side yet. Open a category to start building
        your loadout.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Overview
        </h2>
        <p className="text-xs text-muted-foreground">
          {total} equipped
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {equippedList.map(({ def, item, kind }) => (
          <WeaponCard
            key={def.id}
            name={def.name}
            weaponId={def.id}
            defIndex={def.defIndex}
            equipped={item!}
            selected={selectedWeapon === def.id}
            isFavorite={favorites.includes(item!.skinId)}
            onToggleFavorite={
              onToggleFavorite ? () => onToggleFavorite(item!.skinId) : undefined
            }
            onClick={() => onSelectWeapon(def.id, kind)}
          />
        ))}
        {knifeDef && equippedKnife ? (
          <WeaponCard
            name={knifeDef.name}
            weaponId={knifeDef.id}
            defIndex={knifeDef.defIndex}
            equipped={equippedKnife}
            selected={selectedWeapon === knifeDef.id}
            isFavorite={favorites.includes(equippedKnife.skinId)}
            onToggleFavorite={
              onToggleFavorite
                ? () => onToggleFavorite(equippedKnife.skinId)
                : undefined
            }
            onClick={() => onSelectWeapon(knifeDef.id, "knives")}
          />
        ) : null}
        {gloveDef && equippedGloves ? (
          <WeaponCard
            name={gloveDef.name}
            weaponId={gloveDef.id}
            defIndex={gloveDef.defIndex}
            equipped={equippedGloves}
            selected={selectedWeapon === gloveDef.id}
            isFavorite={favorites.includes(equippedGloves.skinId)}
            onToggleFavorite={
              onToggleFavorite
                ? () => onToggleFavorite(equippedGloves.skinId)
                : undefined
            }
            onClick={() => onSelectWeapon(gloveDef.id, "gloves")}
          />
        ) : null}
      </div>
    </div>
  );
}
