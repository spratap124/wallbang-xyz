import { ArrowRight, Server } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ServerConnectButton } from "@/components/profile/server-connect-button";
import {
  formatMapName,
  formatServerLocation,
  knownMapImage,
  playerFillPercent,
  retakeTypeLabel,
  selectRetakeServers,
} from "@/components/profile/server-display";
import { buttonVariants } from "@/components/ui/button";
import type { ServerSummary } from "@/lib/servers/types";
import { cn } from "@/lib/utils";

type RetakeServerListProps = {
  servers: ServerSummary[];
  hasLoaded: boolean;
};

function StatusText({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        online ? "text-emerald-400" : "text-rose-300",
      )}
    >
      <span
        className={cn("size-2 rounded-full", online ? "bg-emerald-400" : "bg-rose-400")}
        aria-hidden
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function MapThumb({ map }: { map: string | null }) {
  const src = knownMapImage(map);
  const label = formatMapName(map);

  return (
    <div className="border-border bg-secondary relative size-11 shrink-0 overflow-hidden rounded-md border">
      {src ? (
        <Image src={src} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center px-1 text-center text-[0.6rem] leading-tight">
          {label ?? "—"}
        </span>
      )}
    </div>
  );
}

function PlayerMeter({
  players,
  maxPlayers,
}: {
  players: number | null;
  maxPlayers: number | null;
}) {
  const width = playerFillPercent(players, maxPlayers);

  return (
    <div className="min-w-[5.5rem]">
      <p className="text-sm tabular-nums">
        <span className="font-medium">{players ?? "—"}</span>
        <span className="text-muted-foreground"> / {maxPlayers ?? "—"}</span>
      </p>
      <div className="bg-muted mt-1.5 h-1 w-full max-w-24 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ServerIdentity({ server }: { server: ServerSummary }) {
  const typeLabel = retakeTypeLabel(server.mode);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MapThumb map={server.map} />
      <div className="min-w-0">
        <p className="line-clamp-2 leading-snug font-semibold" title={server.name}>
          {server.name}
        </p>
        {typeLabel ? <p className="text-muted-foreground text-xs">{typeLabel}</p> : null}
      </div>
    </div>
  );
}

export function RetakeServerList({ servers, hasLoaded }: RetakeServerListProps) {
  const rows = selectRetakeServers(servers);

  return (
    <section className="border-border bg-card rounded-xl border">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="border-border bg-secondary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Server className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Retake Servers</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Jump into any of our CS2 retake servers.
            </p>
          </div>
        </div>
        <Link
          href="/servers"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View All Servers
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>

      {!hasLoaded ? (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
          Loading servers…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm sm:px-5">
          No retake servers are listed right now.
        </p>
      ) : (
        <>
          <ul className="divide-border divide-y lg:hidden">
            {rows.map((server) => {
              const location = formatServerLocation(server);
              const mapName = formatMapName(server.map);

              return (
                <li key={server.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <ServerIdentity server={server} />
                    <StatusText online={server.online} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
                        Location
                      </p>
                      <p className="mt-1 truncate">{location ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
                        Map
                      </p>
                      <p className="mt-1 truncate">{mapName ?? "—"}</p>
                    </div>
                  </div>
                  <PlayerMeter players={server.players} maxPlayers={server.maxPlayers} />
                  <ServerConnectButton
                    href={server.online ? `steam://connect/${server.ip}` : null}
                    online={server.online}
                    serverName={server.name}
                    className="w-full"
                  />
                </li>
              );
            })}
          </ul>

          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
                  <th className="px-5 py-3 font-medium">Server name</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Players</th>
                  <th className="px-3 py-3 font-medium">Map</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((server) => {
                  const location = formatServerLocation(server);
                  const mapName = formatMapName(server.map);

                  return (
                    <tr key={server.id} className="border-border border-t">
                      <td className="overflow-hidden px-5 py-3">
                        <ServerIdentity server={server} />
                      </td>
                      <td className="text-muted-foreground px-3 py-3">
                        <span className="line-clamp-2">{location ?? "—"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <PlayerMeter
                          players={server.players}
                          maxPlayers={server.maxPlayers}
                        />
                      </td>
                      <td className="px-3 py-3">{mapName ?? "—"}</td>
                      <td className="px-3 py-3">
                        <StatusText online={server.online} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ServerConnectButton
                          href={server.online ? `steam://connect/${server.ip}` : null}
                          online={server.online}
                          serverName={server.name}
                          className="ml-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
