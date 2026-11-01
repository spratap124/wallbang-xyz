import Image from "next/image";
import { MapPin, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import { HeroConnectActions } from "@/components/home/hero-connect-actions";
import { HeroFleetStats } from "@/components/home/hero-fleet-stats";
import { LiveServerCard } from "@/components/home/live-server-card";
import { BrandLogo, BrandMark } from "@/components/shared/primitives";
import { getMapImage } from "@/config/servers";
import { notAGameStore } from "@/content/business";
import { getFeaturedRegisteredServer } from "@/lib/servers/registry";

const featurePills = [
  { icon: Sparkles, label: "Community Retakes" },
  { icon: ShieldCheck, label: "DDoS Protected" },
  { icon: RefreshCw, label: "Automatic CS2 Updates" },
  { icon: MapPin, label: "Mumbai Hosted" },
];

export async function HeroSection() {
  const featured = await getFeaturedRegisteredServer();
  const backdropMap = featured?.map ?? "de_mirage";

  return (
    <section className="border-border relative overflow-hidden border-b">
      {/* Cinematic CS2 backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src={getMapImage(backdropMap)}
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
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,#000,transparent)] [background-size:72px_72px] opacity-[0.06]" />
      </div>

      <div className="container-wb relative grid min-h-[calc(100svh-4rem)] items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-24">
        {/* Left — copy + CTAs */}
        <div className="max-w-2xl overflow-visible">
          <p className="animate-rise border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase [animation-delay:40ms]">
            <span className="relative flex size-2 text-emerald-400">
              <span className="animate-ping-pulse absolute inline-flex size-full rounded-full" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            CS2 community servers · India · Live now
          </p>

          <BrandLogo
            alt=""
            className="animate-rise mb-5 size-16 [animation-delay:80ms] sm:size-20"
            priority
          />
          <BrandMark
            as="p"
            className="animate-rise text-5xl [animation-delay:110ms] sm:text-6xl lg:text-7xl"
          />
          <h1 className="animate-rise text-foreground mt-5 max-w-xl text-2xl font-semibold tracking-tight text-balance [animation-delay:140ms] sm:text-3xl">
            CS2 Retake Servers in India
          </h1>
          <p className="animate-rise text-muted-foreground mt-4 max-w-xl text-base leading-relaxed text-pretty [animation-delay:200ms]">
            Play CS2 retakes on low-latency Indian servers powered by DDoS-protected
            infrastructure. Our servers automatically update whenever Valve releases a new
            CS2 update, with minimal downtime so you can get back to the action faster.
          </p>
          <p className="animate-rise border-border/70 bg-card/50 text-foreground/90 mt-3 max-w-xl rounded-lg border px-3 py-2.5 text-sm leading-relaxed backdrop-blur-sm [animation-delay:220ms]">
            {notAGameStore}
          </p>

          {/* Feature pills */}
          <ul className="animate-rise mt-7 flex flex-wrap gap-2 [animation-delay:240ms]">
            {featurePills.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="border-border/70 bg-card/60 text-foreground/90 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
              >
                <Icon className="text-primary size-3.5" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <HeroConnectActions />
          <HeroFleetStats />
        </div>

        {/* Right — live server card */}
        <div className="animate-rise max-w-full justify-self-center overflow-x-clip [animation-delay:180ms] lg:justify-self-end">
          <LiveServerCard serverId={featured?.id} />
        </div>
      </div>
    </section>
  );
}
