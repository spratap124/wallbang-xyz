/** Complete official glove skins (ByMykel/CSGO-API). Used when the ingested catalog is incomplete. */

import type { CatalogGlove, CatalogGloveSkin } from "@/types/catalog";

export type OfficialGloveSkin = {
  id: string;
  displayName: string;
  paintKit: number;
};

export const OFFICIAL_GLOVE_SKINS: Record<string, OfficialGloveSkin[]> = {
  bloodhound: [
    { id: "charred", displayName: "Charred", paintKit: 10006 },
    { id: "snakebite", displayName: "Snakebite", paintKit: 10007 },
    { id: "bronzed", displayName: "Bronzed", paintKit: 10008 },
    { id: "guerrilla", displayName: "Guerrilla", paintKit: 10039 },
  ],
  brokenfang: [
    { id: "jade", displayName: "Jade", paintKit: 10085 },
    { id: "unhinged", displayName: "Unhinged", paintKit: 10088 },
    { id: "yellow_banded", displayName: "Yellow-banded", paintKit: 10086 },
    { id: "needle_point", displayName: "Needle Point", paintKit: 10087 },
  ],
  driver: [
    { id: "lunar_weave", displayName: "Lunar Weave", paintKit: 10013 },
    { id: "convoy", displayName: "Convoy", paintKit: 10015 },
    { id: "crimson_weave", displayName: "Crimson Weave", paintKit: 10016 },
    { id: "diamondback", displayName: "Diamondback", paintKit: 10040 },
    { id: "king_snake", displayName: "King Snake", paintKit: 10041 },
    { id: "imperial_plaid", displayName: "Imperial Plaid", paintKit: 10042 },
    { id: "overtake", displayName: "Overtake", paintKit: 10043 },
    { id: "racing_green", displayName: "Racing Green", paintKit: 10044 },
    { id: "black_tie", displayName: "Black Tie", paintKit: 10072 },
    { id: "snow_leopard", displayName: "Snow Leopard", paintKit: 10070 },
    { id: "rezan_the_red", displayName: "Rezan the Red", paintKit: 10069 },
    { id: "queen_jaguar", displayName: "Queen Jaguar", paintKit: 10071 },
    { id: "brocade_crane", displayName: "Brocade Crane", paintKit: 1399 },
    { id: "brocade_flowers", displayName: "Brocade Flowers", paintKit: 1400 },
    { id: "dragon_fists", displayName: "Dragon Fists", paintKit: 1401 },
    { id: "garden", displayName: "Garden", paintKit: 1402 },
    { id: "hand_sweaters", displayName: "Hand Sweaters", paintKit: 1439 },
    { id: "plum_quill", displayName: "Plum Quill", paintKit: 1412 },
    { id: "seigaiha", displayName: "Seigaiha", paintKit: 1404 },
    { id: "wave_chaser", displayName: "Wave Chaser", paintKit: 1398 },
  ],
  handwraps: [
    { id: "leather", displayName: "Leather", paintKit: 10009 },
    { id: "spruce_ddpat", displayName: "Spruce DDPAT", paintKit: 10010 },
    { id: "slaughter", displayName: "Slaughter", paintKit: 10021 },
    { id: "badlands", displayName: "Badlands", paintKit: 10036 },
    { id: "cobalt_skulls", displayName: "Cobalt Skulls", paintKit: 10053 },
    { id: "overprint", displayName: "Overprint", paintKit: 10054 },
    { id: "duct_tape", displayName: "Duct Tape", paintKit: 10055 },
    { id: "arboreal", displayName: "Arboreal", paintKit: 10056 },
    { id: "giraffe", displayName: "Giraffe", paintKit: 10082 },
    { id: "caution", displayName: "CAUTION!", paintKit: 10084 },
    { id: "desert_shamagh", displayName: "Desert Shamagh", paintKit: 10081 },
    { id: "constrictor", displayName: "Constrictor", paintKit: 10083 },
  ],
  hydra: [
    { id: "emerald", displayName: "Emerald", paintKit: 10057 },
    { id: "mangrove", displayName: "Mangrove", paintKit: 10058 },
    { id: "rattler", displayName: "Rattler", paintKit: 10059 },
    { id: "case_hardened", displayName: "Case Hardened", paintKit: 10060 },
  ],
  moto: [
    { id: "eclipse", displayName: "Eclipse", paintKit: 10024 },
    { id: "spearmint", displayName: "Spearmint", paintKit: 10026 },
    { id: "boom", displayName: "Boom!", paintKit: 10027 },
    { id: "cool_mint", displayName: "Cool Mint", paintKit: 10028 },
    { id: "pow", displayName: "POW!", paintKit: 10049 },
    { id: "turtle", displayName: "Turtle", paintKit: 10050 },
    { id: "transport", displayName: "Transport", paintKit: 10051 },
    { id: "polygon", displayName: "Polygon", paintKit: 10052 },
    { id: "blood_pressure", displayName: "Blood Pressure", paintKit: 10079 },
    { id: "3rd_commando", displayName: "3rd Commando Company", paintKit: 10080 },
    { id: "finish_line", displayName: "Finish Line", paintKit: 10077 },
    { id: "smoke_out", displayName: "Smoke Out", paintKit: 10078 },
  ],
  specialist: [
    { id: "forest_ddpat", displayName: "Forest DDPAT", paintKit: 10030 },
    { id: "crimson_kimono", displayName: "Crimson Kimono", paintKit: 10033 },
    { id: "emerald_web", displayName: "Emerald Web", paintKit: 10034 },
    { id: "foundation", displayName: "Foundation", paintKit: 10035 },
    { id: "crimson_web", displayName: "Crimson Web", paintKit: 10061 },
    { id: "buckshot", displayName: "Buckshot", paintKit: 10062 },
    { id: "fade", displayName: "Fade", paintKit: 10063 },
    { id: "mogul", displayName: "Mogul", paintKit: 10064 },
    { id: "tiger_strike", displayName: "Tiger Strike", paintKit: 10067 },
    { id: "marble_fade", displayName: "Marble Fade", paintKit: 10065 },
    { id: "field_agent", displayName: "Field Agent", paintKit: 10068 },
    { id: "lt_commander", displayName: "Lt. Commander", paintKit: 10066 },
    { id: "lime_polycam", displayName: "Lime Polycam", paintKit: 1413 },
    { id: "cloud_chaser", displayName: "Cloud Chaser", paintKit: 1440 },
    { id: "blackbook", displayName: "Blackbook", paintKit: 1414 },
    {
      id: "chocolate_chesterfield",
      displayName: "Chocolate Chesterfield",
      paintKit: 1415,
    },
    { id: "pillow_punchers", displayName: "Pillow Punchers", paintKit: 1438 },
    { id: "sunburst", displayName: "Sunburst", paintKit: 1416 },
    { id: "big_swell", displayName: "Big Swell", paintKit: 1437 },
  ],
  sport: [
    { id: "superconductor", displayName: "Superconductor", paintKit: 10018 },
    { id: "arid", displayName: "Arid", paintKit: 10019 },
    { id: "pandoras_box", displayName: "Pandora's Box", paintKit: 10037 },
    { id: "hedge_maze", displayName: "Hedge Maze", paintKit: 10038 },
    { id: "amphibious", displayName: "Amphibious", paintKit: 10045 },
    { id: "bronze_morph", displayName: "Bronze Morph", paintKit: 10046 },
    { id: "omega", displayName: "Omega", paintKit: 10047 },
    { id: "vice", displayName: "Vice", paintKit: 10048 },
    { id: "slingshot", displayName: "Slingshot", paintKit: 10073 },
    { id: "big_game", displayName: "Big Game", paintKit: 10074 },
    { id: "scarlet_shamagh", displayName: "Scarlet Shamagh", paintKit: 10075 },
    { id: "nocts", displayName: "Nocts", paintKit: 10076 },
    { id: "violet_beadwork", displayName: "Violet Beadwork", paintKit: 1405 },
    { id: "frosty", displayName: "Frosty", paintKit: 1406 },
    { id: "blaze", displayName: "Blaze", paintKit: 1407 },
    { id: "creme_pinstripe", displayName: "Creme Pinstripe", paintKit: 1408 },
    { id: "red_racer", displayName: "Red Racer", paintKit: 1409 },
    { id: "ultra_violent", displayName: "Ultra Violent", paintKit: 1410 },
    { id: "occult", displayName: "Occult", paintKit: 1417 },
  ],
};

/**
 * Resolve skins for a glove model.
 *
 * Default gloves (`defIndex` 0) have no cosmetics.
 * Every other known family uses the full official set: the ingested catalog
 * omits 2024–2026 paints and has a few swapped paint kits (Driver Black Tie,
 * Broken Fang Needle Point, …).
 */
export function resolveGloveSkins(
  glove: Pick<CatalogGlove, "id" | "defIndex" | "skins">,
): CatalogGloveSkin[] {
  if (!glove.defIndex) return [];
  return OFFICIAL_GLOVE_SKINS[glove.id] ?? glove.skins;
}
