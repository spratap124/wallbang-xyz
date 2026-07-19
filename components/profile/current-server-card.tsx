import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CurrentServerCardProps = {
  serverName?: string | null;
  players?: string | null;
};

/** Sprint 2 will wire live CS2 status. Sprint 1 shows offline empty state. */
export function CurrentServerCard({
  serverName,
  players,
}: CurrentServerCardProps) {
  const online = Boolean(serverName);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Server</CardTitle>
      </CardHeader>
      <CardContent>
        {online ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
              Playing
            </p>
            <p className="text-lg font-semibold">{serverName}</p>
            {players ? (
              <p className="text-sm text-muted-foreground">{players}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Not playing right now
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
