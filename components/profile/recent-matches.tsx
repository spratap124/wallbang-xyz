import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type RecentMatch = {
  id: string;
  result: "win" | "loss";
  score: string;
  map: string;
  kills: number;
  deaths: number;
  adr?: number | null;
  playedAt: string;
};

type RecentMatchesProps = {
  matches?: RecentMatch[];
};

/** FACEIT-style match list — data lands with the stats pipeline (Sprint 3). */
export function RecentMatches({ matches = [] }: RecentMatchesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Match History</CardTitle>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="font-medium text-foreground">No Matches Yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Play your first game!
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {matches.map((match) => (
              <li
                key={match.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span
                  className={
                    match.result === "win"
                      ? "font-medium text-emerald-400"
                      : "font-medium text-destructive"
                  }
                >
                  {match.result === "win" ? "Win" : "Loss"}
                </span>
                <span className="font-mono">{match.score}</span>
                <span>{match.map}</span>
                <span className="text-muted-foreground">
                  {match.kills}/{match.deaths}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
