export type GameServer = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  map: string;
  region: string;
  city: string;
  host: string;
  port: number;
  tickRate: number;
  players: number;
  maxPlayers: number;
  /** A2S reports the raw slot count (e.g. 64). Override to the real game cap. */
  maxPlayersOverride?: number;
  pingMs: number;
  /** Client-side ping probe target (HTTPS). null until the VPS exposes one. */
  pingUrl?: string | null;
  status: "live" | "offline" | "maintenance";
};

/**
 * Retake #1 host is environment-driven:
 *   - production build (`next build` / Vercel) → prod game server
 *   - local dev (`next dev`) → staging server
 * NODE_ENV is inlined by Next.js in both server and client bundles, so the
 * API response, connect links, and initial seed all stay consistent.
 * Optionally override with NEXT_PUBLIC_RETAKE_HOST (e.g. to point dev at prod).
 * It must be NEXT_PUBLIC_ so the client seed and server API resolve the same
 * host; the IP is public anyway (it's in the CS2 server browser).
 */
const RETAKE_HOST =
  process.env.NEXT_PUBLIC_RETAKE_HOST ??
  (process.env.NODE_ENV === "production"
    ? "200.97.169.27" // prod game server
    : "129.159.232.212"); // staging server

export const servers: GameServer[] = [
  {
    id: "retake-1",
    name: "[WallBang] Retake #1 | [Mumbai]",
    shortName: "Retake Mumbai #1",
    mode: "Retakes",
    map: "de_mirage",
    region: "Mumbai, India",
    city: "Mumbai",
    host: RETAKE_HOST,
    port: 27015,
    tickRate: 128,
    players: 0,
    maxPlayers: 10,
    maxPlayersOverride: 10,
    pingMs: 12,
    pingUrl: null,
    status: "live",
  },
];

export const mapImages: Record<string, string> = {
  de_mirage: "/maps/de_mirage.png",
  de_cache: "/maps/de_cache.png",
  de_dust2: "/maps/de_dust2.png",
  de_inferno: "/maps/de_inferno.png",
  de_nuke: "/maps/de_nuke.png",
  de_anubis: "/maps/de_anubis.png",
  de_ancient: "/maps/de_ancient.png",
};

export function getMapImage(map: string): string {
  return mapImages[map] ?? "/maps/de_mirage.png";
}

/** `host:port` connect address used across the UI and API contract. */
export function getServerAddress(server: Pick<GameServer, "host" | "port">): string {
  return `${server.host}:${server.port}`;
}

/** `de_mirage` -> `Mirage` for display. Falls back to the raw value. */
export function prettyMapName(map: string): string {
  if (!map) return "Unknown";
  const stripped = map.replace(/^(de|cs|aim|ar|dz|gd)_/i, "");
  return stripped
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSteamConnectUrl(server: GameServer): string {
  return `steam://connect/${server.host}:${server.port}`;
}

export function getConnectCommand(server: GameServer): string {
  return `connect ${server.host}:${server.port}`;
}
