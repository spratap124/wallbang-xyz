"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ServerLatencyProps = {
  host: string;
  port: number;
};

type LatencyState =
  | { status: "loading" }
  | { status: "ready"; latencyMs: number }
  | { status: "error" };

function latencyTone(latencyMs: number): string {
  if (latencyMs < 60) return "text-emerald-400";
  if (latencyMs < 120) return "text-amber-400";
  return "text-red-400";
}

export function ServerLatency({ host, port }: ServerLatencyProps) {
  const [state, setState] = useState<LatencyState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        const response = await fetch(
          `/api/servers/latency?host=${encodeURIComponent(host)}&port=${port}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = (await response.json()) as
          | { ok: true; latencyMs: number }
          | { ok: false; error: string };

        if (!response.ok || !payload.ok) {
          setState({ status: "error" });
          return;
        }

        setState({ status: "ready", latencyMs: payload.latencyMs });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [host, port]);

  if (state.status === "loading") {
    return (
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Measuring ping…
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span className="text-sm text-muted-foreground" title="Could not measure latency">
        Ping unavailable
      </span>
    );
  }

  return (
    <span
      className={cn("text-sm font-medium tabular-nums", latencyTone(state.latencyMs))}
      aria-label={`Latency ${state.latencyMs} milliseconds`}
    >
      {state.latencyMs} ms
    </span>
  );
}
