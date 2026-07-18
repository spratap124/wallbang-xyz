"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { servers as serverDefs } from "@/config/servers";
import { fetchServers } from "@/lib/api/servers";
import type { ServerSummary } from "@/lib/servers/types";

const POLL_MS = 10_000;

const initialServers: ServerSummary[] = serverDefs.map((def) => ({
  id: def.id,
  name: def.name,
  ip: `${def.host}:${def.port}`,
  region: def.region,
  mode: def.mode,
  online: false,
  map: def.map,
  players: null,
  maxPlayers: def.maxPlayersOverride ?? def.maxPlayers,
  pingUrl: def.pingUrl ?? null,
  lastSeen: null,
}));

type LiveServersContextValue = {
  servers: ServerSummary[];
  hasLoaded: boolean;
  refreshing: boolean;
};

const LiveServersContext = createContext<LiveServersContextValue | null>(null);

/**
 * Single /api/servers poll shared by the hero card and servers list so the
 * homepage does not fire duplicate requests on every tick.
 */
export function LiveServersProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<ServerSummary[]>(initialServers);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function load() {
      setRefreshing(true);
      try {
        const data = await fetchServers(controller.signal);
        if (!mounted.current) return;
        setServers(data.servers);
        setHasLoaded(true);
      } catch {
        // Keep the last-known list on a transient failure.
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    }

    load();
    const poll = window.setInterval(load, POLL_MS);

    return () => {
      mounted.current = false;
      controller.abort();
      window.clearInterval(poll);
    };
  }, []);

  const value = useMemo(
    () => ({ servers, hasLoaded, refreshing }),
    [servers, hasLoaded, refreshing],
  );

  return (
    <LiveServersContext.Provider value={value}>
      {children}
    </LiveServersContext.Provider>
  );
}

export function useLiveServers(): LiveServersContextValue {
  const ctx = useContext(LiveServersContext);
  if (!ctx) {
    throw new Error("useLiveServers must be used within LiveServersProvider");
  }
  return ctx;
}
