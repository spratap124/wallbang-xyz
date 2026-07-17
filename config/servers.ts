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
  pingMs: number;
  status: "live" | "offline" | "maintenance";
};

export const servers: GameServer[] = [
  {
    id: "retake-1",
    name: "[WallBang] Retake #1 | [Mumbai]",
    shortName: "Retake Mumbai #1",
    mode: "Retakes",
    map: "de_mirage",
    region: "Mumbai, India",
    city: "Mumbai",
    host: "200.97.169.27",
    port: 27015,
    tickRate: 128,
    players: 0,
    maxPlayers: 13,
    pingMs: 12,
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

export function getSteamConnectUrl(server: GameServer): string {
  return `steam://connect/${server.host}:${server.port}`;
}

export function getConnectCommand(server: GameServer): string {
  return `connect ${server.host}:${server.port}`;
}
