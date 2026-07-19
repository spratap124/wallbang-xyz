import type {
  AgentDef,
  EquippedItem,
  Skin,
  UserLoadoutState,
  WeaponDef,
} from "@/types/loadout";
import { midFloatForWear, wearNameFromFloat } from "@/lib/loadout/constants";
import {
  resolveAgentImage,
  resolveSkinImage,
} from "@/lib/loadout/skin-images";

export const WEAPONS: WeaponDef[] = [
  // Pistols
  { id: "glock", name: "Glock-18", group: "Pistols", category: "weapons" },
  { id: "usp_s", name: "USP-S", group: "Pistols", category: "weapons" },
  { id: "p2000", name: "P2000", group: "Pistols", category: "weapons" },
  { id: "dual_berettas", name: "Dual Berettas", group: "Pistols", category: "weapons" },
  { id: "p250", name: "P250", group: "Pistols", category: "weapons" },
  { id: "five_seven", name: "Five-SeveN", group: "Pistols", category: "weapons" },
  { id: "tec_9", name: "Tec-9", group: "Pistols", category: "weapons" },
  { id: "cz75", name: "CZ75-Auto", group: "Pistols", category: "weapons" },
  { id: "deagle", name: "Desert Eagle", group: "Pistols", category: "weapons" },
  { id: "r8", name: "R8 Revolver", group: "Pistols", category: "weapons" },
  // Heavy
  { id: "nova", name: "Nova", group: "Heavy", category: "weapons" },
  { id: "xm1014", name: "XM1014", group: "Heavy", category: "weapons" },
  { id: "mag7", name: "MAG-7", group: "Heavy", category: "weapons" },
  { id: "sawed_off", name: "Sawed-Off", group: "Heavy", category: "weapons" },
  { id: "m249", name: "M249", group: "Heavy", category: "weapons" },
  { id: "negev", name: "Negev", group: "Heavy", category: "weapons" },
  // SMGs
  { id: "mac10", name: "MAC-10", group: "SMGs", category: "weapons" },
  { id: "mp9", name: "MP9", group: "SMGs", category: "weapons" },
  { id: "mp7", name: "MP7", group: "SMGs", category: "weapons" },
  { id: "mp5sd", name: "MP5-SD", group: "SMGs", category: "weapons" },
  { id: "ump45", name: "UMP-45", group: "SMGs", category: "weapons" },
  { id: "p90", name: "P90", group: "SMGs", category: "weapons" },
  { id: "bizon", name: "PP-Bizon", group: "SMGs", category: "weapons" },
  // Rifles
  { id: "famas", name: "FAMAS", group: "Rifles", category: "weapons" },
  { id: "galil", name: "Galil AR", group: "Rifles", category: "weapons" },
  { id: "m4a4", name: "M4A4", group: "Rifles", category: "weapons" },
  { id: "m4a1_s", name: "M4A1-S", group: "Rifles", category: "weapons" },
  { id: "ak47", name: "AK-47", group: "Rifles", category: "weapons" },
  { id: "aug", name: "AUG", group: "Rifles", category: "weapons" },
  { id: "sg553", name: "SG 553", group: "Rifles", category: "weapons" },
  // Snipers
  { id: "ssg08", name: "SSG 08", group: "Snipers", category: "weapons" },
  { id: "awp", name: "AWP", group: "Snipers", category: "weapons" },
  { id: "scar20", name: "SCAR-20", group: "Snipers", category: "weapons" },
  { id: "g3sg1", name: "G3SG1", group: "Snipers", category: "weapons" },
  // Grenades
  { id: "he", name: "HE Grenade", group: "Grenades", category: "weapons" },
  { id: "flash", name: "Flashbang", group: "Grenades", category: "weapons" },
  { id: "smoke", name: "Smoke Grenade", group: "Grenades", category: "weapons" },
  { id: "molotov", name: "Molotov", group: "Grenades", category: "weapons" },
  { id: "incendiary", name: "Incendiary", group: "Grenades", category: "weapons" },
  { id: "decoy", name: "Decoy Grenade", group: "Grenades", category: "weapons" },
];

