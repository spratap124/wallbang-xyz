import Link from "next/link";

import { BrandMark } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import {
  getConnectCommand,
  getSteamConnectUrl,
  servers,
} from "@/config/servers";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const primaryServer = servers[0];

export function HeroSection() {
  return (
    <section className="relative border-b border-border">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_70%_-10%,rgba(232,36,42,0.18),transparent_55%),linear-gradient(180deg,#0b0d10_0%,#12151a_100%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000,transparent)]" />
      </div>

      <div className="container-wb relative grid min-h-[calc(100svh-4rem)] items-center py-20 lg:py-28">
        <div className="max-w-3xl overflow-visible">
          <p className="animate-rise mb-5 text-xs font-medium tracking-[0.22em] text-primary uppercase [animation-delay:40ms]">
            CS2 · India first · Live now
          </p>
          <BrandMark
            as="h1"
            className="animate-rise text-5xl [animation-delay:80ms] sm:text-6xl lg:text-7xl"
          />
          <p className="animate-rise mt-6 max-w-2xl text-xl text-balance text-foreground/90 [animation-delay:140ms] sm:text-2xl">
            {siteConfig.tagline}
          </p>
          <p className="animate-rise mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty [animation-delay:200ms]">
            Low latency retake servers. Powerful player statistics. Competitive matchmaking.
            Community-driven development. Built for serious Counter-Strike 2 players —{" "}
            {primaryServer.name} is live.
          </p>

          <div className="animate-rise mt-9 flex flex-col gap-3 [animation-delay:260ms] sm:flex-row sm:items-center">
            <a
              href={getSteamConnectUrl(primaryServer)}
              className={cn(buttonVariants({ size: "lg" }), "justify-center")}
            >
              Connect in CS2
            </a>
            <a
              href={siteConfig.discordUrl}
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "justify-center",
              )}
            >
              Join Discord
            </a>
          </div>

          <p className="animate-rise mt-5 font-mono text-sm text-muted-foreground [animation-delay:320ms]">
            <a
              href={getSteamConnectUrl(primaryServer)}
              className="rounded-sm text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {getConnectCommand(primaryServer)}
            </a>
          </p>
          <p className="sr-only">
            Opens Counter-Strike 2 through Steam and connects to the WallBang retake server.
          </p>

          <Link
            href="/servers"
            className="animate-rise mt-4 inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [animation-delay:360ms]"
          >
            View live servers
          </Link>
        </div>
      </div>
    </section>
  );
}
