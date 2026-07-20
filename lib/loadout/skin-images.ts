import skinImageData from "@/lib/loadout/skin-images.json";

const images = skinImageData.images as Record<string, string>;
const agentImages = skinImageData.agents as Record<string, string>;

/**
 * Resolve a preview URL by weapon display name + skin name
 * (`"Glock-18|Candy Apple"`). Returns undefined when unknown — never
 * substitutes another skin's art (e.g. weapon `__default`).
 */
export function resolveSkinImage(
  weapon: string,
  skinName?: string | null,
): string | undefined {
  if (!weapon || !skinName) return undefined;
  return images[`${weapon}|${skinName}`];
}

export function resolveAgentImage(name: string): string | undefined {
  return agentImages[name];
}
