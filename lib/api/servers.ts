import type { ServersResponse } from "@/lib/servers/types";

/**
 * Client boundary for the public server list. The frontend only depends on the
 * `ServersResponse` contract, so the backend data source can change (A2S poll
 * today, heartbeat push later) without touching UI code.
 */
export async function fetchServers(signal?: AbortSignal): Promise<ServersResponse> {
  const response = await fetch("/api/servers", {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load servers (${response.status})`);
  }

  return (await response.json()) as ServersResponse;
}
