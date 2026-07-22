"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Activity, Clock, Plus, Server, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatDay,
  formatDuration,
  mapThumbPath,
} from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type {
  AdminHealthResponse,
  FleetOverviewResponse,
  ServerStatsRange,
} from "@/types/profile";
import type { AuthUser } from "@/types/auth";
import type { RoleCode } from "@/types/permissions";

const RANGES: { value: ServerStatsRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

type OverviewDashboardProps = {
  user: AuthUser;
  displayRole: RoleCode;
  canManageServers: boolean;
};

export function OverviewDashboard({
  user,
  displayRole,
  canManageServers,
}: OverviewDashboardProps) {
  const [range, setRange] = useState<ServerStatsRange>("7d");
  const [data, setData] = useState<FleetOverviewResponse | null>(null);
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback((nextRange: ServerStatsRange) => {
    setError(null);
    startTransition(async () => {
      const [overviewRes, healthRes] = await Promise.all([
        fetch(`/api/v1/admin/overview?range=${nextRange}`),
        fetch("/api/v1/admin/health"),
      ]);
      const overviewPayload =
        await readJson<FleetOverviewResponse>(overviewRes);
      const healthPayload = await readJson<AdminHealthResponse>(healthRes);

      if (!overviewPayload.ok) {
        setError(overviewPayload.error);
        setData(null);
        return;
      }
      setData(overviewPayload.data);
      if (healthPayload.ok) setHealth(healthPayload.data);
    });
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const summary = data?.summary;
  const maxDaily = Math.max(
    1,
    ...(data?.daily.map((d) => d.uniquePlayers) ?? [1]),
  );
  const liveDenom =
    summary && summary.liveMaxPlayers > 0
      ? summary.liveMaxPlayers
      : summary?.currentlyOnline ?? 0;
  const liveNum =
    summary && summary.livePlayers > 0
      ? summary.livePlayers
      : (summary?.currentlyOnline ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {user.personaName}
            <span className="ml-2 align-middle text-xs font-semibold tracking-wide text-primary uppercase">
              {displayRole}
            </span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your CS2 retake servers.
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
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Activity className="size-4 text-emerald-400" />}
          label="Live now"
          value={summary ? `${liveNum} / ${liveDenom || "—"}` : "—"}
          hint="Players online"
          loading={pending && !summary}
          tone="emerald"
        />
        <KpiCard
          icon={<Users className="size-4 text-violet-400" />}
          label="Unique players"
          value={summary ? String(summary.uniquePlayers) : "—"}
          hint="Distinct SteamIDs"
          loading={pending && !summary}
          tone="violet"
        />
        <KpiCard
          icon={<Server className="size-4 text-sky-400" />}
          label="Sessions"
          value={summary ? String(summary.totalSessions) : "—"}
          hint="Join → leave stretches"
          loading={pending && !summary}
          tone="sky"
        />
        <KpiCard
          icon={<Clock className="size-4 text-orange-400" />}
          label="Play time"
          value={summary ? formatDuration(summary.totalPlayTimeMs) : "—"}
          hint={
            summary
              ? `Avg session ${formatDuration(summary.avgSessionMs)}`
              : "Total across sessions"
          }
          loading={pending && !summary}
          tone="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent connections
            </h2>
            <Link
              href="/admin/sessions"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Player</th>
                  <th className="px-4 py-2.5 font-medium">Map</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                    Left
                  </th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {!data || data.recent.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      {pending
                        ? "Loading…"
                        : "No connections yet for this range."}
                    </td>
                  </tr>
                ) : (
                  data.recent.map((session) => (
                    <tr key={session.id} className="hover:bg-secondary/20">
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
                              {(session.personaName ?? "?")
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {session.personaName ?? "Unknown"}
                              </span>
                              {session.active ? (
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-400 uppercase">
                                  Live
                                </span>
                              ) : null}
                            </div>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {session.steamId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.map ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(session.joinedAt)}
                      </td>
                      <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                        {session.active
                          ? "—"
                          : session.leftAt
                            ? formatDateTime(session.leftAt)
                            : formatDateTime(session.lastSeenAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-400">
                        {formatDuration(session.durationMs)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Players by day
            </h2>
            <Link
              href="/admin/sessions"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all sessions
            </Link>
          </div>
          <div className="p-4">
            {data && data.daily.length > 0 ? (
              <>
                <div className="relative h-44">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full overflow-visible"
                  >
                    <polyline
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      points={data.daily
                        .map((day, i) => {
                          const x =
                            data.daily.length === 1
                              ? 50
                              : (i / (data.daily.length - 1)) * 100;
                          const y =
                            100 -
                            (day.uniquePlayers / maxDaily) * 85 -
                            5;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                    {data.daily.map((day, i) => {
                      const x =
                        data.daily.length === 1
                          ? 50
                          : (i / (data.daily.length - 1)) * 100;
                      const y =
                        100 - (day.uniquePlayers / maxDaily) * 85 - 5;
                      return (
                        <circle
                          key={day.date}
                          cx={x}
                          cy={y}
                          r="1.4"
                          fill="var(--primary)"
                          vectorEffect="non-scaling-stroke"
                        >
                          <title>
                            {formatDay(day.date)}: {day.uniquePlayers} players
                          </title>
                        </circle>
                      );
                    })}
                  </svg>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatDay(data.daily[0].date)}</span>
                  <span>
                    {formatDay(data.daily[data.daily.length - 1].date)}
                  </span>
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {pending ? "Loading…" : "No daily data yet."}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Your servers
            </h2>
            <Link
              href="/admin/servers"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all servers
            </Link>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {(data?.servers ?? []).slice(0, 4).map((server) => {
              const thumb = mapThumbPath(server.map);
              return (
                <div
                  key={server.id}
                  className="overflow-hidden rounded-lg border border-border bg-background/40"
                >
                  <div className="relative h-24 bg-secondary">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="size-full object-cover opacity-80"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                    <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {server.name}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                          server.enabled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {server.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 p-3 text-xs text-muted-foreground">
                    <p className="font-mono">
                      {server.host}:{server.port}
                    </p>
                    <p>
                      {server.players ?? 0}/{server.maxPlayers ?? "—"} players
                      · {server.map} · {server.mode}
                    </p>
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link href={`/admin/servers?edit=${server.id}`} />
                        }
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {canManageServers ? (
              <Link
                href="/admin/servers?new=1"
                className="flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background/20 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-border">
                  <Plus className="size-4" />
                </span>
                Add Server
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/40">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Server status
            </h2>
          </div>
          <ul className="divide-y divide-border/60">
            {(health?.checks ?? []).map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-3 px-4 py-3.5"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    check.status === "ok" && "bg-emerald-400",
                    check.status === "degraded" && "bg-amber-400",
                    check.status === "down" && "bg-red-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{check.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {check.value}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
            {!health ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                {pending ? "Checking…" : "Health unavailable"}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  loading?: boolean;
  tone: "emerald" | "violet" | "sky" | "orange";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10",
    violet: "bg-violet-500/10",
    sky: "bg-sky-500/10",
    orange: "bg-orange-500/10",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            toneClass,
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
          loading && "opacity-50",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