export const KNIVES: WeaponDef[] = [
  { id: "knife_karambit", name: "Karambit", group: "Rifles", category: "knives" },
  { id: "knife_butterfly", name: "Butterfly Knife", group: "Rifles", category: "knives" },
  { id: "knife_bayonet", name: "Bayonet", group: "Rifles", category: "knives" },
  { id: "knife_m9", name: "M9 Bayonet", group: "Rifles", category: "knives" },
  { id: "knife_talon", name: "Talon Knife", group: "Rifles", category: "knives" },
  { id: "knife_skeleton", name: "Skeleton Knife", group: "Rifles", category: "knives" },
  { id: "knife_flip", name: "Flip Knife", group: "Rifles", category: "knives" },
  { id: "knife_gut", name: "Gut Knife", group: "Rifles", category: "knives" },
  { id: "knife_huntsman", name: "Huntsman Knife", group: "Rifles", category: "knives" },
  { id: "knife_falchion", name: "Falchion Knife", group: "Rifles", category: "knives" },
  { id: "knife_bowie", name: "Bowie Knife", group: "Rifles", category: "knives" },
  { id: "knife_navaja", name: "Navaja Knife", group: "Rifles", category: "knives" },
  { id: "knife_stiletto", name: "Stiletto Knife", group: "Rifles", category: "knives" },
  { id: "knife_ursus", name: "Ursus Knife", group: "Rifles", category: "knives" },
  { id: "knife_classic", name: "Classic Knife", group: "Rifles", category: "knives" },
  { id: "knife_paracord", name: "Paracord Knife", group: "Rifles", category: "knives" },
  { id: "knife_survival", name: "Survival Knife", group: "Rifles", category: "knives" },
  { id: "knife_nomad", name: "Nomad Knife", group: "Rifles", category: "knives" },
];

export const GLOVES: WeaponDef[] = [
  { id: "gloves_sport", name: "Sport Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_driver", name: "Driver Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_moto", name: "Moto Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_specialist", name: "Specialist Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_bloodhound", name: "Bloodhound Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_hand_wraps", name: "Hand Wraps", group: "Rifles", category: "gloves" },
  { id: "gloves_hydra", name: "Hydra Gloves", group: "Rifles", category: "gloves" },
  { id: "gloves_broken_fang", name: "Broken Fang Gloves", group: "Rifles", category: "gloves" },
];

export const AGENTS: AgentDef[] = [
  {
    id: "agent_buckshot",
    name: "'Blueberries' Buckshot | NSWC SEAL",
    faction: "CT",
    image: resolveAgentImage("'Blueberries' Buckshot | NSWC SEAL"),
  },
  {
    id: "agent_mccoy",
    name: "'Two Times' McCoy | TACP Cavalry",
    faction: "CT",
    image: resolveAgentImage("'Two Times' McCoy | TACP Cavalry"),
  },
  {
    id: "agent_jamison",
    name: "Cmdr. Mae 'Dead Cold' Jamison | SWAT",
    faction: "CT",
    image: resolveAgentImage("Cmdr. Mae 'Dead Cold' Jamison | SWAT"),
  },
  {
    id: "agent_farlow",
    name: "1st Lieutenant Farlow | SWAT",
    faction: "CT",
    image: resolveAgentImage("1st Lieutenant Farlow | SWAT"),
  },
  {
    id: "agent_kask",
    name: "John 'Van Healen' Kask | SWAT",
    faction: "CT",
    image: resolveAgentImage("John 'Van Healen' Kask | SWAT"),
  },
  {
    id: "agent_darryl",
    name: "Bloody Darryl The Strapped | The Professionals",
    faction: "T",
    image: resolveAgentImage(
      "Bloody Darryl The Strapped | The Professionals",
    ),
  },
  {
    id: "agent_rezan",
    name: "Rezan the Redshirt | Sabre",
    faction: "T",
    image: resolveAgentImage("Rezan the Redshirt | Sabre"),
  },
  {
    id: "agent_miami",
    name: "Sir Bloody Miami Darryl | The Professionals",
    faction: "T",
    image: resolveAgentImage("Sir Bloody Miami Darryl | The Professionals"),
  },
  {
    id: "agent_voltzmann",
    name: "Safecracker Voltzmann | The Professionals",
    faction: "T",
    image: resolveAgentImage("Safecracker Voltzmann | The Professionals"),
  },
  {
    id: "agent_sally",
    name: "Getaway Sally | The Professionals",
    faction: "T",
    image: resolveAgentImage("Getaway Sally | The Professionals"),
  },
];

