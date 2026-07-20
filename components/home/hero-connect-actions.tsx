"use client";

import { MessageCircle, Play } from "lucide-react";

import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
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

/** Play Now, Discord, and console connect — connect target from live fleet. */
export function HeroConnectActions() {
  const { servers: live } = useLiveServers();
  const primary = pickPrimary(live);

  const steamConnect = primary ? `steam://connect/${primary.ip}` : "#";
  const connectCmd = primary ? `connect ${primary.ip}` : "connect …";

  return (
    <>
      <div className="animate-rise mt-8 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row sm:items-center">
        <a
          href={steamConnect}
          className={cn(
            buttonVariants({ size: "lg" }),
            "btn-glow h-11 gap-2 px-6 text-sm",
            !primary && "pointer-events-none opacity-60",
          )}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          Play Now
        </a>
        <a
          href={siteConfig.discordUrl}
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 gap-2 border-transparent bg-[#5865F2] px-6 text-sm text-white transition-colors hover:bg-[#4752c4]",
          )}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Discord
        </a>
      </div>

      <div className="animate-rise mt-5 flex min-w-0 max-w-full items-center gap-1.5 [animation-delay:340ms]">
        <a
          href={steamConnect}
          className="min-w-0 flex-1 overflow-hidden rounded-sm font-mono text-sm text-ellipsis whitespace-nowrap text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {connectCmd}
        </a>
        {primary ? (
          <CopyIpButton address={primary.ip} className="shrink-0" />
        ) : null}
      </div>
      <p className="sr-only">
        Opens Counter-Strike 2 through Steam and connects to a WallBang community
        server.
      </p>
    </>
  );
}
