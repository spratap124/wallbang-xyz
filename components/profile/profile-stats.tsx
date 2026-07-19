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

const STAT_ITEMS: Array<{
  key: keyof QuickStats;
  label: string;
  format?: (value: number | null) => string;
}> = [
  { key: "matchesPlayed", label: "Matches" },
  {
    key: "winRate",
    label: "Win Rate",
    format: (v) => formatStatValue(v, "%"),
  },
  { key: "hoursPlayed", label: "Hours Played" },
  {
    key: "kd",
    label: "K/D",
    format: (v) => formatStatValue(v),
  },
  {
    key: "headshotPercent",
    label: "Headshot %",
    format: (v) => formatStatValue(v, "%"),
  },
  { key: "mvps", label: "MVP" },
];

export function ProfileStats({ stats }: ProfileStatsProps) {
  const hasMatches = stats.matchesPlayed > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasMatches ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="font-medium text-foreground">No Matches Yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Play your first game!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STAT_ITEMS.map((item) => {
              const raw = stats[item.key];
              const value =
                item.format?.(raw as number | null) ??
                formatStatValue(raw as number);
              return (
                <div
                  key={item.key}
                  className="rounded-lg bg-secondary/60 px-3 py-3"
                >
                  <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {hasMatches ? (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:grid-cols-4">
            <span>Wins {stats.wins}</span>
            <span>Losses {stats.losses}</span>
            <span>Kills {stats.kills}</span>
            <span>Deaths {stats.deaths}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
