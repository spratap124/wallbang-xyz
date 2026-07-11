"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ServerLatencyProps = {
  probeUrl?: string;
};

type LatencyState =
  | { status: "loading" }
  | { status: "ready"; latencyMs: number }
  | { status: "error"; message: string };

function latencyTone(latencyMs: number): string {
  if (latencyMs < 60) return "text-emerald-400";
  if (latencyMs < 120) return "text-amber-400";
  return "text-red-400";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Measures RTT from the visitor's browser to a probe on the game VPS.
 * This is the only accurate "ping from my location" approach on the web.
 */
async function measureClientLatency(probeUrl: string): Promise<number> {
  const samples: number[] = [];

  for (let i = 0; i < 3; i += 1) {
    const url = new URL(probeUrl);
    url.searchParams.set("t", `${Date.now()}-${i}`);

    const start = performance.now();
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Probe HTTP ${response.status}`);
    }

    await response.arrayBuffer();
    samples.push(performance.now() - start);
  }

  return Math.max(1, Math.round(median(samples)));
}

export function ServerLatency({ probeUrl }: ServerLatencyProps) {
  const [state, setState] = useState<LatencyState>({ status: "loading" });

  useEffect(() => {
    if (!probeUrl) {
      setState({
        status: "error",
        message: "Probe not configured",
      });
      return;
    }

    const controller = new AbortController();

    async function run() {
      try {
        const latencyMs = await measureClientLatency(probeUrl!);
        if (!controller.signal.aborted) {
          setState({ status: "ready", latencyMs });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: "Ping unavailable",
          });
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [probeUrl]);

  if (state.status === "loading") {
    return (
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Measuring ping…
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span
        className="text-sm text-muted-foreground"
        title="Run the VPS latency probe and set NEXT_PUBLIC_LATENCY_PROBE_URL"
      >
        {state.message}
      </span>
    );
  }

  return (
    <span
      className={cn("text-sm font-medium tabular-nums", latencyTone(state.latencyMs))}
      title="Round-trip from your device to the Hyderabad game server"
      aria-label={`Latency ${state.latencyMs} milliseconds`}
    >
      {state.latencyMs} ms
    </span>
  );
}
