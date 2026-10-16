"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Activity, Clock, Plus, Server, Users, Wallet } from "lucide-react";

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
  const [serverFilter, setServerFilter] = useState("all");
  const [mapFilter, setMapFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [playerTypeFilter, setPlayerTypeFilter] = useState("all");

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
  const dailyPeaks = data?.daily.map((d) => d.peakConcurrent) ?? [];
  const dailyAvgs = data?.daily.map((d) => d.avgConcurrent) ?? [];
  const peakAcrossDays = dailyPeaks.length > 0 ? Math.max(0, ...dailyPeaks) : 0;
  const maxDaily = Math.max(1, peakAcrossDays, ...dailyAvgs);
  const liveDenom =
    summary && summary.liveMaxPlayers > 0
      ? summary.liveMaxPlayers
      : (summary?.currentlyOnline ?? 0);
  const liveNum =
    summary && summary.livePlayers > 0
      ? summary.livePlayers
      : (summary?.currentlyOnline ?? 0);
  const maps = [
    ...new Set(data?.recent.map((session) => session.map).filter(Boolean)),
  ] as string[];
  const visibleSessions = (data?.recent ?? []).filter((session) => {
    if (serverFilter !== "all" && session.serverId !== serverFilter) return false;
    if (mapFilter !== "all" && session.map !== mapFilter) return false;
    if (playerTypeFilter === "new" && session.firstEverPlayer !== true) return false;
    if (playerTypeFilter === "returning" && session.firstEverPlayer !== false)
      return false;
    if (durationFilter === "under5" && session.durationMs >= 5 * 60_000) return false;
    if (
      durationFilter === "5to20" &&
      (session.durationMs < 5 * 60_000 || session.durationMs >= 20 * 60_000)
    )
      return false;
    if (durationFilter === "20plus" && session.durationMs < 20 * 60_000) return false;
    return true;
  });
  const timeZoneName = "Asia/Kolkata";
  const heatMax = Math.max(
    1,
    ...(data?.activityHeatmap.map((cell) => cell.avgConcurrent) ?? []),
  );
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

      <div className="border-border/70 bg-card/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-xs">
        <div>
          <span className="font-medium">
            Reporting period · {data?.period.label ?? "Loading…"}
          </span>
          <span className="text-muted-foreground ml-2">
            Complete IST days only · compared with previous equal-length period
          </span>
        </div>
        <span className="text-muted-foreground">
          Current day excluded · {timeZoneName}
        </span>
      </div>

      {data?.dataQuality &&
      (!data.dataQuality.sessionCoverageComplete ||
        data.dataQuality.excludedLongSessions > 0 ||
        !data.dataQuality.concurrencyExact) ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-100/90">
          <strong>Analytics limitations:</strong>{" "}
          {!data.dataQuality.sessionCoverageComplete
            ? `Only ${data.dataQuality.sessionCoverageDays} days are within the configured session-retention horizon; ingest gaps cannot be detected. `
            : ""}
          {data.dataQuality.excludedLongSessions > 0
            ? `${data.dataQuality.excludedLongSessions} session(s) over 12 hours were excluded from playtime and concurrency as unreliable. `
            : ""}
          {!data.dataQuality.concurrencyExact
            ? `Concurrency is reconstructed, not an exact presence trace: ${data.dataQuality.overlappingSessions} overlap(s) deduplicated, ${data.dataQuality.overCapacityIntervals} over-capacity interval(s), and unknown capacity for ${data.dataQuality.unknownCapacityServers} server(s).`
            : ""}
        </div>
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
          label="Active players"
          value={summary ? String(summary.uniquePlayers) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.uniquePlayers, data?.previousPeriod.uniquePlayers, data?.previousPeriod.available)} vs prior period`
              : "Distinct players in period"
          }
          loading={pending && !summary}
          tone="violet"
        />
        <KpiCard
          icon={<Users className="size-4 text-sky-400" />}
          label="New players"
          value={summary ? String(summary.newPlayers) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.newPlayers, data?.previousPeriod.newPlayers, data?.previousPeriod.available)} vs prior · first-ever`
              : "First-ever sessions"
          }
          loading={pending && !summary}
          tone="sky"
        />
        <KpiCard
          icon={<Users className="size-4 text-emerald-400" />}
          label="Returning players"
          value={summary ? String(summary.returningPlayers) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.returningPlayers, data?.previousPeriod.returningPlayers, data?.previousPeriod.available)} vs prior · seen before`
              : "Known first-seen history"
          }
          loading={pending && !summary}
          tone="orange"
        />
        <KpiCard
          icon={<Activity className="size-4 text-fuchsia-400" />}
          label="D1 / D7 retention"
          value={
            data
              ? `${formatPercent(data.retention.d1Percent)} / ${formatPercent(data.retention.d7Percent)}`
              : "—"
          }
          hint={
            data
              ? `Mature cohorts · ${data.retention.d1CohortPlayers} D1 / ${data.retention.d7CohortPlayers} D7 players`
              : "First-time cohorts only"
          }
          loading={pending && !summary}
          tone="violet"
        />
        <KpiCard
          icon={<Clock className="size-4 text-orange-400" />}
          label="Play time"
          value={summary ? formatDuration(summary.totalPlayTimeMs) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.totalPlayTimeMs, data?.previousPeriod.totalPlayTimeMs, data?.previousPeriod.available)} vs prior · outliers excluded`
              : "Observed session intervals"
          }
          loading={pending && !summary}
          tone="orange"
        />
        <KpiCard
          icon={<Activity className="size-4 text-cyan-400" />}
          label="Avg concurrent"
          value={summary ? summary.avgConcurrent.toFixed(1) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.avgConcurrent, data?.previousPeriod.avgConcurrent, data?.previousPeriod.available)} vs prior · prime ${summary.primeTimeAvgConcurrent.toFixed(1)} · peak ${summary.peakConcurrent}`
              : "Time-weighted, capacity-aware"
          }
          loading={pending && !summary}
          tone="sky"
        />
        <KpiCard
          icon={<Server className="size-4 text-lime-400" />}
          label="Sessions"
          value={summary ? String(summary.totalSessions) : "—"}
          hint={
            summary
              ? `${formatDelta(summary.totalSessions, data?.previousPeriod.totalSessions, data?.previousPeriod.available)} vs prior · connection stretches`
              : "Not merged into visits"
          }
          loading={pending && !summary}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Retention &amp; player growth
            </h2>
            <p className="text-muted-foreground mt-1 text-[10px]">
              First-ever players use the durable first-seen index; retention is exact
              calendar-day return.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <MetricTile
              label="D1 retention"
              value={formatPercent(data?.retention.d1Percent ?? null)}
              detail={
                data?.retention.d1CohortPlayers
                  ? `${data.retention.d1CohortPlayers} mature new players`
                  : "No mature cohort in this range"
              }
            />
            <MetricTile
              label="D7 retention"
              value={formatPercent(data?.retention.d7Percent ?? null)}
              detail={
                data?.retention.d7CohortPlayers
                  ? `${data.retention.d7CohortPlayers} mature new players`
                  : "No mature cohort in this range"
              }
            />
            <MetricTile
              label="Active on 2+ days"
              value={data ? String(data.retention.multiDayPlayers) : "—"}
              detail="Unique players in selected period"
            />
            <MetricTile
              label="Within retention horizon"
              value={
                data
                  ? `${data.dataQuality.sessionCoverageDays} / ${range === "1d" ? 1 : range === "7d" ? 7 : 30} days`
                  : "—"
              }
              detail={`Configured TTL ${data?.dataQuality.sessionRetentionDays ?? "—"} days; ingest gaps are not detected`}
            />
          </div>
          <div className="space-y-2 px-4 pb-4">
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>Daily active players · new / returning</span>
              <span>IST</span>
            </div>
            {(data?.daily ?? []).map((day) => {
              const total = Math.max(
                1,
                ...data!.daily
                  .filter((row) => row.complete)
                  .map((row) => row.uniquePlayers),
              );
              return (
                <div
                  key={day.date}
                  className="grid grid-cols-[3.2rem_1fr_2.7rem] items-center gap-2 text-[10px]"
                >
                  <span className="text-muted-foreground">{formatDay(day.date)}</span>
                  <div
                    className="bg-secondary/70 flex h-2 overflow-hidden rounded-full"
                    title={
                      day.complete
                        ? `${day.uniquePlayers} active · ${day.newPlayers} new · ${day.returningPlayers} returning`
                        : "Partial day coverage: session history may have expired"
                    }
                  >
                    {day.complete ? (
                      <>
                        <div
                          className="bg-sky-400"
                          style={{ width: `${(day.newPlayers / total) * 100}%` }}
                        />
                        <div
                          className="bg-violet-400"
                          style={{ width: `${(day.returningPlayers / total) * 100}%` }}
                        />
                      </>
                    ) : (
                      <div className="bg-amber-500/40" style={{ width: "100%" }} />
                    )}
                  </div>
                  <span className="text-right tabular-nums">
                    {day.complete ? day.uniquePlayers : "—"}
                  </span>
                </div>
              );
            })}
            <div className="text-muted-foreground flex gap-4 pt-1 text-[10px]">
              <span>
                <i className="mr-1 inline-block size-2 rounded-sm bg-sky-400" />
                New
              </span>
              <span>
                <i className="mr-1 inline-block size-2 rounded-sm bg-violet-400" />
                Returning
              </span>
              {summary?.unclassifiedPlayers ? (
                <span>{summary.unclassifiedPlayers} unclassified first-seen</span>
              ) : null}
            </div>
            <div className="border-border/70 mt-3 border-t pt-3">
              <div className="text-muted-foreground mb-1.5 flex justify-between text-[10px]">
                <span>First-ever cohort · exact return day</span>
                <span>Cohort / D1 / D7</span>
              </div>
              {(data?.retention.cohorts.slice(-7).reverse() ?? []).map((cohort) => (
                <div
                  key={cohort.date}
                  className="text-muted-foreground flex justify-between py-1 text-[10px] tabular-nums"
                >
                  <span>{formatDay(cohort.date)}</span>
                  <span>
                    {cohort.players} ·{" "}
                    {cohort.d1Retained == null
                      ? "—"
                      : `${cohort.d1Retained} (${cohort.d1Percent}%)`}{" "}
                    ·{" "}
                    {cohort.d7Retained == null
                      ? "—"
                      : `${cohort.d7Retained} (${cohort.d7Percent}%)`}
                  </span>
                </div>
              ))}
              <p className="text-muted-foreground mt-1 text-[9px]">
                “—” means the return day is not mature or outside retained session
                history.
              </p>
            </div>
          </div>
        </section>

        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              When players are together
            </h2>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Time-weighted average concurrent players by IST weekday and hour
            </p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-[2.3rem_repeat(24,minmax(0,1fr))] gap-1">
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span
                  key={hour}
                  className="text-muted-foreground text-center text-[8px] tabular-nums"
                >
                  {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                </span>
              ))}
              {weekdayNames.map((dayName, dayOfWeek) => (
                <div key={dayName} className="contents">
                  <span className="text-muted-foreground flex items-center text-[9px]">
                    {dayName}
                  </span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const value =
                      data?.activityHeatmap.find(
                        (cell) => cell.dayOfWeek === dayOfWeek && cell.hour === hour,
                      )?.avgConcurrent ?? 0;
                    const intensity = value / heatMax;
                    return (
                      <span
                        key={`${dayName}-${hour}`}
                        className="aspect-square min-w-0 rounded-[2px] bg-sky-400"
                        style={{ opacity: value > 0 ? 0.12 + intensity * 0.82 : 0.06 }}
                        title={`${dayName} ${String(hour).padStart(2, "0")}:00 IST · ${value.toFixed(1)} average players`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="text-muted-foreground mt-3 flex items-center justify-between text-[10px]">
              <span>
                Low <i className="mx-1 inline-block size-2 rounded-sm bg-sky-400/20" />{" "}
                <i className="inline-block size-2 rounded-sm bg-sky-400" /> High
              </span>
              <span>
                Prime time 17:00–22:00 ·{" "}
                {summary?.primeTimeAvgConcurrent.toFixed(1) ?? "—"} average players
              </span>
            </div>
          </div>
          <div className="border-border/70 text-muted-foreground border-t px-4 py-3 text-[10px]">
            Fleet utilization: empty {data?.utilization.emptyPercent.toFixed(1) ?? "—"}% ·
            1–4 {data?.utilization.oneToFourPercent.toFixed(1) ?? "—"}% · 5–9{" "}
            {data?.utilization.fiveToNinePercent.toFixed(1) ?? "—"}% · 10+{" "}
            {data?.utilization.tenPlusPercent.toFixed(1) ?? "—"}% of observed time
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Server density · selected period
            </h2>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Historical session data grouped by server ID; disabled/migrated IDs remain
              for comparison.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-xs">
              <thead className="text-muted-foreground border-border/70 border-b text-[10px]">
                <tr>
                  <th className="px-3 py-2">Server</th>
                  <th className="px-3 py-2">Unique</th>
                  <th className="px-3 py-2">New / return</th>
                  <th className="px-3 py-2">D1 / D7</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Playtime</th>
                  <th className="px-3 py-2">Avg / prime</th>
                  <th className="px-3 py-2">Peak</th>
                  <th className="px-3 py-2">Empty</th>
                  <th className="px-3 py-2">1–4</th>
                  <th className="px-3 py-2">5–9</th>
                  <th className="px-3 py-2">10+</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {(data?.serverAnalytics ?? []).map((row) => {
                  const server = data?.servers.find((item) => item.id === row.id);
                  return (
                    <tr key={row.id} className="hover:bg-secondary/20">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{server?.shortName ?? row.id}</span>
                        <span
                          className={cn(
                            "ml-2 text-[9px]",
                            server?.enabled
                              ? "text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {server?.enabled ? "enabled" : "inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{row.uniquePlayers}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.newPlayers} / {row.returningPlayers}
                        {row.unclassifiedPlayers
                          ? ` (+${row.unclassifiedPlayers} ?)`
                          : ""}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatPercent(row.d1RetentionPercent)} /{" "}
                        {formatPercent(row.d7RetentionPercent)}
                        <span className="text-muted-foreground block text-[9px]">
                          n={row.d1CohortPlayers} / {row.d7CohortPlayers}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{row.sessions}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDuration(row.totalPlayTimeMs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.avgConcurrent.toFixed(1)} /{" "}
                        {row.primeTimeAvgConcurrent.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.peakConcurrent}
                        {row.capacity ? ` / ${row.capacity}` : ""}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.utilization.emptyPercent.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.utilization.oneToFourPercent.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.utilization.fiveToNinePercent.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.utilization.tenPlusPercent.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <Wallet className="size-4 text-emerald-400" />
            <div>
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Paid VIP · verified payments only
              </h2>
              <p className="text-muted-foreground mt-1 text-[10px]">
                Free VIP grants are excluded from revenue.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <MetricTile
              label="Captured revenue"
              value={formatInr(data?.monetization.grossCapturedPaise ?? 0)}
              detail={`${formatDelta(data?.monetization.netRevenuePaise ?? 0, data?.previousPeriod.netRevenuePaise, data?.previousPeriod.available)} vs prior net`}
            />
            <MetricTile
              label="Net after refunds"
              value={formatInr(data?.monetization.netRevenuePaise ?? 0)}
              detail={`Refunds ${formatInr(data?.monetization.refundsPaise ?? 0)}`}
            />
            <MetricTile
              label="Paying customers"
              value={String(data?.monetization.payingCustomers ?? 0)}
              detail={`${data?.monetization.successfulPurchases ?? 0} purchases · ${formatDelta(data?.monetization.payingCustomers ?? 0, data?.previousPeriod.payingCustomers, data?.previousPeriod.available)} vs prior`}
            />
            <MetricTile
              label="Monthly equivalent"
              value={formatInr(data?.monetization.monthlyEquivalentPaise ?? 0)}
              detail="Plan duration normalized to 30 days"
            />
            <MetricTile
              label="Abandoned checkouts"
              value={String(data?.monetization.abandonedCheckouts ?? 0)}
              detail="Unpaid created orders ≥30 min old"
            />
            <MetricTile
              label="Non-paid VIP users"
              value={String(data?.monetization.freeVipUsers ?? 0)}
              detail="Active free/founding entitlements"
            />
          </div>
          <div className="border-border/70 text-muted-foreground space-y-2 border-t px-4 py-3 text-[10px]">
            <p>
              Fees: unavailable in payment records · operating costs: not configured ·
              break-even: unavailable.
            </p>
            <p>
              Checkout conversion:{" "}
              {formatPercent(data?.monetization.checkoutConversionPercent ?? null)} of
              recorded checkout users. Captured plan mix:
            </p>
            {data?.monetization.revenueByPlan.length ? (
              data.monetization.revenueByPlan.map((plan) => (
                <p
                  key={`${plan.plan}:${plan.accessType}`}
                  className="flex justify-between gap-2"
                >
                  <span>
                    {plan.accessType === "ALL_RETAKES"
                      ? "All Retakes"
                      : "Individual server"}{" "}
                    · {plan.plan.replaceAll("_", " ")} ({plan.purchases})
                  </span>
                  <span>
                    {formatInr(plan.grossPaise)} ·{" "}
                    {formatInr(plan.monthlyEquivalentPaise)}/mo equiv.
                  </span>
                </p>
              ))
            ) : (
              <p>
                No captured purchases in this period; unpaid checkouts are not revenue.
              </p>
            )}
            <p>
              Acquisition source: not tracked for server joins. Existing players cannot be
              attributed retroactively.
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Recent connection sessions
            </h2>
            <Link
              href="/admin/sessions"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="border-border flex flex-wrap gap-2 border-b px-3 py-2.5 sm:px-4">
            <select
              aria-label="Filter by server"
              value={serverFilter}
              onChange={(event) => setServerFilter(event.target.value)}
              className="border-border bg-background h-8 rounded-md border px-2 text-xs"
            >
              <option value="all">All servers</option>
              {(data?.servers ?? []).map((server) => (
                <option key={server.id} value={server.id}>
                  {server.shortName}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by map"
              value={mapFilter}
              onChange={(event) => setMapFilter(event.target.value)}
              className="border-border bg-background h-8 rounded-md border px-2 text-xs"
            >
              <option value="all">All maps</option>
              {maps.map((map) => (
                <option key={map} value={map!}>
                  {map}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by session duration"
              value={durationFilter}
              onChange={(event) => setDurationFilter(event.target.value)}
              className="border-border bg-background h-8 rounded-md border px-2 text-xs"
            >
              <option value="all">Any duration</option>
              <option value="under5">Under 5 min</option>
              <option value="5to20">5–20 min</option>
              <option value="20plus">20+ min</option>
            </select>
            <select
              aria-label="Filter by player history"
              value={playerTypeFilter}
              onChange={(event) => setPlayerTypeFilter(event.target.value)}
              className="border-border bg-background h-8 rounded-md border px-2 text-xs"
            >
              <option value="all">All player types</option>
              <option value="new">First-time</option>
              <option value="returning">Returning</option>
            </select>
            <span className="text-muted-foreground ml-auto self-center text-[10px]">
              Latest {data?.recent.length ?? 0} session records · filters apply to this
              sample
            </span>
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
                {!data || visibleSessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-3 py-10 text-center sm:px-4"
                    >
                      {pending
                        ? "Loading…"
                        : data?.recent.length
                          ? "No sessions match these filters."
                          : "No connection sessions in this range."}
                    </td>
                  </tr>
                ) : (
                  visibleSessions.map((session) => (
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
                              {session.personaName ? (
                                <Link
                                  href={`/profile/${session.steamId}`}
                                  title="View player profile"
                                  className="hover:text-primary truncate font-medium transition-colors"
                                >
                                  {session.personaName}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground truncate font-medium">
                                  Profile not linked
                                </span>
                              )}
                              {session.firstEverPlayer === true ? (
                                <span className="rounded bg-sky-500/10 px-1 py-0.5 text-[9px] font-medium text-sky-300">
                                  New
                                </span>
                              ) : session.firstEverPlayer === false ? (
                                <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] font-medium text-violet-300">
                                  Returning
                                </span>
                              ) : null}
                              {session.active ? (
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-400 uppercase">
                                  Live
                                </span>
                              ) : null}
                            </div>
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
                Peak &amp; time-weighted average
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Interval reconstruction · amber marks partial retained-history coverage
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
                    Peak · {peakAcrossDays}
                    {summary ? ` · Period avg · ${summary.avgConcurrent}` : ""}
                  </span>
                </div>
                <div className="flex h-44 items-end gap-1 pt-6 sm:gap-1.5">
                  {data.daily.map((day, i) => {
                    const peakSafe = day.complete ? day.peakConcurrent : 0;
                    const avgSafe = day.complete ? day.avgConcurrent : 0;
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
                          {!day.complete ? " · incomplete retained history" : ""}
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
                              !day.complete
                                ? "bg-amber-400/60"
                                : peakSafe > 0
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
                              !day.complete
                                ? "bg-amber-400/30"
                                : avgSafe > 0
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

function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDelta(
  value: number,
  previous: number | undefined,
  available = true,
): string {
  if (!available) return "Unavailable";
  if (previous == null) return "No comparison";
  if (previous === 0) return value === 0 ? "No change" : "Up from 0";
  const change = ((value - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(Math.abs(change));
  if (rounded === 0) return "No change";
  return `${change > 0 ? "↑" : "↓"} ${rounded}%`;
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border/70 bg-background/40 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px]">{detail}</p>
    </div>
  );
}
