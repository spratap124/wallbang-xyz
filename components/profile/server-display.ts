import { mapImages, prettyMapName } from "@/config/servers";
import type { ServerSummary } from "@/lib/servers/types";

export function formatServerLocation(input: {
  city?: string | null;
  region?: string | null;
}): string | null {
  const city = input.city?.trim() ?? "";
  const region = input.region?.trim() ?? "";
  if (region && city && !region.toLowerCase().includes(city.toLowerCase())) {
    return `${region} (${city})`;
  }
  return region || city || null;
}

/** Map art only when this map has a real image. Never substitutes another map. */
export function knownMapImage(map: string | null | undefined): string | null {
  if (!map) return null;
  return mapImages[map] ?? mapImages[map.toLowerCase()] ?? null;
}

export function formatMapName(map: string | null | undefined): string | null {
  const value = map?.trim();
  if (!value) return null;
  return prettyMapName(value);
}

/** "Retakes" is the fleet mode. Other modes keep their own label. */
export function retakeTypeLabel(mode: string | null | undefined): string | null {
  const value = mode?.trim();
  if (!value) return null;
  return /retake/i.test(value) ? "Retake" : value;
}

/**
 * A retake server is a fleet instance whose mode is retake.
 * Map names are never used as server identity. If the registry does not label
 * any row as retake, the real fleet is shown unchanged.
 */
export function selectRetakeServers(servers: ServerSummary[]): ServerSummary[] {
  const retake = servers.filter((server) => /retake/i.test(server.mode));
  return retake.length > 0 ? retake : servers;
}

export function playerFillPercent(
  players: number | null,
  maxPlayers: number | null,
): number {
  if (players == null || maxPlayers == null || maxPlayers <= 0) return 0;
  return Math.min(100, Math.max(0, (players / maxPlayers) * 100));
}
