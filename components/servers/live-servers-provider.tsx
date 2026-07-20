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

import { fetchServers } from "@/lib/api/servers";
import type { ServerSummary } from "@/lib/servers/types";

const POLL_MS = 10_000;

type LiveServersContextValue = {
  servers: ServerSummary[];
  hasLoaded: boolean;
  refreshing: boolean;
};

const LiveServersContext = createContext<LiveServersContextValue | null>(null);

/**
 * Single /api/servers poll shared by the hero card and servers list so the
 * homepage does not fire duplicate requests on every tick.
 * Fleet list comes from the API (DB registry) — no static config seed.
 */
export function LiveServersProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<ServerSummary[]>([]);
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
