"use client";

import { useLiveServers } from "@/components/servers/live-servers-provider";

/** Fleet-wide live counts for the hero social-proof strip. */
export function HeroFleetStats() {
  const { servers: live } = useLiveServers();

  const onlineServers = live.filter((s) => s.online).length;
  const playersOnline = live.reduce(
    (sum, s) => sum + (s.online ? (s.players ?? 0) : 0),
    0,
  );
  const configured = Math.max(live.length, 1);
  const serverLabel = configured === 1 ? "Live Server" : "Live Servers";

  const stats = [
    { value: String(onlineServers), label: serverLabel },
    { value: String(playersOnline), label: "Players Online" },
    { value: "India", label: "Primary Region" },
    { value: "99.9%", label: "Uptime" },
  ];

  return (
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
  );
}
