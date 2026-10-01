import { Gamepad2 } from "lucide-react";
import Image from "next/image";

import { ServerConnectButton } from "@/components/profile/server-connect-button";
import {
  formatMapName,
  formatServerLocation,
  knownMapImage,
  retakeTypeLabel,
} from "@/components/profile/server-display";
import type { ServerSummary } from "@/lib/servers/types";
import type { CurrentServerInfo } from "@/types/profile";
import type { ProfileServerMeta } from "@/types/profile-dashboard";

type CurrentServerCardProps = {
  server: CurrentServerInfo | null;
  serverMeta: ProfileServerMeta[];
  liveServers: ServerSummary[];
};

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="animate-ping-pulse absolute inline-flex size-full rounded-full text-emerald-400" />
        <span className="relative size-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}

function MapThumb({ map }: { map: string | null }) {
  const src = knownMapImage(map);
  const label = formatMapName(map);

  return (
    <div className="border-border bg-secondary relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-md border">
      {src ? (
        <Image src={src} alt="" fill sizes="72px" className="object-cover" />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center px-1 text-center text-[0.65rem] leading-tight">
          {label ?? "—"}
        </span>
      )}
    </div>
  );
}

export function CurrentServerCard({
  server,
  serverMeta,
  liveServers,
}: CurrentServerCardProps) {
  const live = server
    ? (liveServers.find((entry) => entry.id === server.serverId) ?? null)
    : null;
  const meta = server
    ? (serverMeta.find((entry) => entry.id === server.serverId) ?? null)
    : null;

  const map = live?.map ?? server?.map ?? null;
  const players = live?.players ?? server?.players ?? null;
  const maxPlayers = live?.maxPlayers ?? server?.maxPlayers ?? null;
  const location = formatServerLocation({
    city: live?.city ?? meta?.city,
    region: live?.region ?? meta?.region,
  });
  const modeLabel = retakeTypeLabel(live?.mode ?? meta?.mode);
  const mapLabel = formatMapName(map);
  const detail = [mapLabel, modeLabel].filter(Boolean).join(" · ");
  const playerLine =
    players == null && maxPlayers == null
      ? null
      : `${players ?? "—"} / ${maxPlayers ?? "—"} players`;

  return (
    <section className="border-border bg-card flex h-full flex-col rounded-xl border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="text-muted-foreground size-4" aria-hidden />
          <h2 className="font-heading text-sm font-semibold">Current Server</h2>
        </div>
        {server ? <LivePill /> : null}
      </div>

      {server ? (
        <div className="mt-4 flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <MapThumb map={map} />
            <div className="min-w-0">
              <p className="truncate font-semibold" title={server.serverName}>
                {server.serverName}
              </p>
              {location ? (
                <p className="text-muted-foreground truncate text-sm">{location}</p>
              ) : null}
              {playerLine ? (
                <p className="text-foreground/90 mt-1 text-sm tabular-nums">
                  {playerLine}
                </p>
              ) : null}
              {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
            </div>
          </div>
          <ServerConnectButton
            href={server.connectUrl}
            online
            serverName={server.serverName}
            className="w-full sm:w-auto"
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
          <p className="text-sm font-medium">Not playing right now</p>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            Join a WallBang retake server to start playing.
          </p>
        </div>
      )}
    </section>
  );
}