type SkinSeed = {
  skinName: string;
  rarity: Skin["rarity"];
  collection: string;
  paintKit: number;
  wearSupported?: boolean;
  stattrakSupported?: boolean;
};

const WEAPON_SKINS: Record<string, SkinSeed[]> = {
  "AK-47": [
    { skinName: "Fire Serpent", rarity: "Covert", collection: "Operation Bravo", paintKit: 180 },
    { skinName: "Asiimov", rarity: "Covert", collection: "Operation Phoenix", paintKit: 255 },
    { skinName: "Redline", rarity: "Classified", collection: "Winter Offensive", paintKit: 282 },
    { skinName: "Vulcan", rarity: "Covert", collection: "Huntsman", paintKit: 300 },
    { skinName: "Bloodsport", rarity: "Covert", collection: "Spectrum", paintKit: 639 },
    { skinName: "Neon Revolution", rarity: "Covert", collection: "Chroma 3", paintKit: 600 },
    { skinName: "The Empress", rarity: "Covert", collection: "Spectrum 2", paintKit: 675 },
    { skinName: "Slate", rarity: "Mil-Spec", collection: "Fracture", paintKit: 788 },
    { skinName: "Ice Coaled", rarity: "Classified", collection: "Recoil", paintKit: 1143 },
    { skinName: "Inheritance", rarity: "Covert", collection: "Kilowatt", paintKit: 1221 },
  ],
  "M4A1-S": [
    { skinName: "Printstream", rarity: "Covert", collection: "Fracture", paintKit: 984 },
    { skinName: "Hyper Beast", rarity: "Covert", collection: "Chroma 2", paintKit: 430 },
    { skinName: "Player Two", rarity: "Covert", collection: "Prisma 2", paintKit: 792 },
    { skinName: "Mecha Industries", rarity: "Covert", collection: "Gamma 2", paintKit: 587 },
    { skinName: "Icarus Fell", rarity: "Restricted", collection: "Gods and Monsters", paintKit: 440 },
    { skinName: "Blue Phosphor", rarity: "Classified", collection: "Control", paintKit: 1005 },
    { skinName: "Black Lotus", rarity: "Classified", collection: "Revolution", paintKit: 1151 },
  ],
  M4A4: [
    { skinName: "Howl", rarity: "Contraband", collection: "Huntsman", paintKit: 309 },
    { skinName: "Asiimov", rarity: "Covert", collection: "Operation Phoenix", paintKit: 255 },
    { skinName: "The Emperor", rarity: "Covert", collection: "Prisma", paintKit: 844 },
    { skinName: "Neo-Noir", rarity: "Covert", collection: "Clutch", paintKit: 695 },
    { skinName: "Desolate Space", rarity: "Classified", collection: "Gamma", paintKit: 588 },
    { skinName: "Temukau", rarity: "Covert", collection: "Revolution", paintKit: 1145 },
  ],
  AWP: [
    { skinName: "Dragon Lore", rarity: "Covert", collection: "Cobblestone", paintKit: 344 },
    { skinName: "Asiimov", rarity: "Covert", collection: "Operation Phoenix", paintKit: 279 },
    { skinName: "Hyper Beast", rarity: "Covert", collection: "Falchion", paintKit: 475 },
    { skinName: "Neo-Noir", rarity: "Covert", collection: "Danger Zone", paintKit: 803 },
    { skinName: "Wildfire", rarity: "Covert", collection: "CS20", paintKit: 917 },
    { skinName: "Chromatic Aberration", rarity: "Covert", collection: "Recoil", paintKit: 1144 },
    { skinName: "Gungnir", rarity: "Covert", collection: "Norse", paintKit: 756 },
    { skinName: "Printstream", rarity: "Covert", collection: "Fever", paintKit: 1359 },
  ],
  "Desert Eagle": [
    { skinName: "Blaze", rarity: "Restricted", collection: "Dust", paintKit: 37 },
    { skinName: "Printstream", rarity: "Covert", collection: "Fracture", paintKit: 984 },
    { skinName: "Code Red", rarity: "Covert", collection: "Horizon", paintKit: 711 },
    { skinName: "Kumicho Dragon", rarity: "Classified", collection: "Operation Wildfire", paintKit: 527 },
    { skinName: "Ocean Drive", rarity: "Covert", collection: "Operation Riptide", paintKit: 1090 },
  ],
  "USP-S": [
    { skinName: "Kill Confirmed", rarity: "Covert", collection: "Shadow", paintKit: 504 },
    { skinName: "Neo-Noir", rarity: "Covert", collection: "Spectrum 2", paintKit: 653 },
    { skinName: "The Traitor", rarity: "Covert", collection: "Operation Broken Fang", paintKit: 1006 },
    { skinName: "Printstream", rarity: "Covert", collection: "Fever", paintKit: 1359 },
    { skinName: "Cortex", rarity: "Classified", collection: "Clutch", paintKit: 705 },
  ],
  "Glock-18": [
    { skinName: "Fade", rarity: "Restricted", collection: "Assault", paintKit: 38 },
    { skinName: "Water Elemental", rarity: "Classified", collection: "Breakout", paintKit: 353 },
    { skinName: "Vogue", rarity: "Classified", collection: "Fracture", paintKit: 963 },
    { skinName: "Moonrise", rarity: "Restricted", collection: "Prisma", paintKit: 852 },
    { skinName: "Gamma Doppler", rarity: "Covert", collection: "Fever", paintKit: 1360 },
  ],
  "SSG 08": [
    { skinName: "Blood in the Water", rarity: "Covert", collection: "Arms Deal", paintKit: 222 },
    { skinName: "Dragonfire", rarity: "Covert", collection: "Glove", paintKit: 624 },
    { skinName: "Turbo Peek", rarity: "Classified", collection: "Operation Riptide", paintKit: 1101 },
  ],
  FAMAS: [
    { skinName: "Roll Cage", rarity: "Classified", collection: "Gamma 2", paintKit: 604 },
    { skinName: "Mecha Industries", rarity: "Classified", collection: "Glove", paintKit: 626 },
    { skinName: "Commemoration", rarity: "Covert", collection: "CS20", paintKit: 919 },
  ],
  AUG: [
    { skinName: "Akihabara Accept", rarity: "Covert", collection: "Rising Sun", paintKit: 455 },
    { skinName: "Chameleon", rarity: "Covert", collection: "Operation Phoenix", paintKit: 280 },
    { skinName: "Momentum", rarity: "Classified", collection: "Prisma", paintKit: 845 },
  ],
};

