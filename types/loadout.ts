export type LoadoutCategory =
  | "weapons"
  | "knives"
  | "gloves"
  | "agents"
  | "music"
  | "graffiti"
  | "pins"
  | "favorites";

export type WeaponGroup =
  | "Pistols"
  | "Heavy"
  | "SMGs"
  | "Rifles"
  | "Snipers"
  | "Grenades";

export type SkinRarity =
  | "Consumer Grade"
  | "Industrial Grade"
  | "Mil-Spec"
  | "Restricted"
  | "Classified"
  | "Covert"
  | "Contraband"
  | "Extraordinary";

export type WearName =
  | "Factory New"
  | "Minimal Wear"
  | "Field-Tested"
  | "Well-Worn"
  | "Battle-Scarred";

export type AgentFaction = "CT" | "T";

export type Skin = {
  id: string;
  weapon: string;
  paintKit: number;
  skinName: string;
  rarity: SkinRarity;
  image?: string;
  collection: string;
  wearSupported: boolean;
  stattrakSupported: boolean;
  souvenirSupported?: boolean;
};

export type WeaponDef = {
  id: string;
  name: string;
  group: WeaponGroup;
  category: "weapons" | "knives" | "gloves";
};

export type AgentDef = {
  id: string;
  name: string;
  faction: AgentFaction;
  image?: string;
};

export type EquippedItem = {
  weapon: string;
  paintKit: number;
  skinId: string;
  skinName: string;
  rarity: SkinRarity;
  wear: number;
  wearName: WearName;
  stattrak: boolean;
  seed: number;
  image?: string;
  updatedAt: string;
};

export type EquippedAgent = {
  agentId: string;
  name: string;
  faction: AgentFaction;
  updatedAt: string;
};

export type UserLoadoutState = {
  weapons: Record<string, EquippedItem>;
  knife: EquippedItem | null;
  gloves: EquippedItem | null;
  agentCT: EquippedAgent | null;
  agentT: EquippedAgent | null;
  favorites: string[];
  recentlyEquipped: EquippedItem[];
};

export type SkinFilters = {
  search: string;
  rarity: SkinRarity | "all";
  collection: string | "all";
  wear: WearName | "all";
  stattrak: "all" | "yes" | "no";
  souvenir: "all" | "yes" | "no";
  favoritesOnly: boolean;
};
