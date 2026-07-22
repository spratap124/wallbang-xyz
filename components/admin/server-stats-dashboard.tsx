"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type {
  ServerStatsRange,
  ServerStatsResponse,
} from "@/types/profile";

const RANGES: { value: ServerStatsRange; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function formatDuration(ms: number): string {
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

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(value: string): string {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export type ServerStatsOption = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  region: string;
};

type ServerStatsDashboardProps = {
  servers: ServerStatsOption[];
  initialServerId?: string;
};

function resolveServerId(
  servers: ServerStatsOption[],
  preferredId: string | undefined,
): string {
  if (preferredId && servers.some((s) => s.id === preferredId)) {
    return preferredId;
  }
  return servers[0]?.id ?? "";
}

export function ServerStatsDashboard({
  servers,
  initialServerId,
}: ServerStatsDashboardProps) {
  const [serverId, setServerId] = useState(() =>
    resolveServerId(servers, initialServerId),
  );
  const [range, setRange] = useState<ServerStatsRange>("7d");
  const [data, setData] = useState<ServerStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Parent loads the fleet async; sync selection once servers arrive (or change).
  useEffect(() => {
    setServerId((current) => resolveServerId(servers, current || initialServerId));
  }, [servers, initialServerId]);

  const selected =
    servers.find((s) => s.id === serverId) ?? servers[0] ?? null;
  const activeServerId = selected?.id ?? "";

  const load = useCallback(
    (nextServerId: string, nextRange: ServerStatsRange) => {
      if (!nextServerId) return;
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/v1/admin/server-stats?serverId=${encodeURIComponent(nextServerId)}&range=${nextRange}`,
          );
          const payload = await readJson<ServerStatsResponse>(res);
          if (!payload.ok) {
            setError(payload.error);
            setData(null);
            return;
          }
          setData(payload.data);
        } catch {
          setError("Failed to load server activity.");
          setData(null);
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!activeServerId) return;
    setData(null);
    load(activeServerId, range);
  }, [load, activeServerId, range]);

  const summary = data?.summary;
  const maxDaily = Math.max(
    1,
    ...(data?.daily.map((d) => d.uniquePlayers) ?? [1]),
  );

  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        {servers.length === 0 ? "Loading servers…" : "No servers configured."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="server-stats-server"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Server
          </label>
          <select
            id="server-stats-server"
            value={activeServerId}
            disabled={pending}
            onChange={(e) => setServerId(e.target.value)}
            className="h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.shortName} · {server.mode} · {server.region}
              </option>
            ))}
          </select>
          <p className="truncate text-sm text-muted-foreground">
            {selected.name}
            <span className="ml-2 font-mono text-xs">{selected.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={range === item.value ? "default" : "outline"}
              disabled={pending}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => load(activeServerId, range)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Unique players"
          value={summary ? String(summary.uniquePlayers) : "—"}
          hint="Distinct SteamIDs that connected"
          loading={pending && !summary}
        />
        <StatCard
          label="Sessions"
          value={summary ? String(summary.totalSessions) : "—"}
          hint="Join → leave connection stretches"
          loading={pending && !summary}
        />
        <StatCard
          label="Play time"
          value={summary ? formatDuration(summary.totalPlayTimeMs) : "—"}
          hint={
            summary
              ? `Avg session ${formatDuration(summary.avgSessionMs)}`
              : "Total time across sessions"
          }
          loading={pending && !summary}
        />
        <StatCard
          label="Live now"
          value={
            summary
              ? `${summary.currentlyOnline}${
                  summary.liveMaxPlayers != null
                    ? ` / ${summary.liveMaxPlayers}`
                    : ""
                }`
              : "—"
          }
          hint={
            !summary
              ? "Live A2S status"
              : summary.online
                ? summary.livePlayers != null
                  ? `A2S reports ${summary.livePlayers} players`
                  : "Server online"
                : "Server offline or unreachable"
          }
          loading={pending && !summary}
          accent={summary?.currentlyOnline ? "live" : undefined}
        />
      </div>

      {data && data.daily.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Unique players by day
          </h2>
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <div className="flex h-28 items-end gap-1 sm:gap-1.5">
              {data.daily.map((day) => {
                const height =
                  day.uniquePlayers === 0
                    ? 4
                    : Math.max(8, Math.round((day.uniquePlayers / maxDaily) * 100));
                return (
                  <div
                    key={day.date}
                    className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${formatDay(day.date)}: ${day.uniquePlayers} players, ${day.sessions} sessions`}
                  >
                    <span className="mb-1 hidden text-[10px] text-muted-foreground sm:group-hover:block">
                      {day.uniquePlayers}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-sm bg-foreground/80 transition-colors group-hover:bg-foreground",
                        day.uniquePlayers === 0 && "bg-border",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground sm:text-xs">
              <span>{formatDay(data.daily[0].date)}</span>
              <span>{formatDay(data.daily[data.daily.length - 1].date)}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Recent connections
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Map
                </th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Left
                </th>
                <th className="px-4 py-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!data || data.recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {pending
                      ? "Loading…"
                      : "No connections recorded yet for this range. Stats start once the CS2 plugin sends presence heartbeats."}
                  </td>
                </tr>
              ) : (
                data.recent.map((session) => (
                  <tr key={session.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {session.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={session.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 rounded-full"
                          />
                        ) : (
                          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs">
                            {(session.personaName ?? "?").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {session.personaName ?? "Unknown player"}
                            </span>
                            {session.active ? (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                                Live
                              </span>
                            ) : null}
                          </div>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {session.steamId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {session.map ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(session.joinedAt)}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground whitespace-nowrap md:table-cell">
                      {session.active
                        ? "—"
                        : session.leftAt
                          ? formatDateTime(session.leftAt)
                          : formatDateTime(session.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDuration(session.durationMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  loading?: boolean;
  accent?: "live";
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          loading && "opacity-50",
          accent === "live" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
