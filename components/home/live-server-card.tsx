"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Play, Users } from "lucide-react";

import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { buttonVariants } from "@/components/ui/button";
import { getMapImage, prettyMapName } from "@/config/servers";
import { cn } from "@/lib/utils";
import type { ServerSummary } from "@/lib/servers/types";

function pickPrimary(live: ServerSummary[]): ServerSummary | null {
  if (live.length === 0) return null;
  const featured = live.find((s) => s.featured) ?? live[0]!;
  if (featured.online) return featured;
  const online = [...live]
    .filter((s) => s.online)
    .sort((a, b) => (b.players ?? 0) - (a.players ?? 0));
  return online[0] ?? featured;
}

type LiveServerCardProps = {
  /** Prefer this registry id when present in the live list. */
  serverId?: string;
};

export function LiveServerCard({ serverId }: LiveServerCardProps) {
  const { servers } = useLiveServers();
  const preferred =
    (serverId ? servers.find((s) => s.id === serverId) : null) ??
    pickPrimary(servers);

  if (!preferred) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/80 bg-card/80 p-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
        Loading servers…
      </div>
    );
  }

  const mapName = preferred.map ?? "de_mirage";
  const players = preferred.players ?? 0;
  const online = preferred.online;
  const steamConnect = `steam://connect/${preferred.ip}`;
  const showFleetLink = servers.length > 1;
  const title = preferred.shortName ?? preferred.name;
  const city = preferred.city;

  return (
    <div className="animate-float relative mx-auto w-full max-w-sm">
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl bg-primary/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-2xl backdrop-blur-xl">
        <div className="relative h-32 overflow-hidden">
          <Image
            src={getMapImage(mapName)}
            alt={`${prettyMapName(mapName)} preview`}
            fill
            sizes="384px"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <div
            className={cn(
              "absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border bg-black/50 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase backdrop-blur-sm",
              online
                ? "border-emerald-500/30 text-emerald-400"
                : "border-border/50 text-muted-foreground",
            )}
          >
            <span className="relative flex size-2">
              {online ? (
                <span className="animate-ping-pulse absolute inline-flex size-full rounded-full text-emerald-400" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  online ? "bg-emerald-400" : "bg-muted-foreground",
                )}
              />
            </span>
            {online ? "Live" : "Offline"}
          </div>
          <p className="absolute bottom-3 left-4 font-mono text-sm text-foreground/90">
            {prettyMapName(mapName)}
          </p>
        </div>

        <div className="p-5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {preferred.mode}
            {city ? ` · ${city}, India` : ` · ${preferred.region}`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ServerStat
              icon={Users}
              value={`${players}/${preferred.maxPlayers ?? "—"}`}
              label="Players"
            />
            <ServerStat
              icon={MapPin}
              value={prettyMapName(mapName)}
              label="Map"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {["!skins", "!knife", "!gloves"].map((cmd) => (
              <span
                key={cmd}
                className="rounded-md bg-secondary px-2 py-1 font-mono text-[0.7rem] text-muted-foreground"
              >
                {cmd}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-1.5">
            <a
              href={steamConnect}
              className="min-w-0 flex-1 truncate rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              connect {preferred.ip}
            </a>
            <CopyIpButton address={preferred.ip} />
          </div>

          <a
            href={steamConnect}
            className={cn(
              buttonVariants({ size: "lg" }),
              "btn-glow mt-3 h-11 w-full gap-2 text-sm",
            )}
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            Connect
          </a>

          {showFleetLink ? (
            <Link
              href="/servers"
              className="mt-3 block text-center text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              View all servers
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ServerStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 text-center">
      <Icon className="mx-auto size-4 text-primary" aria-hidden="true" />
      <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
      <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}
