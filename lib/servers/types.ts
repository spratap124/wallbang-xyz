/**
 * Shared response contract for the public server list.
 *
 * This shape is the stable boundary between the frontend and whatever data
 * source powers `/api/servers` (today: backend A2S polling; later: heartbeat
 * push). Keep it additive — new fields are fine, renames are breaking.
 */
export interface ServerSummary {
  id: string;
  /** Live A2S hostname when online, otherwise the static config label. */
  name: string;
  shortName?: string;
  city?: string;
  /** Public connect address, `host:port`. */
  ip: string;
  region: string;
  mode: string;
  online: boolean;
  map: string | null;
  players: number | null;
  maxPlayers: number | null;
  /** Client-side ping probe target (HTTPS). null until wired up. */
  pingUrl: string | null;
  /** ISO timestamp of the last successful poll, or null if never seen. */
  lastSeen: string | null;
  /** Hero / Play Now preference from the fleet registry. */
  featured?: boolean;
  /**
   * Diagnostic only: A2S round-trip latency measured from the function region
   * (Vercel → VPS). This is NOT the user's ping — never render it as "ping".
   */
  backendPingMs?: number | null;
}

/** @deprecated Use {@link ServerSummary}. Kept as an alias for older imports. */
export type LiveServer = ServerSummary;

export type ServersResponse = {
  servers: ServerSummary[];
  count: number;
};
