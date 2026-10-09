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
  shortServerLabel,
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
      const overviewPayload = await readJson<FleetOverviewResponse>(overviewRes);
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
  const dailyPeaks =
    data?.daily.map((d) => {
      const peak = Number(d.peakConcurrent);
      return Number.isFinite(peak) ? peak : 0;
    }) ?? [];
  const dailyAvgs =
    data?.daily.map((d) => {
      const avg = Number(d.avgConcurrent);
      return Number.isFinite(avg) ? avg : 0;
    }) ?? [];
  const peakAcrossDays = dailyPeaks.length > 0 ? Math.max(0, ...dailyPeaks) : 0;
  const daysWithAvg = dailyAvgs.filter((n) => n > 0);
  const rangeAvg =
    daysWithAvg.length > 0
      ? Math.round(
          (daysWithAvg.reduce((sum, n) => sum + n, 0) / daysWithAvg.length) * 10,
        ) / 10
      : 0;
  const maxDaily = Math.max(1, peakAcrossDays, ...dailyAvgs);
  const liveDenom =
    summary && summary.liveMaxPlayers > 0
      ? summary.liveMaxPlayers
      : (summary?.currentlyOnline ?? 0);
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
            <span className="text-primary ml-2 align-middle text-xs font-semibold tracking-wide uppercase">
              {displayRole}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
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
        <p className="text-destructive text-sm" role="alert">
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
          hint={
            data?.lifetime
              ? `${data.lifetime.uniquePlayers} lifetime`
              : "Distinct SteamIDs"
          }
          loading={pending && !summary}
          tone="violet"
        />
        <KpiCard
          icon={<Server className="size-4 text-sky-400" />}
          label="Sessions"
          value={summary ? String(summary.totalSessions) : "—"}
          hint={
            data?.lifetime
              ? `${data.lifetime.totalSessions} lifetime`
              : "Join → leave stretches"
          }
          loading={pending && !summary}
          tone="sky"
        />
        <KpiCard
          icon={<Clock className="size-4 text-orange-400" />}
          label="Play time"
          value={summary ? formatDuration(summary.totalPlayTimeMs) : "—"}
          hint={
            data?.lifetime
              ? `${formatDuration(data.lifetime.totalPlayTimeMs)} lifetime`
              : summary
                ? `Avg session ${formatDuration(summary.avgSessionMs)}`
                : "Total across sessions"
          }
          loading={pending && !summary}
          tone="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Recent connections
            </h2>
            <Link
              href="/admin/sessions"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="border-border text-muted-foreground border-b text-xs">
                <tr>
                  <th className="px-3 py-2.5 font-medium sm:px-4">Player</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Server</th>
                  <th className="px-3 py-2.5 font-medium sm:px-4">Map</th>
                  <th className="px-3 py-2.5 font-medium sm:px-4">Joined</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Left</th>
                  <th className="px-3 py-2.5 font-medium sm:px-4">Duration</th>
                  <th
                    className="px-3 py-2.5 font-medium sm:px-4"
                    title="How many players were online on this server when they joined"
                  >
                    At join
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {!data || data.recent.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-3 py-10 text-center sm:px-4"
                    >
                      {pending ? "Loading…" : "No connections yet for this range."}
                    </td>
                  </tr>
                ) : (
                  data.recent.map((session) => (
                    <tr key={session.id} className="hover:bg-secondary/20">
                      <td className="px-3 py-3 sm:px-4">
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
                            <span className="bg-secondary flex size-7 items-center justify-center rounded-full text-xs">
                              {(session.personaName ?? "?").slice(0, 1).toUpperCase()}
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
                            <a
                              href={`https://steamcommunity.com/profiles/${session.steamId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground block truncate font-mono text-[11px] transition-colors hover:underline"
                            >
                              {session.steamId}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td
                        className="hidden max-w-[16rem] px-3 py-3 sm:table-cell sm:px-4"
                        title={session.serverName ?? undefined}
                      >
                        <span className="text-muted-foreground block truncate">
                          {shortServerLabel(session.serverName) || "—"}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-3 sm:px-4">
                        {session.map ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-3 whitespace-nowrap sm:px-4">
                        {formatDateTime(session.joinedAt)}
                      </td>
                      <td className="text-muted-foreground hidden px-4 py-3 whitespace-nowrap md:table-cell">
                        {session.active
                          ? "—"
                          : session.leftAt
                            ? formatDateTime(session.leftAt)
                            : formatDateTime(session.lastSeenAt)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-emerald-400 sm:px-4">
                        {formatDuration(session.durationMs)}
                      </td>
                      <td
                        className="text-muted-foreground px-3 py-3 whitespace-nowrap tabular-nums sm:px-4"
                        title="How many players were online on this server when they joined"
                      >
                        {session.concurrentAtJoin != null
                          ? session.concurrentAtJoin
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Peak &amp; avg players by day
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Max and average concurrent at join per IST day — matches Sessions At join
              </p>
            </div>
            <Link
              href="/admin/sessions"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View all sessions
            </Link>
          </div>
          <div className="p-4">
            {data && data.daily.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="text-muted-foreground flex items-end justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-primary/85 size-2 rounded-[2px]" />
                      Peak
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px] bg-sky-400/70" />
                      Avg
                    </span>
                  </div>
                  <span className="tabular-nums">
                    High · {peakAcrossDays}
                    {rangeAvg > 0 ? ` · Avg · ${rangeAvg}` : ""}
                  </span>
                </div>
                <div className="flex h-44 items-end gap-1 pt-6 sm:gap-1.5">
                  {data.daily.map((day, i) => {
                    const peak = Number(day.peakConcurrent);
                    const peakSafe = Number.isFinite(peak) ? peak : 0;
                    const avg = Number(day.avgConcurrent);
                    const avgSafe = Number.isFinite(avg) ? avg : 0;
                    const dayLabel = formatDay(day.date);
                    const peakHeightPct =
                      peakSafe <= 0
                        ? 0
                        : Math.max(8, Math.round((peakSafe / maxDaily) * 100));
                    const avgHeightPct =
                      avgSafe <= 0
                        ? 0
                        : Math.max(8, Math.round((avgSafe / maxDaily) * 100));
                    const showLabel =
                      data.daily.length <= 8 ||
                      i === 0 ||
                      i === data.daily.length - 1 ||
                      i % Math.ceil(data.daily.length / 6) === 0;
                    const hasActivity = peakSafe > 0 || avgSafe > 0;
                    return (
                      <div
                        key={day.date}
                        className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        <span
                          className="border-border bg-popover text-popover-foreground pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border px-2 py-1 text-[10px] font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                          role="tooltip"
                        >
                          {dayLabel}
                          {peakSafe > 0 ? ` · peak ${peakSafe}` : ""}
                          {avgSafe > 0 ? ` · avg ${avgSafe}` : ""}
                        </span>
                        <span className="text-foreground/80 h-3 text-[10px] font-medium tabular-nums">
                          {hasActivity
                            ? avgSafe > 0 && avgSafe !== peakSafe
                              ? `${peakSafe}/${avgSafe}`
                              : peakSafe > 0
                                ? peakSafe
                                : avgSafe
                            : ""}
                        </span>
                        <div
                          className="flex w-full items-end justify-center gap-0.5"
                          style={{ height: "7.5rem" }}
                        >
                          <div
                            className={cn(
                              "w-full max-w-4 rounded-t-sm transition-colors",
                              peakSafe > 0
                                ? "bg-primary/85 group-hover:bg-primary"
                                : "bg-border/80 group-hover:bg-border",
                            )}
                            style={{
                              height: peakSafe > 0 ? `${peakHeightPct}%` : "3px",
                            }}
                          />
                          <div
                            className={cn(
                              "w-full max-w-4 rounded-t-sm transition-colors",
                              avgSafe > 0
                                ? "bg-sky-400/70 group-hover:bg-sky-400"
                                : "bg-border/50 group-hover:bg-border/80",
                            )}
                            style={{
                              height: avgSafe > 0 ? `${avgHeightPct}%` : "3px",
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-muted-foreground h-3 w-full truncate text-center text-[9px] sm:text-[10px]",
                            !showLabel &&
                              "group-hover:text-foreground invisible group-hover:visible",
                          )}
                        >
                          {dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">
                {pending ? "Loading…" : "No daily data yet."}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Your servers
            </h2>
            <Link
              href="/admin/servers"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
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
                  className="border-border bg-background/40 overflow-hidden rounded-lg border"
                >
                  <div className="bg-secondary relative h-24">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="size-full object-cover opacity-80"
                      />
                    ) : null}
                    <div className="from-background/90 absolute inset-0 bg-gradient-to-t to-transparent" />
                    <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{server.name}</p>
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
                  <div className="text-muted-foreground space-y-1.5 p-3 text-xs">
                    <p className="font-mono">
                      {server.host}:{server.port}
                    </p>
                    <p>
                      {server.players ?? 0}/{server.maxPlayers ?? "—"} players ·{" "}
                      {server.map} · {server.mode}
                    </p>
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/servers?edit=${server.id}`} />}
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
                className="border-border bg-background/20 text-muted-foreground hover:border-primary/50 hover:text-foreground flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm transition-colors"
              >
                <span className="border-border flex size-10 items-center justify-center rounded-full border">
                  <Plus className="size-4" />
                </span>
                Add Server
              </Link>
            ) : null}
          </div>
        </section>

        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Server status
            </h2>
          </div>
          <ul className="divide-border/60 divide-y">
            {(health?.checks ?? []).map((check) => (
              <li key={check.id} className="flex items-start gap-3 px-4 py-3.5">
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
                    <span className="text-muted-foreground text-xs">{check.value}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{check.detail}</p>
                </div>
              </li>
            ))}
            {!health ? (
              <li className="text-muted-foreground px-3 py-8 text-center text-sm sm:px-4">
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
    <div className="border-border bg-card/40 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {label}
        </p>
        <span
          className={cn("flex size-8 items-center justify-center rounded-lg", toneClass)}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
          loading && "opacity-50",
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}
