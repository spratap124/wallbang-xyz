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
  /** Hero / Play Now primary when multiple servers exist. */
  featured?: boolean;
};

/** Minimal live row used to pick a connect target from fleet status. */
export type ServerLiveHint = {
  id: string;
  online: boolean;
  players?: number | null;
};

const RETAKE_1_DEFAULT_HOST =
  process.env.NODE_ENV === "production"
    ? "200.97.169.27" // prod game server (Hostinger)
    : "129.159.232.212"; // staging server

/**
 * Resolve a public connect host for a configured server id.
 *
 * Precedence:
 *   1. NEXT_PUBLIC_SERVER_HOST_<ID>  (id uppercased, `-` → `_`)
 *   2. NEXT_PUBLIC_RETAKE_HOST       (legacy alias for `retake-1` only)
 *   3. Built-in prod/staging default for `retake-1`
 *   4. empty string (caller must supply a real host for new servers)
 *
 * NEXT_PUBLIC_ so client seed and server API bake the same host.
 * Empty string is treated as unset (Compose often passes KEY=).
 */
export function resolveServerHost(
  serverId: string,
  fallback = "",
): string {
  const envKey = `NEXT_PUBLIC_SERVER_HOST_${serverId
    .toUpperCase()
    .replace(/-/g, "_")}`;
  const perServer = process.env[envKey]?.trim();
  if (perServer) return perServer;

  if (serverId === "retake-1") {
    const legacy = process.env.NEXT_PUBLIC_RETAKE_HOST?.trim();
    if (legacy) return legacy;
    return RETAKE_1_DEFAULT_HOST;
  }

  return fallback;
}

/**
 * Fleet registry — add a new CS2 box as a new row + matching plugin ServerId.
 * Hosts are env-driven per id so prod/staging can diverge without code edits.
 */
export const servers: GameServer[] = [
  {
    id: "retake-1",
    name: "[WallBang] Retake #1 | [Mumbai]",
    shortName: "Retake Mumbai #1",
    mode: "Retakes",
    map: "de_mirage",
    region: "Mumbai, India",
    city: "Mumbai",
    host: resolveServerHost("retake-1"),
    port: 27015,
    tickRate: 128,
    players: 0,
    maxPlayers: 10,
    maxPlayersOverride: 10,
    pingMs: 12,
    pingUrl: null,
    status: "live",
    featured: true,
  },
];

export function getServerById(id: string): GameServer | undefined {
  return servers.find((s) => s.id === id);
}

/** Featured server for hero CTAs; falls back to the first config entry. */
export function getFeaturedServer(): GameServer {
  return servers.find((s) => s.featured) ?? servers[0]!;
}

/**
 * Best connect target given optional live status:
 * featured if online → else online with most players → else featured/config.
 */
export function getPrimaryConnectServer(
  live: ServerLiveHint[] = [],
): GameServer {
  const featured = getFeaturedServer();
  if (live.length === 0) return featured;

  const liveById = new Map(live.map((s) => [s.id, s]));
  const featuredLive = liveById.get(featured.id);
  if (featuredLive?.online) return featured;

  const online = servers
    .map((def) => ({ def, live: liveById.get(def.id) }))
    .filter((row) => row.live?.online);

  if (online.length === 0) return featured;

  online.sort(
    (a, b) => (b.live?.players ?? 0) - (a.live?.players ?? 0),
  );
  return online[0]!.def;
}

export const mapImages: Record<string, string> = {
  de_mirage: "/maps/de_mirage.png",
  de_cache: "/maps/de_cache.png",
  de_dust2: "/maps/de_dust2.png",
  de_inferno: "/maps/de_inferno.png",
  de_nuke: "/maps/de_nuke.png",
  de_anubis: "/maps/de_anubis.png",
  de_ancient: "/maps/de_ancient.png",
  de_vertigo: "/maps/de_vertigo.png",
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