const DEFAULT_WEAPON_SKINS: SkinSeed[] = [
  { skinName: "Vanilla", rarity: "Consumer Grade", collection: "Default", paintKit: 0, wearSupported: false, stattrakSupported: false },
  { skinName: "Urban Masked", rarity: "Industrial Grade", collection: "Italy", paintKit: 26 },
  { skinName: "Forest DDPAT", rarity: "Industrial Grade", collection: "Train", paintKit: 5 },
  { skinName: "Red Laminate", rarity: "Mil-Spec", collection: "eSports 2013", paintKit: 14 },
  { skinName: "Blue Laminate", rarity: "Mil-Spec", collection: "eSports 2013 Winter", paintKit: 28 },
  { skinName: "Case Hardened", rarity: "Classified", collection: "Arms Deal", paintKit: 44 },
];

const KNIFE_SKINS: SkinSeed[] = [
  { skinName: "Vanilla", rarity: "Covert", collection: "Default", paintKit: 0, wearSupported: false, stattrakSupported: false },
  { skinName: "Fade", rarity: "Covert", collection: "Chroma", paintKit: 38 },
  { skinName: "Doppler", rarity: "Covert", collection: "Chroma", paintKit: 418 },
  { skinName: "Marble Fade", rarity: "Covert", collection: "Chroma", paintKit: 413 },
  { skinName: "Tiger Tooth", rarity: "Covert", collection: "Chroma", paintKit: 409 },
  { skinName: "Lore", rarity: "Covert", collection: "Gamma", paintKit: 558 },
  { skinName: "Gamma Doppler", rarity: "Covert", collection: "Gamma", paintKit: 568 },
  { skinName: "Autotronic", rarity: "Covert", collection: "Gamma", paintKit: 574 },
  { skinName: "Black Laminate", rarity: "Covert", collection: "Gamma", paintKit: 563 },
  { skinName: "Slaughter", rarity: "Covert", collection: "Arms Deal", paintKit: 59 },
  { skinName: "Crimson Web", rarity: "Covert", collection: "Arms Deal", paintKit: 12 },
  { skinName: "Night", rarity: "Covert", collection: "Arms Deal", paintKit: 40 },
  { skinName: "Case Hardened", rarity: "Covert", collection: "Arms Deal", paintKit: 44 },
  { skinName: "Rust Coat", rarity: "Covert", collection: "Chroma", paintKit: 414 },
  { skinName: "Damascus Steel", rarity: "Covert", collection: "Chroma", paintKit: 410 },
];

