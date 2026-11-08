import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatStatValue } from "@/lib/profile/format";
import type { QuickStats } from "@/types/profile";

type ProfileStatsProps = {
  stats: QuickStats;
};

function ratio(value: number, total: number) {
  return total > 0 ? (value / total).toFixed(2) : "—";
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const lossRate = stats.matchesPlayed > 0
    ? (stats.losses / stats.matchesPlayed) * 100
    : null;
  const winRate = stats.matchesPlayed > 0
    ? (stats.wins / stats.matchesPlayed) * 100
    : null;
  const quickItems = [
    ["K/D ratio", stats.kd === null ? "—" : stats.kd.toFixed(2)],
    ["Kills", stats.kills.toLocaleString()],
    ["Deaths", stats.deaths.toLocaleString()],
    ["Assists", stats.assists.toLocaleString()],
    ["Win rate", winRate === null ? "—" : `${winRate.toFixed(1)}%`],
    ["Rounds", stats.roundsPlayed.toLocaleString()],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="rounded-xl bg-secondary/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">WallBang Rating</p><p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{stats.rating.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Peak Rating</p><p className="mt-1 font-mono text-xl font-semibold tabular-nums">—</p></div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-amber-400" />
            <p className="mt-2 text-xs text-muted-foreground">Peak rating is not tracked for this profile yet</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickItems.map(([label, value]) => <div key={label} className="rounded-lg bg-secondary/60 px-3 py-3"><p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">{label}</p><p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p></div>)}
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <h3 className="font-semibold">Retake Performance</h3>
            <div className="mt-3 flex justify-between text-sm text-muted-foreground"><span>Rounds won</span><span className="font-mono text-foreground">{stats.roundsWon.toLocaleString()}</span></div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-rose-500/40"><span className="bg-emerald-400" style={{ width: `${stats.roundsPlayed ? (stats.roundsWon / stats.roundsPlayed) * 100 : 0}%` }} /></div>
            <div className="mt-1 flex justify-between text-xs"><span className="text-emerald-400">{stats.roundWinRate === null ? "—" : `${stats.roundWinRate.toFixed(1)}% won`}</span><span className="text-rose-400">{stats.roundsPlayed ? `${(100 - (stats.roundsWon / stats.roundsPlayed) * 100).toFixed(1)}% lost` : "—"}</span></div>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-sm"><div className="flex justify-between text-muted-foreground"><span>Kills per round</span><span className="font-mono text-foreground">{ratio(stats.kills, stats.roundsPlayed)}</span></div><div className="flex justify-between text-muted-foreground"><span>Assists per round</span><span className="font-mono text-foreground">{ratio(stats.assists, stats.roundsPlayed)}</span></div><div className="flex justify-between text-muted-foreground"><span>Loss rate</span><span className="font-mono text-foreground">{lossRate === null ? "—" : `${lossRate.toFixed(1)}%`}</span></div></div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-sm text-muted-foreground"><span>Total K+A</span><span className="text-right font-mono text-foreground">{(stats.kills + stats.assists).toLocaleString()}</span><span>Deaths per round</span><span className="text-right font-mono text-foreground">{ratio(stats.deaths, stats.roundsPlayed)}</span><span>Headshot rate</span><span className="text-right font-mono text-foreground">{formatStatValue(stats.headshotPercent, "%")}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
