import Image from "next/image";
import {
  MapPin,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Sword,
} from "lucide-react";

import { CopyIpButton } from "@/components/servers/copy-ip-button";
import { LiveServerCard } from "@/components/home/live-server-card";
import { BrandMark } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import {
  getConnectCommand,
  getMapImage,
  getSteamConnectUrl,
  servers,
} from "@/config/servers";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const primaryServer = servers[0];

const featurePills = [
  { icon: Sparkles, label: "Instant Skin Changer" },
  { icon: Sword, label: "Knife & Gloves" },
  { icon: ShieldCheck, label: "No Pay-to-Win" },
  { icon: MapPin, label: "India Hosted" },
];

const stats = [
  { value: "1", label: "Live Server" },
  { value: `${primaryServer.players}`, label: "Players Online" },
  { value: `${primaryServer.pingMs} ms`, label: "Average Ping" },
  { value: "99.9%", label: "Uptime" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Cinematic CS2 backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src={getMapImage(primaryServer.map)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover object-center blur-[2px]"
        />
        {/* Dark readability overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,16,0.6)_0%,rgba(11,13,16,0.74)_55%,rgba(11,13,16,0.94)_100%)]" />
        {/* Extra left-side darkening keeps headline copy crisp over the art */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,13,16,0.72)_0%,rgba(11,13,16,0.28)_45%,transparent_70%)]" />
        {/* Drifting red glow */}
        <div className="animate-gradient-pan absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_75%_0%,rgba(232,36,42,0.22),transparent_55%),radial-gradient(ellipse_60%_50%_at_10%_100%,rgba(232,36,42,0.1),transparent_50%)]" />
        {/* Subtle cyber grid on top */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,#000,transparent)]" />
      </div>

      <div className="container-wb relative grid min-h-[calc(100svh-4rem)] items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-24">
        {/* Left — copy + CTAs */}
        <div className="max-w-2xl overflow-visible">
          <p className="animate-rise mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-primary uppercase [animation-delay:40ms]">
            <span className="relative flex size-2 text-emerald-400">
              <span className="animate-ping-pulse absolute inline-flex size-full rounded-full" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            CS2 · India first · Live now
          </p>

          <BrandMark
            as="h1"
            className="animate-rise text-5xl [animation-delay:80ms] sm:text-6xl lg:text-7xl"
          />
          <p className="animate-rise mt-5 max-w-xl text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl [animation-delay:140ms]">
            India&apos;s Next-Generation Counter-Strike 2 Community Servers
          </p>
          <p className="animate-rise mt-4 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty [animation-delay:200ms]">
            Instant skins, knives, gloves, fast Mumbai hosting, and a competitive experience built
            for serious players.
          </p>

          {/* Feature pills */}
          <ul className="animate-rise mt-7 flex flex-wrap gap-2 [animation-delay:240ms]">
            {featurePills.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-sm"
              >
                <Icon className="size-3.5 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="animate-rise mt-8 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row sm:items-center">
            <a
              href={getSteamConnectUrl(primaryServer)}
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-glow h-11 gap-2 px-6 text-sm",
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

          {/* Console connect line */}
          <div className="animate-rise mt-5 flex items-center gap-1.5 [animation-delay:340ms]">
            <a
              href={getSteamConnectUrl(primaryServer)}
              className="rounded-sm font-mono text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {getConnectCommand(primaryServer)}
            </a>
            <CopyIpButton server={primaryServer} />
          </div>
          <p className="sr-only">
            Opens Counter-Strike 2 through Steam and connects to the WallBang retake server.
          </p>

          {/* Social proof */}
          <dl className="animate-rise mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 border-t border-border/60 pt-8 sm:grid-cols-4 [animation-delay:380ms]">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </dl>
        </div>

        {/* Right — live server card */}
        <div className="animate-rise justify-self-center lg:justify-self-end [animation-delay:180ms]">
          <LiveServerCard />
        </div>
      </div>
    </section>
  );
}