const GLOVE_SKINS: Record<string, SkinSeed[]> = {
  "Sport Gloves": [
    { skinName: "Pandora's Box", rarity: "Extraordinary", collection: "Glove", paintKit: 10037, wearSupported: true, stattrakSupported: false },
    { skinName: "Superconductor", rarity: "Extraordinary", collection: "Glove", paintKit: 10038 },
    { skinName: "Vice", rarity: "Extraordinary", collection: "Clutch", paintKit: 10048 },
    { skinName: "Slingshot", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10073 },
    { skinName: "Nocts", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10072 },
  ],
  "Driver Gloves": [
    { skinName: "Crimson Weave", rarity: "Extraordinary", collection: "Glove", paintKit: 10016 },
    { skinName: "King Snake", rarity: "Extraordinary", collection: "Clutch", paintKit: 10041 },
    { skinName: "Imperial Plaid", rarity: "Extraordinary", collection: "Clutch", paintKit: 10042 },
    { skinName: "Snow Leopard", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10080 },
  ],
  "Moto Gloves": [
    { skinName: "Spearmint", rarity: "Extraordinary", collection: "Glove", paintKit: 10026 },
    { skinName: "Cool Mint", rarity: "Extraordinary", collection: "Glove", paintKit: 10024 },
    { skinName: "Polygon", rarity: "Extraordinary", collection: "Clutch", paintKit: 10036 },
    { skinName: "Finish Line", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10077 },
  ],
  "Specialist Gloves": [
    { skinName: "Crimson Kimono", rarity: "Extraordinary", collection: "Glove", paintKit: 10033 },
    { skinName: "Emerald Web", rarity: "Extraordinary", collection: "Glove", paintKit: 10034 },
    { skinName: "Fade", rarity: "Extraordinary", collection: "Clutch", paintKit: 10040 },
    { skinName: "Tiger Strike", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10065 },
  ],
  "Bloodhound Gloves": [
    { skinName: "Charred", rarity: "Extraordinary", collection: "Glove", paintKit: 10006 },
    { skinName: "Snakebite", rarity: "Extraordinary", collection: "Glove", paintKit: 10007 },
    { skinName: "Bronzed", rarity: "Extraordinary", collection: "Glove", paintKit: 10008 },
    { skinName: "Guerrilla", rarity: "Extraordinary", collection: "Glove", paintKit: 10039 },
  ],
  "Hand Wraps": [
    { skinName: "Cobalt Skulls", rarity: "Extraordinary", collection: "Clutch", paintKit: 10053 },
    { skinName: "Overprint", rarity: "Extraordinary", collection: "Clutch", paintKit: 10056 },
    { skinName: "Duct Tape", rarity: "Extraordinary", collection: "Clutch", paintKit: 10055 },
    { skinName: "CAUTION!", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10084 },
  ],
  "Hydra Gloves": [
    { skinName: "Case Hardened", rarity: "Extraordinary", collection: "Operation Hydra", paintKit: 10057 },
    { skinName: "Emerald", rarity: "Extraordinary", collection: "Operation Hydra", paintKit: 10058 },
    { skinName: "Mangrove", rarity: "Extraordinary", collection: "Operation Hydra", paintKit: 10059 },
    { skinName: "Rattler", rarity: "Extraordinary", collection: "Operation Hydra", paintKit: 10060 },
  ],
  "Broken Fang Gloves": [
    { skinName: "Jade", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10085 },
    { skinName: "Yellow-banded", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10086 },
    { skinName: "Unhinged", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10087 },
    { skinName: "Needle Point", rarity: "Extraordinary", collection: "Operation Broken Fang", paintKit: 10088 },
  ],
};

