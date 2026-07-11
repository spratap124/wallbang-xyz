export type GameServer = {
  id: string;
  name: string;
  mode: string;
  region: string;
  host: string;
  port: number;
  status: "live" | "offline" | "maintenance";
  /**
   * HTTPS URL of the colocated latency probe (same VPS as the game server).
   * Measured directly from the visitor's browser → true user-to-server RTT.
   */
  latencyProbeUrl?: string;
};

export const servers: GameServer[] = [
  {
    id: "retake-1",
    name: "[WallBang] Retake #1 [HYD]",
    mode: "Retakes",
    region: "Hyderabad, India",
    host: "129.159.232.212",
    port: 27015,
    status: "live",
    latencyProbeUrl: process.env.NEXT_PUBLIC_LATENCY_PROBE_URL || undefined,
  },
];

export function getSteamConnectUrl(server: GameServer): string {
  return `steam://connect/${server.host}:${server.port}`;
}

export function getConnectCommand(server: GameServer): string {
  return `connect ${server.host}:${server.port}`;
}
