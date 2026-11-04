"use client";

import Link from "next/link";
import {
  Activity,
  Clock3,
  Copy,
  ExternalLink,
  Gamepad2,
  Globe2,
  RefreshCw,
  Server,
  Users,
  Wifi,
} from "lucide-react";

import { useLiveServers } from "@/components/servers/live-servers-provider";
import { Container } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import { getMapImage, prettyMapName } from "@/config/servers";
import type { ServerSummary } from "@/lib/servers/types";
import { cn } from "@/lib/utils";

export function DedicatedServersPage() {
  return (
    <LiveServersPageContent />
  );
}

function LiveServersPageContent() {
  const { servers, hasLoaded, refreshing } = useLiveServers();
  const online = servers.filter((server) => server.online);
  const players = online.reduce((total, server) => total + (server.players ?? 0), 0);
  const slots = online.reduce((total, server) => total + (server.maxPlayers ?? 0), 0);

  return (
    <div className="pb-20 sm:pb-28">
      <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_50%_-20%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%)] py-3 sm:py-4">
        <Container className="relative text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium tracking-[0.16em] text-primary uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              India-hosted CS2 community
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-3xl">
              Find your next server.
            </h1>
            <p className="mx-auto mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Browse live WallBang Counter-Strike 2 servers, see what is being played,
              and jump in with one click.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <a href="#server-list" className={buttonVariants({ size: "lg" })}>
                <Gamepad2 aria-hidden />
                Browse servers
              </a>
              <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <span aria-hidden>★</span>
                View VIP access
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-3 grid max-w-3xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/60 py-2 backdrop-blur sm:mt-4 sm:py-2.5">
            <Stat icon={Server} value={hasLoaded ? `${online.length} / ${servers.length}` : "—"} label="online" />
            <Stat icon={Users} value={hasLoaded ? String(players) : "—"} label="players" />
            <Stat icon={Activity} value={hasLoaded ? String(slots) : "—"} label="slots" />
          </div>
        </Container>
      </section>

      <section id="server-list" className="scroll-mt-20 pt-12 sm:pt-16">
        <Container>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium tracking-[0.18em] text-primary uppercase">Server browser</p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">CS2 servers</h2>
              <p className="mt-2 text-sm text-muted-foreground">Live player counts, maps, and connection details.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
              {hasLoaded ? "Updates every 10 seconds" : "Connecting to fleet…"}
            </div>
          </div>

          {servers.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {servers.map((server) => <ServerBrowserCard key={server.id} server={server} />)}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
              Server status is loading. Check back in a moment.
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Server; value: string; label: string }) {
  return <div className="flex flex-col items-center gap-1"><Icon className="mb-1 size-4 text-primary" aria-hidden /><strong className="text-xl tabular-nums sm:text-2xl">{value}</strong><span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{label}</span></div>;
}

function ServerBrowserCard({ server }: { server: ServerSummary }) {
  const players = server.players ?? 0;
  const maxPlayers = server.maxPlayers ?? 0;
  const percentage = maxPlayers > 0 ? Math.min(100, Math.round((players / maxPlayers) * 100)) : 0;
  const map = server.map ?? "";
  const address = server.ip;

  return (
    <li className={cn("group relative overflow-hidden rounded-2xl border bg-card/70 p-5 transition-colors hover:border-primary/50", server.online ? "border-border" : "border-border/60 opacity-80")}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]" style={{ backgroundImage: `url(${getMapImage(map)})`, backgroundPosition: "center", backgroundSize: "cover" }} />
      <div className={cn("absolute inset-y-0 left-0 w-1", server.online ? "bg-emerald-400" : "bg-muted-foreground/40")} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">CS2</span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", server.online ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border bg-muted text-muted-foreground")}><span className={cn("size-1.5 rounded-full", server.online ? "bg-emerald-400" : "bg-muted-foreground")} />{server.online ? "Online" : "Offline"}</span>
        </div>
        <h3 className="mt-5 min-h-12 text-base font-semibold leading-snug">{server.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Globe2 className="size-3" aria-hidden />{address}</p>
        <div className="mt-4 rounded-xl border border-border/80 bg-background/60 p-3"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">MAP</span><span className="font-medium">{prettyMapName(map)}</span></div></div>
        <div className="mt-2 rounded-xl border border-border/80 bg-background/60 p-3"><div className="flex items-center justify-between text-xs"><span><strong>{players}</strong><span className="text-muted-foreground"> / {maxPlayers || "—"}</span></span><span className="text-muted-foreground">players</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", percentage > 80 ? "bg-amber-400" : "bg-primary")} style={{ width: `${percentage}%` }} /></div></div>
        <div className="mt-4 flex items-center gap-2"><a href={`steam://connect/${address}`} className={cn(buttonVariants({ size: "lg" }), "min-w-0 flex-1")}><Wifi aria-hidden />Connect</a><CopyButton address={address} /><a href={`steam://connect/${address}`} aria-label={`Connect to ${server.name}`} className={buttonVariants({ variant: "outline", size: "icon-lg" })}><ExternalLink aria-hidden /></a></div>
        <div className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground"><Clock3 className="size-3" aria-hidden />Live status · refreshes automatically</div>
      </div>
    </li>
  );
}

function CopyButton({ address }: { address: string }) {
  const copy = async () => { await navigator.clipboard?.writeText(address); };
  return <button type="button" onClick={copy} aria-label="Copy server address" className={buttonVariants({ variant: "outline", size: "icon-lg" })}><Copy aria-hidden /></button>;
}
