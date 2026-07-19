"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMapImage, prettyMapName } from "@/config/servers";
import type { ServerSummary } from "@/lib/servers/types";
import { cn } from "@/lib/utils";

const PING_POLL_MS = 10_000;

function pingTone(pingMs: number | null): string {
  if (pingMs === null) return "text-muted-foreground";
  if (pingMs <= 40) return "text-emerald-400";
  if (pingMs <= 90) return "text-amber-400";
  return "text-red-400";
}

export function LiveServers({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  const { servers, hasLoaded, refreshing } = useLiveServers();

  return (
    <section id="servers" className="border-t border-border py-20 sm:py-24">
      <Container>
        {showHeading ? (
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              className="mb-0"
              eyebrow="Live servers"
              title="Jump into a retake right now"
              description="Click connect to open Counter-Strike 2 through Steam and join automatically. Status refreshes every 10 seconds."
            />
            <LiveIndicator hasLoaded={hasLoaded} refreshing={refreshing} />
          </div>
        ) : (
          <div className="mb-6 flex justify-end">
            <LiveIndicator hasLoaded={hasLoaded} refreshing={refreshing} />
          </div>
        )}

        <ul className="grid max-w-full gap-4 overflow-x-hidden">
          {servers.map((server) => (
            <ServerRow key={server.id} server={server} />
          ))}
        </ul>
      </Container>
    </section>
  );
}

function LiveIndicator({
  hasLoaded,
  refreshing,
}: {
  hasLoaded: boolean;
  refreshing: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw
        className={cn("size-3.5", refreshing && "animate-spin")}
        aria-hidden
      />
      {hasLoaded ? "Live" : "Connecting…"}
    </span>
  );
}

function ServerRow({ server }: { server: ServerSummary }) {
  const steamConnect = `steam://connect/${server.ip}`;
  const mapName = server.map ?? "";
  const players = server.players ?? 0;
  const maxPlayers = server.maxPlayers;

  return (
    <li className="flex w-full max-w-full flex-col gap-5 overflow-hidden rounded-xl border border-border bg-card/50 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="relative hidden aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-border sm:block">
          <Image
            src={getMapImage(mapName)}
            alt={prettyMapName(mapName)}
            fill
            sizes="112px"
            className="object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[0.7rem] font-medium text-white">
            {prettyMapName(mapName)}
          </span>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <h3 className="min-w-0 flex-1 overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap sm:text-lg">
              {server.name}
            </h3>
            <StatusBadge online={server.online} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {server.mode} · {server.region}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="font-medium">Map</span>
              <span className="text-muted-foreground sm:hidden">
                {prettyMapName(mapName)}
              </span>
            </span>

            <span className="inline-flex items-center gap-2">
              <span className="font-medium tabular-nums">
                {players}
                <span className="text-muted-foreground">
                  {" "}
                  / {maxPlayers ?? "—"}
                </span>
              </span>
            </span>

            {/* Ping column — renders only once a client-side probe URL exists. */}
            {server.pingUrl ? <PingCell url={server.pingUrl} /> : null}
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-1.5">
            <a
              href={steamConnect}
              className="min-w-0 flex-1 overflow-hidden font-mono text-sm text-ellipsis whitespace-nowrap text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              connect {server.ip}
            </a>
            <CopyIpButton address={server.ip} className="shrink-0" />
          </div>
        </div>
      </div>

      <a
        href={steamConnect}
        className={cn(
          buttonVariants({ size: "lg" }),
          "w-full shrink-0 justify-center sm:w-auto",
        )}
      >
        Connect in CS2
      </a>
    </li>
  );
}

/**
 * Real client-side ping: times a lightweight request to the server's HTTPS
 * probe endpoint from the user's browser. Only mounts when `pingUrl` is set,
 * so it's inert until the VPS exposes `/ping`.
 */
function PingCell({ url }: { url: string }) {
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function probe() {
      const t0 = performance.now();
      try {
        await fetch(url, { mode: "no-cors", cache: "no-store" });
        if (active) setPingMs(Math.round(performance.now() - t0));
      } catch {
        if (active) setPingMs(null);
      }
    }

    probe();
    const id = window.setInterval(probe, PING_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [url]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        pingTone(pingMs),
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          pingMs === null && "opacity-40",
        )}
        aria-hidden
      />
      {pingMs === null ? "—" : `${pingMs} ms`}
    </span>
  );
}

function StatusBadge({ online }: { online: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 gap-1.5",
        online
          ? "border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-emerald-400" : "bg-muted-foreground",
        )}
        aria-hidden
      />
      {online ? "Online" : "Offline"}
    </Badge>
  );
}
