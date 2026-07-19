import type {
  LoadoutCategory,
  SkinRarity,
  WearName,
  WeaponGroup,
} from "@/types/loadout";

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

export const RARITY_COLORS: Record<SkinRarity, string> = {
  "Consumer Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "Mil-Spec": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Contraband: "#e4ae39",
  Extraordinary: "#e4ae39",
};

export const WEAPON_GROUPS: WeaponGroup[] = [
  "Pistols",
  "Heavy",
  "SMGs",
  "Rifles",
  "Snipers",
  "Grenades",
];

export const LOADOUT_CATEGORIES: {
  id: LoadoutCategory;
  label: string;
  icon: string;
  comingSoon?: boolean;
}[] = [
  { id: "weapons", label: "Weapons", icon: "Crosshair" },
  { id: "knives", label: "Knife", icon: "Sword" },
  { id: "gloves", label: "Gloves", icon: "Hand" },
  { id: "agents", label: "Agents", icon: "User" },
  { id: "favorites", label: "Favorites", icon: "Star", comingSoon: true },
  { id: "music", label: "Music Kits", icon: "Music", comingSoon: true },
  { id: "graffiti", label: "Graffiti", icon: "Paintbrush", comingSoon: true },
  { id: "pins", label: "Pins", icon: "Pin", comingSoon: true },
];

export const DEFAULT_SKIN_FILTERS = {
  search: "",
  rarity: "all" as const,
  collection: "all" as const,
  wear: "all" as const,
  stattrak: "all" as const,
  souvenir: "all" as const,
  favoritesOnly: false,
};
