import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IST_LOCALE, IST_TIME_ZONE } from "@/lib/time/ist";
import type { PlayerServerActivity } from "@/types/profile";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPlayTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Retained server activity for a player. Data comes from `player_sessions`,
 * which Mongo prunes on a retention TTL, so the window is labelled instead of
 * implying lifetime totals.
 */
export function ServerActivityCard({
  activity,
}: {
  activity: PlayerServerActivity | null;
}) {
  const hasActivity = Boolean(activity && activity.sessions > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasActivity || !activity ? (
          <div className="border-border bg-muted/30 rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-foreground font-medium">No recorded sessions yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Play on a WallBang server to start building your activity.
            </p>
          </div>
        ) : (
          <dl className="space-y-2">
            <Row label="Sessions" value={String(activity.sessions)} />
            <Row label="Play time" value={formatPlayTime(activity.playTimeMs)} />
            <Row
              label="First seen"
              value={activity.firstSeenAt ? formatDateTime(activity.firstSeenAt) : "—"}
            />
            <Row
              label="Last seen"
              value={activity.lastSeenAt ? formatDateTime(activity.lastSeenAt) : "—"}
            />
            <p className="text-muted-foreground border-border/60 border-t pt-2 text-[0.7rem]">
              Retained session data only (last {activity.windowDays} days).
            </p>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
