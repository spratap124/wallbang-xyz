import type { LoadoutTab, SkinRarity, WearName, WeaponGroup } from "@/types/loadout";

export const WEAR_RANGES: { name: WearName; min: number; max: number }[] = [
  { name: "Factory New", min: 0, max: 0.07 },
  { name: "Minimal Wear", min: 0.07, max: 0.15 },
  { name: "Field-Tested", min: 0.15, max: 0.38 },
  { name: "Well-Worn", min: 0.38, max: 0.45 },
  { name: "Battle-Scarred", min: 0.45, max: 1 },
];

export function wearNameFromFloat(wear: number): WearName {
  for (const range of WEAR_RANGES) {
    if (wear >= range.min && wear < range.max) return range.name;
  }
  return "Battle-Scarred";
}

export function midFloatForWear(name: WearName): number {
  const range = WEAR_RANGES.find((r) => r.name === name);
  if (!range) return 0.15;
  return (range.min + Math.min(range.max, 0.99)) / 2;
}

export function shortWear(name: WearName): string {
  switch (name) {
    case "Factory New":
      return "FN";
    case "Minimal Wear":
      return "MW";
    case "Field-Tested":
      return "FT";
    case "Well-Worn":
      return "WW";
    case "Battle-Scarred":
      return "BS";
  }
}

export const RARITY_COLORS: Record<SkinRarity, string> = {
  "Consumer Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "Mil-Spec": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Contraband: "#e4ae39",
  Extraordinary: "#e4ae39",
  Unknown: "#9ca3af",
};

export const WEAPON_GROUPS: WeaponGroup[] = [
  "Pistols",
  "Heavy",
  "SMGs",
  "Rifles",
  "Snipers",
  "Grenades",
];

export const TAB_WEAPON_GROUP: Partial<Record<LoadoutTab, WeaponGroup>> = {
  pistols: "Pistols",
  smgs: "SMGs",
  rifles: "Rifles",
  heavy: "Heavy",
  snipers: "Snipers",
};

export const WEAPON_GROUP_TAB: Partial<Record<WeaponGroup, LoadoutTab>> = {
  Pistols: "pistols",
  SMGs: "smgs",
  Rifles: "rifles",
  Heavy: "heavy",
  Snipers: "snipers",
};

export function groupTypeLabel(group: WeaponGroup | string): string {
  switch (group) {
    case "Pistols":
      return "Pistol";
    case "SMGs":
      return "SMG";
    case "Rifles":
      return "Rifle";
    case "Snipers":
      return "Sniper";
    case "Knives":
      return "Knife";
    case "Gloves":
      return "Gloves";
    case "Heavy":
      return "Heavy";
    default:
      return group;
  }
}

export const DEFAULT_SKIN_FILTERS = {
  search: "",
  rarity: "all" as const,
  collection: "all" as const,
  wear: "all" as const,
  stattrak: "all" as const,
  souvenir: "all" as const,
  favoritesOnly: false,
};
