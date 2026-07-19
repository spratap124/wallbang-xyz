import skinImageData from "@/lib/loadout/skin-images.json";

const images = skinImageData.images as Record<string, string>;
const agentImages = skinImageData.agents as Record<string, string>;

export function resolveSkinImage(
  weapon: string,
  skinName?: string | null,
): string | undefined {
  if (skinName) {
    const direct = images[`${weapon}|${skinName}`];
    if (direct) return direct;
  }
  return images[`${weapon}|__default`] ?? images[`${weapon}|Vanilla`];
}

export function resolveAgentImage(name: string): string | undefined {
  return agentImages[name];
}
