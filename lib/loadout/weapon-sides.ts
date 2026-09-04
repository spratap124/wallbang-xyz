import type { LoadoutSide, WeaponDef, WeaponGroup } from "@/types/loadout";

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/^weapon_/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * CS2 buy-menu exclusives. Shared guns (AWP, Deagle, …) are omitted and
 * treated as available on both sides.
 *
 * Keys are normalized ids / display names (punctuation stripped).
 */
const CT_ONLY = new Set([
  "m4a4",
  "m4a1",
  "m4a1s",
  "m4a1silencer",
  "famas",
  "aug",
  "scar20",
  "usps",
  "usp",
  "uspsilencer",
  "fiveseven",
  "mp9",
  "mag7",
  "p2000",
  "hkp2000",
  "incgrenade",
  "incendiary",
]);

const T_ONLY = new Set([
  "ak47",
  "galil",
  "galilar",
  "sg553",
  "sg556",
  "g3sg1",
  "glock",
  "glock18",
  "tec9",
  "mac10",
  "sawedoff",
  "molotov",
]);

const SNIPER_KEYS = new Set(["awp", "ssg08", "ssg", "scar20", "g3sg1"]);

export function isSniperWeapon(weapon: {
  id: string;
  name?: string | null;
  weapon?: string | null;
}): boolean {
  return [weapon.id, weapon.weapon, weapon.name]
    .filter((value): value is string => Boolean(value))
    .map(norm)
    .some((key) => SNIPER_KEYS.has(key));
}

export function canonicalWeaponGroup(weapon: WeaponDef): WeaponGroup {
  if (isSniperWeapon(weapon)) return "Snipers";
  const group = weapon.group as string;
  if (/sniper/i.test(group)) return "Snipers";
  return weapon.group;
}

export function withCanonicalGroups(weapons: WeaponDef[]): WeaponDef[] {
  return weapons.map((weapon) => {
    const group = canonicalWeaponGroup(weapon);
    return group === weapon.group ? weapon : { ...weapon, group };
  });
}

export type WeaponTeam = LoadoutSide | "both";

export function weaponTeam(weapon: {
  id: string;
  name?: string | null;
  weapon?: string | null;
}): WeaponTeam {
  const keys = [weapon.id, weapon.weapon, weapon.name]
    .filter((value): value is string => Boolean(value))
    .map(norm);

  if (keys.some((key) => CT_ONLY.has(key))) return "CT";
  if (keys.some((key) => T_ONLY.has(key))) return "T";
  return "both";
}

export function isWeaponOnSide(
  weapon: { id: string; name?: string | null; weapon?: string | null },
  side: LoadoutSide,
): boolean {
  const team = weaponTeam(weapon);
  return team === "both" || team === side;
}

export function weaponsForSide(
  weapons: WeaponDef[],
  side: LoadoutSide,
): WeaponDef[] {
  return weapons.filter((weapon) => isWeaponOnSide(weapon, side));
}
