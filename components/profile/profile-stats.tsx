import { Activity, Crosshair, Crown, Swords, Target, Trophy, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStatValue } from "@/lib/profile/format";
import type { QuickStats } from "@/types/profile";

type ProfileStatsProps = { stats: QuickStats };

function ratio(value: number, total: number) {
  return total > 0 ? (value / total).toFixed(2) : "—";
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const lossRate = stats.matchesPlayed > 0 ? (stats.losses / stats.matchesPlayed) * 100 : null;
  const winRate = stats.matchesPlayed > 0 ? (stats.wins / stats.matchesPlayed) * 100 : null;
  const roundWinPercent = stats.roundsPlayed ? (stats.roundsWon / stats.roundsPlayed) * 100 : 0;
  const quickItems = [
    { label: "K/D ratio", value: stats.kd === null ? "—" : stats.kd.toFixed(2), icon: Crosshair, accent: "text-red-400", glow: "hover:border-red-500/30" },
    { label: "Win rate", value: winRate === null ? "—" : `${winRate.toFixed(1)}%`, icon: Trophy, accent: "text-amber-300", glow: "hover:border-amber-400/30" },
    { label: "Kills", value: stats.kills.toLocaleString(), icon: Swords, accent: "text-emerald-300", glow: "hover:border-emerald-400/30" },
    { label: "Deaths", value: stats.deaths.toLocaleString(), icon: Target, accent: "text-fuchsia-300", glow: "hover:border-fuchsia-400/30" },
    { label: "Assists", value: stats.assists.toLocaleString(), icon: Crosshair, accent: "text-sky-300", glow: "hover:border-sky-400/30" },
    { label: "Rounds", value: stats.roundsPlayed.toLocaleString(), icon: Swords, accent: "text-slate-200", glow: "hover:border-slate-300/30" },
  ];

  return (
    <Card className="relative border-white/[0.09] bg-gradient-to-br from-card via-card to-red-950/[0.15]">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400"><Activity className="size-5" /></span>
          <div>
            <CardTitle>Performance overview</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Your retake performance at a glance</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3.5">
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,3fr)_minmax(170px,1fr)_minmax(220px,1.4fr)]">
            <section className="relative overflow-hidden rounded-xl border border-red-500/20 bg-gradient-to-r from-red-950/60 via-red-950/20 to-black/20 p-4 sm:p-5">
              <div className="pointer-events-none absolute -right-3 -top-12 h-40 w-56 rounded-full bg-red-600/15 blur-3xl" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(239,68,68,0.14),transparent_70%)]" />
              <div className="relative flex items-center gap-4">
                <div className="hidden size-16 shrink-0 place-items-center rounded-full border border-amber-400/25 bg-amber-300/10 text-amber-300 sm:grid"><Crown className="size-9" /></div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">WallBang rating</p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{stats.rating.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stats.rating === stats.peakRating ? "At your personal best" : "Current career rating"}</p>
                </div>
              </div>
            </section>
            <section className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-gradient-to-br from-secondary/60 to-red-950/20 p-4 sm:flex-col sm:items-start sm:justify-center sm:px-5">
              <p className="text-xs font-medium text-muted-foreground">Peak rating</p>
              <p className="inline-flex items-center gap-2 font-mono text-xl font-semibold tabular-nums"><Crown className="size-5 text-amber-300" />{stats.peakRating?.toLocaleString() ?? "—"}</p>
            </section>
            <section className="rounded-xl border border-white/[0.07] bg-secondary/25 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Zap className="size-4 text-red-400" />Total impact</h3>
              <div className="mt-2 divide-y divide-white/[0.06]">
                {[["Total K+A", (stats.kills + stats.assists).toLocaleString()], ["Headshot rate", formatStatValue(stats.headshotPercent, "%")], ["Match loss", lossRate === null ? "—" : `${lossRate.toFixed(1)}%`]].map(([label, value]) => <div key={label} className="flex items-center justify-between py-1.5 text-xs first:pt-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="font-mono font-semibold tabular-nums">{value}</span></div>)}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {quickItems.map(({ label, value, icon: Icon, accent, glow }) => (
              <div key={label} className={`rounded-xl border border-white/[0.07] bg-gradient-to-br from-secondary/50 to-secondary/20 p-3 transition-colors ${glow}`}>
                <div className="flex items-center gap-2"><Icon className={`size-4 shrink-0 ${accent}`} /><p className="text-[0.63rem] font-medium text-muted-foreground">{label}</p></div>
                <p className="mt-2 font-mono text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
          <section className="rounded-xl border border-white/[0.07] bg-secondary/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold">Round performance</h3><p className="mt-0.5 text-xs text-muted-foreground">Retake results</p></div>
              <div className="text-right"><p className="font-mono text-lg font-semibold tabular-nums">{stats.roundWinRate === null ? "—" : `${stats.roundWinRate.toFixed(1)}%`}</p><p className="text-[0.62rem] tracking-wide text-muted-foreground uppercase">round win rate</p></div>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Rounds won</span><span className="font-mono text-foreground">{stats.roundsWon.toLocaleString()} <span className="text-muted-foreground">/ {stats.roundsPlayed.toLocaleString()}</span></span></div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-rose-500/30"><span className="bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all" style={{ width: `${roundWinPercent}%` }} /></div>
            <div className="mt-1.5 flex justify-between text-[0.65rem]"><span className="text-emerald-300">{stats.roundsPlayed ? `${roundWinPercent.toFixed(1)}% won` : "—"}</span><span className="text-rose-300">{stats.roundsPlayed ? `${(100 - roundWinPercent).toFixed(1)}% lost` : "—"}</span></div>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-secondary/25 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-red-400" />Round averages</h3>
            <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.08]">
              {[["Kills / round", ratio(stats.kills, stats.roundsPlayed)], ["Assists / round", ratio(stats.assists, stats.roundsPlayed)], ["Deaths / round", ratio(stats.deaths, stats.roundsPlayed)]].map(([label, value]) => <div key={label} className="px-2 first:pl-0 last:pr-0"><p className="text-[0.62rem] text-muted-foreground">{label}</p><p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">{value}</p></div>)}
            </div>
          </section>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
