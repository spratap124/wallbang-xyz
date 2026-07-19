"use client";

import Image from "next/image";
import { MapPin, Play, Users } from "lucide-react";

import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  getMapImage,
  prettyMapName,
  servers as serverDefs,
} from "@/config/servers";
import { cn } from "@/lib/utils";

// Static presentation bits (name, city, mode) come from config; live counts,
// map, and online state come from the shared /api/servers poll.
const def = serverDefs[0];

export function LiveServerCard() {
  const { servers } = useLiveServers();
  const server =
    servers.find((s) => s.id === def.id) ?? servers[0] ?? {
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
    };

  const mapName = server.map ?? def.map;
  const players = server.players ?? 0;
  const online = server.online;
  const steamConnect = `steam://connect/${server.ip}`;

  return (
    <div className="animate-float relative mx-auto w-full max-w-sm">
      {/* Glow stays inside the card bounds so it can't force horizontal scroll */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl bg-primary/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-2xl backdrop-blur-xl">
        {/* Map banner */}
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

        {/* Body */}
        <div className="p-5">
          <h3 className="text-lg font-semibold text-foreground">
            {def.shortName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {def.mode} · {def.city}, India
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ServerStat
              icon={Users}
              value={`${players}/${server.maxPlayers ?? "—"}`}
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
              connect {server.ip}
            </a>
            <CopyIpButton address={server.ip} />
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
