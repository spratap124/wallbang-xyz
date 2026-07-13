export type GameServer = {
  id: string;
  name: string;
  mode: string;
  region: string;
  host: string;
  port: number;
  status: "live" | "offline" | "maintenance";
};

export const servers: GameServer[] = [
  {
    id: "retake-1",
    name: "[WallBang] Retake #1 !ws !knife !gloves | [Mumbai]",
    mode: "Retakes",
    region: "Mumbai, India",
    host: "200.97.169.27",
    port: 27015,
    status: "live",
  },
];

export function getSteamConnectUrl(server: GameServer): string {
  return `steam://connect/${server.host}:${server.port}`;
}

export function getConnectCommand(server: GameServer): string {
  return `connect ${server.host}:${server.port}`;
}
