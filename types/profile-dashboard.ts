import type { SkinRarity } from "@/types/loadout";

/** Registry fields used to label a server without waiting on the live poll. */
export type ProfileServerMeta = {
  id: string;
  city: string;
  region: string;
  mode: string;
};

/** VIP summary already formatted for the profile card. Dates are not invented. */
export type ProfileVipCard = {
  active: boolean;
  lifetime: boolean;
  /** Locale date from the membership expiry, when one exists. */
  expiresOn: string | null;
  /** Remaining-time line from the shared VIP formatter. */
  daysRemaining: string | null;
  /** Locale date of the last expiry, when VIP is inactive. */
  expiredOn: string | null;
  /** Extra membership line, such as an all-retakes bundle. */
  subline: string | null;
};

export type ProfileCosmeticSlot = {
  label: string;
  /** Knife or glove model name. Null when that slot is empty. */
  name: string | null;
  skinName: string | null;
  image: string | null;
  rarity: SkinRarity | null;
};

export type ProfileLoadoutPreview = {
  knife: ProfileCosmeticSlot;
  ctGloves: ProfileCosmeticSlot;
  tGloves: ProfileCosmeticSlot;
};

export type ProfileDashboardExtras = {
  vip: ProfileVipCard;
  loadout: ProfileLoadoutPreview;
  /** Enabled fleet rows, used only to label the current server. */
  serverMeta: ProfileServerMeta[];
  /** "July 2026" — formatted once so the hero does not hydrate a different month. */
  joinedLabel: string;
};