function toSkin(weapon: string, seed: SkinSeed): Skin {
  return {
    id: `${weapon.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${seed.paintKit}-${seed.skinName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    weapon,
    paintKit: seed.paintKit,
    skinName: seed.skinName,
    rarity: seed.rarity,
    image: resolveSkinImage(weapon, seed.skinName),
    collection: seed.collection,
    wearSupported: seed.wearSupported ?? seed.skinName !== "Vanilla",
    stattrakSupported:
      seed.stattrakSupported ??
      (seed.skinName !== "Vanilla" && !weapon.includes("Gloves")),
  };
}

/** Lazy: returns skins for a single weapon / knife / glove type. */
export function getSkinsForWeapon(weaponName: string): Skin[] {
  if (KNIVES.some((k) => k.name === weaponName)) {
    return KNIFE_SKINS.map((s) => toSkin(weaponName, s));
  }
  if (GLOVES.some((g) => g.name === weaponName)) {
    const seeds = GLOVE_SKINS[weaponName] ?? [
      { skinName: "Default", rarity: "Extraordinary" as const, collection: "Glove", paintKit: 0, wearSupported: true, stattrakSupported: false },
    ];
    return seeds.map((s) => toSkin(weaponName, { ...s, stattrakSupported: false }));
  }
  const seeds = WEAPON_SKINS[weaponName] ?? DEFAULT_WEAPON_SKINS;
  return seeds.map((s) => toSkin(weaponName, s));
}

export function getCollectionsForWeapon(weaponName: string): string[] {
  const collections = new Set(getSkinsForWeapon(weaponName).map((s) => s.collection));
  return Array.from(collections).sort();
}

function makeEquipped(skin: Skin, wear = 0.12, stattrak = false): EquippedItem {
  return {
    weapon: skin.weapon,
    paintKit: skin.paintKit,
    skinId: skin.id,
    skinName: skin.skinName,
    rarity: skin.rarity,
    wear,
    wearName: wearNameFromFloat(wear),
    stattrak: skin.stattrakSupported ? stattrak : false,
    seed: 661,
    image: skin.image ?? resolveSkinImage(skin.weapon, skin.skinName),
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialLoadout(): UserLoadoutState {
  const ak = getSkinsForWeapon("AK-47").find((s) => s.skinName === "Fire Serpent")!;
  const awp = getSkinsForWeapon("AWP").find((s) => s.skinName === "Asiimov")!;
  const deagle = getSkinsForWeapon("Desert Eagle").find((s) => s.skinName === "Blaze")!;
  const m4 = getSkinsForWeapon("M4A1-S").find((s) => s.skinName === "Printstream")!;
  const knife = getSkinsForWeapon("Karambit").find((s) => s.skinName === "Doppler")!;
  const gloves = getSkinsForWeapon("Sport Gloves").find((s) => s.skinName === "Vice")!;

  const equippedAk = makeEquipped(ak, midFloatForWear("Field-Tested"), true);
  const equippedKnife = makeEquipped(knife, midFloatForWear("Factory New"));
  const equippedGloves = makeEquipped(gloves, midFloatForWear("Minimal Wear"));

  return {
    weapons: {
      "AK-47": equippedAk,
      AWP: makeEquipped(awp, midFloatForWear("Field-Tested")),
      "Desert Eagle": makeEquipped(deagle, midFloatForWear("Factory New")),
      "M4A1-S": makeEquipped(m4, midFloatForWear("Minimal Wear"), true),
    },
    knife: equippedKnife,
    gloves: equippedGloves,
    agentCT: {
      agentId: "agent_buckshot",
      name: "'Blueberries' Buckshot | NSWC SEAL",
      faction: "CT",
      updatedAt: new Date().toISOString(),
    },
    agentT: {
      agentId: "agent_miami",
      name: "Sir Bloody Miami Darryl | The Professionals",
      faction: "T",
      updatedAt: new Date().toISOString(),
    },
    favorites: [ak.id, knife.id, gloves.id, m4.id],
    recentlyEquipped: [equippedAk, equippedGloves, equippedKnife],
  };
}

/** Simulated async fetch — Phase 2 will hit GET /api/skins?weapon= */
export async function fetchSkinsForWeapon(weaponName: string): Promise<Skin[]> {
  await new Promise((r) => setTimeout(r, 180));
  return getSkinsForWeapon(weaponName);
}
