"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Copy,
  CreditCard,
  Gamepad2,
  Gauge,
  Megaphone,
  RefreshCw,
  Server,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { formatDuration, mapThumbPath, shortServerLabel } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type { AdminAnalyticsRange, FleetOverviewResponse } from "@/types/profile";

const RANGE_OPTIONS: { value: Exclude<AdminAnalyticsRange, "custom">; label: string }[] =
  [
    { value: "1d", label: "1D" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
  ];

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

type Props = { canManageServers: boolean };
type ActivityMetric = "players" | "sessions" | "playtime" | "concurrent";
type RetentionMetric = "d1" | "d7" | "d30";

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  return (await response.json()) as ApiResult<T>;
}

function istDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function percent(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function deltaLabel(
  value: number,
  previous: number,
  available: boolean,
): {
  text: string;
  positive: boolean | null;
} {
  if (!available) return { text: "Comparison unavailable", positive: null };
  if (previous === 0) {
    return value === 0
      ? { text: "No change", positive: null }
      : { text: "No previous activity", positive: null };
  }
  const delta = ((value - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(Math.abs(delta));
  if (rounded === 0) return { text: "No change vs previous period", positive: null };
  return {
    text: `${rounded}% vs previous period`,
    positive: delta > 0,
  };
}

export function AnalyticsDashboard({ canManageServers }: Props) {
  const [range, setRange] = useState<AdminAnalyticsRange>("7d");
  const [customOpen, setCustomOpen] = useState(false);
  const [customStartDraft, setCustomStartDraft] = useState("");
  const [customEndDraft, setCustomEndDraft] = useState("");
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [data, setData] = useState<FleetOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [metric, setMetric] = useState<ActivityMetric>("players");
  const [retentionMetric, setRetentionMetric] = useState<RetentionMetric>("d1");
  const [copiedServer, setCopiedServer] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const yesterday = shiftDateKey(istDateKey(new Date()), -1);
  const sevenDaysAgo = shiftDateKey(yesterday, -6);

  useEffect(() => {
    if (!customStartDraft) setCustomStartDraft(sevenDaysAgo);
    if (!customEndDraft) setCustomEndDraft(yesterday);
  }, [customEndDraft, customStartDraft, sevenDaysAgo, yesterday]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ range });
    if (range === "custom" && customRange) {
      params.set("start", customRange.start);
      params.set("end", customRange.end);
    }

    setLoading(true);
    setError(null);
    fetch(`/api/v1/admin/analytics?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => readJson<FleetOverviewResponse>(response))
      .then((result) => {
        if (!result.ok) {
          setData(null);
          setError(result.error);
          return;
        }
        setData(result.data);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setData(null);
        setError("Analytics could not be loaded. Try refreshing the page.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [customRange, range, reloadToken]);

  const enabledServers = useMemo(
    () => (data?.servers ?? []).filter((server) => server.enabled),
    [data?.servers],
  );
  function selectRange(next: Exclude<AdminAnalyticsRange, "custom">) {
    setError(null);
    setRange(next);
    setCustomOpen(false);
  }

  function applyCustomRange() {
    if (!customStartDraft || !customEndDraft) return;
    if (customStartDraft > customEndDraft || customEndDraft > yesterday) {
      setError("Choose a valid completed date range in IST.");
      return;
    }
    const days =
      (new Date(`${customEndDraft}T00:00:00Z`).getTime() -
        new Date(`${customStartDraft}T00:00:00Z`).getTime()) /
        86_400_000 +
      1;
    if (days > 90) {
      setError("Custom ranges are limited to 90 completed days.");
      return;
    }
    setError(null);
    setCustomRange({ start: customStartDraft, end: customEndDraft });
    setRange("custom");
    setCustomOpen(false);
  }

  async function copyAddress(serverId: string, address: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(address);
      setCopiedServer(serverId);
      window.setTimeout(
        () => setCopiedServer((current) => (current === serverId ? null : current)),
        1600,
      );
    } catch {
      setCopyError("Clipboard access is unavailable in this browser.");
    }
  }

  const metricComparison = data?.previousPeriod.available ?? false;
  const hasSessionCoverage = data?.dataQuality.sessionCoverageAvailable ?? false;
  const retentionValue = data
    ? retentionMetric === "d1"
      ? data.retention.d1Percent
      : retentionMetric === "d7"
        ? data.retention.d7Percent
        : data.retention.d30Percent
    : null;
  const retentionCohortSize = data
    ? retentionMetric === "d1"
      ? data.retention.d1CohortPlayers
      : retentionMetric === "d7"
        ? data.retention.d7CohortPlayers
        : data.retention.d30CohortPlayers
    : 0;
  const previousRetentionValue = data
    ? retentionMetric === "d1"
      ? data.previousPeriod.d1RetentionPercent
      : retentionMetric === "d7"
        ? data.previousPeriod.d7RetentionPercent
        : data.previousPeriod.d30RetentionPercent
    : null;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-2xl">Analytics</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed sm:text-sm">
            Deep insights into your CS2 retake servers. Track player activity, retention,
            server performance and revenue.
          </p>
          <p className="text-muted-foreground mt-1 text-[12px]">
            {data?.period.label ?? "Complete IST calendar days"} · Asia/Kolkata (IST) ·
            current day excluded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div
            className="border-border bg-card/60 flex rounded-lg border p-0.5"
            aria-label="Analytics date range"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                onClick={() => selectRange(option.value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors",
                  range === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Button
              type="button"
              variant={range === "custom" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-2 text-[13px]"
              aria-expanded={customOpen}
              onClick={() => setCustomOpen((open) => !open)}
            >
              <CalendarDays className="size-3.5" />
              {range === "custom" && customRange
                ? `${dateLabel(customRange.start)} – ${dateLabel(customRange.end)}`
                : "Custom"}
            </Button>
            {customOpen ? (
              <div className="border-border bg-popover absolute right-0 z-30 mt-2 w-[17rem] rounded-xl border p-3 shadow-xl">
                <p className="text-xs font-semibold">Custom date range</p>
                <p className="text-muted-foreground mt-1 text-[12px]">
                  Completed calendar days in IST, up to 90 days.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-muted-foreground space-y-1 text-[12px]">
                    Start
                    <input
                      type="date"
                      value={customStartDraft}
                      max={customEndDraft || yesterday}
                      onChange={(event) => setCustomStartDraft(event.target.value)}
                      className="border-border bg-background text-foreground h-8 w-full rounded-md border px-2 text-xs"
                    />
                  </label>
                  <label className="text-muted-foreground space-y-1 text-[12px]">
                    End
                    <input
                      type="date"
                      value={customEndDraft}
                      min={customStartDraft || undefined}
                      max={yesterday}
                      onChange={(event) => setCustomEndDraft(event.target.value)}
                      className="border-border bg-background text-foreground h-8 w-full rounded-md border px-2 text-xs"
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={applyCustomRange}
                >
                  Apply range
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError(null);
              if (range === "custom") setRange("7d");
              else setReloadToken((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {data?.dataQuality &&
      (!data.dataQuality.sessionCoverageComplete ||
        data.dataQuality.excludedLongSessions > 0 ||
        !data.dataQuality.concurrencyExact) ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-100/90">
          <strong>Data limitations:</strong>{" "}
          {!data.dataQuality.sessionCoverageComplete
            ? `Session history covers only about ${data.dataQuality.sessionCoverageDays} of ${data.period.range === "custom" ? "selected" : data.period.range} days within the ${data.dataQuality.sessionRetentionDays}-day TTL. Older sessions have expired; unmatched time is not treated as zero. `
            : ""}
          {data.dataQuality.excludedLongSessions > 0
            ? `${data.dataQuality.excludedLongSessions} session records over 12 hours were excluded from interval-based playtime/concurrency. `
            : ""}
          {!data.dataQuality.concurrencyExact
            ? `${data.dataQuality.overlappingSessions} overlapping session(s) were de-duplicated; ${data.dataQuality.overCapacityIntervals} over-capacity interval(s) and ${data.dataQuality.unknownCapacityServers} server(s) with unknown capacity were found.`
            : ""}
        </div>
      ) : null}

      <section
        aria-label="Analytics key performance indicators"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7"
      >
        <KpiCard
          icon={<Users className="size-4" />}
          accent="red"
          label="Live Players"
          value={
            data
              ? `${data.summary.livePlayers} / ${data.summary.liveMaxPlayers || "—"}`
              : "—"
          }
          detail={`Across ${data?.summary.onlineServers ?? "—"} online server(s)`}
          loading={loading}
        />
        <KpiCard
          icon={<Users className="size-4" />}
          accent="violet"
          label="Unique Players"
          value={data && hasSessionCoverage ? String(data.summary.uniquePlayers) : "—"}
          comparison={
            data &&
            deltaLabel(
              data.summary.uniquePlayers,
              data.previousPeriod.uniquePlayers,
              metricComparison,
            )
          }
          detail="Distinct Steam players in the period"
          loading={loading}
        />
        <KpiCard
          icon={<Activity className="size-4" />}
          accent="cyan"
          label="New Players"
          value={data && hasSessionCoverage ? String(data.summary.newPlayers) : "—"}
          comparison={
            data &&
            deltaLabel(
              data.summary.newPlayers,
              data.previousPeriod.newPlayers,
              metricComparison,
            )
          }
          detail="First-ever recorded players"
          loading={loading}
        />
        <KpiCard
          icon={<Users className="size-4" />}
          accent="blue"
          label="Returning Players"
          value={data && hasSessionCoverage ? String(data.summary.returningPlayers) : "—"}
          comparison={
            data &&
            deltaLabel(
              data.summary.returningPlayers,
              data.previousPeriod.returningPlayers,
              metricComparison,
            )
          }
          detail={
            data?.summary.unclassifiedPlayers
              ? `${data.summary.unclassifiedPlayers} unclassified`
              : "Seen before this period"
          }
          loading={loading}
        />
        <KpiCard
          icon={<RefreshCw className="size-4" />}
          accent="blue"
          label="Sessions"
          value={data && hasSessionCoverage ? String(data.summary.totalSessions) : "—"}
          comparison={
            data &&
            deltaLabel(
              data.summary.totalSessions,
              data.previousPeriod.totalSessions,
              metricComparison,
            )
          }
          detail="Connection stretches, not visits"
          loading={loading}
        />
        <KpiCard
          icon={<Clock3 className="size-4" />}
          accent="violet"
          label="Total Playtime"
          value={
            data && hasSessionCoverage
              ? formatDuration(data.summary.totalPlayTimeMs)
              : "—"
          }
          comparison={
            data &&
            deltaLabel(
              data.summary.totalPlayTimeMs,
              data.previousPeriod.totalPlayTimeMs,
              metricComparison,
            )
          }
          detail="De-duplicated player time"
          loading={loading}
        />
        <KpiCard
          icon={<Clock3 className="size-4" />}
          accent="red"
          label="Average Session"
          value={
            data && hasSessionCoverage ? formatDuration(data.summary.avgSessionMs) : "—"
          }
          comparison={
            data &&
            deltaLabel(
              data.summary.avgSessionMs,
              data.previousPeriod.avgSessionMs,
              metricComparison,
            )
          }
          detail="Stored session record; reconnects may split visits"
          loading={loading}
        />
      </section>

      {!data && loading ? (
        <div className="grid gap-2 xl:grid-cols-3" aria-label="Loading analytics">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              key={index}
              className="bg-card/70 border-border/70 h-48 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-2 xl:grid-cols-3 2xl:grid-cols-12">
            <Panel title="Player Activity" className="xl:col-span-1 2xl:col-span-5">
              <ActivityChart data={data} metric={metric} onMetricChange={setMetric} />
            </Panel>
            <Panel
              title="Hourly Player Heatmap (IST)"
              className="xl:col-span-1 2xl:col-span-4"
              subtitle="Recorded session starts aggregated by weekday and hour"
            >
              {hasSessionCoverage ? (
                <ActivityHeatmap data={data.activityHeatmap} />
              ) : (
                <EmptyState
                  title="Session history is outside retention"
                  detail="There are no retained intervals for the selected range, so zero activity cannot be inferred."
                />
              )}
            </Panel>
            <Panel
              title="Concurrent Players"
              className="xl:col-span-1 2xl:col-span-3"
              info="Time-weighted interval concurrency. Daily peak is capacity-clamped; warning above explains gaps and anomalies."
              action={
                <div className="border-border flex rounded-md border p-0.5">
                  {(["7d", "30d"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={range === preset}
                      onClick={() => selectRange(preset)}
                      className={cn(
                        "rounded px-2 py-1 text-[12px] font-semibold",
                        range === preset
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {preset.toUpperCase()}
                    </button>
                  ))}
                </div>
              }
            >
              <ConcurrencyChart daily={data.daily} />
            </Panel>
          </div>

          <div className="grid gap-2 xl:grid-cols-3 2xl:grid-cols-12">
            <Panel title="Retention" className="2xl:col-span-4">
              <RetentionPanel
                data={data}
                selected={retentionMetric}
                onSelect={setRetentionMetric}
                value={retentionValue}
                cohortSize={retentionCohortSize}
                previousValue={previousRetentionValue}
              />
            </Panel>
            <Panel title="New vs Returning Players" className="2xl:col-span-4">
              <PlayerMix data={data} />
            </Panel>
            <Panel
              title="Session Duration"
              className="2xl:col-span-4"
              subtitle="Individual connection records; not merged into visits"
            >
              <DurationDistribution
                buckets={data.durationBuckets}
                available={hasSessionCoverage}
              />
            </Panel>
          </div>

          <div className="grid gap-2 xl:grid-cols-3 2xl:grid-cols-12">
            <Panel
              title="Server Performance"
              className="2xl:col-span-4"
              action={
                <Link
                  href="/admin/servers"
                  className="text-[12px] text-sky-300 hover:text-sky-200"
                >
                  View all servers →
                </Link>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {enabledServers.length ? (
                  enabledServers.map((server) => {
                    const analytics = data.serverAnalytics.find(
                      (item) => item.id === server.id,
                    );
                    return (
                      <ServerCard
                        key={server.id}
                        server={server}
                        analytics={analytics}
                        canManageServers={canManageServers}
                        hasSessionCoverage={hasSessionCoverage}
                        copied={copiedServer === server.id}
                        onCopy={() =>
                          copyAddress(server.id, `${server.host}:${server.port}`)
                        }
                      />
                    );
                  })
                ) : (
                  <EmptyState
                    title="No enabled servers"
                    detail="Add or enable a game server to see performance here."
                  />
                )}
              </div>
              {copyError ? (
                <p role="status" className="text-destructive mt-2 text-[12px]">
                  {copyError}
                </p>
              ) : null}
            </Panel>

            <Panel
              title={`Server Utilization (${range === "custom" ? "Custom range" : range.toUpperCase()})`}
              className="2xl:col-span-4"
            >
              <UtilizationPanel data={data} servers={enabledServers} />
            </Panel>

            <Panel
              title="Top Maps by Playtime"
              className="2xl:col-span-4"
              action={
                <select
                  aria-label="Map table date range"
                  value={range === "custom" ? "custom" : range}
                  onChange={(event) => {
                    if (event.target.value !== "custom")
                      selectRange(
                        event.target.value as Exclude<AdminAnalyticsRange, "custom">,
                      );
                  }}
                  className="border-border bg-background h-7 rounded-md border px-2 text-[12px]"
                >
                  <option value="1d">Last day</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  {range === "custom" ? (
                    <option value="custom">Custom range</option>
                  ) : null}
                </select>
              }
            >
              <EmptyState
                icon={<Gamepad2 className="size-5" />}
                title="Map playtime is unavailable"
                detail="Session records retain only the latest map snapshot, not the time spent on each map. Showing a ranked playtime table would be misleading."
              />
            </Panel>
          </div>

          <div className="grid gap-2 xl:grid-cols-3 2xl:grid-cols-12">
            <Panel title="Revenue & Conversions" className="2xl:col-span-6" id="revenue">
              <RevenuePanel data={data} />
            </Panel>
            <Panel title="VIP Sales by Plan" className="2xl:col-span-3">
              <VipPlanPanel data={data} />
            </Panel>
            <Panel title="Player Acquisition" className="2xl:col-span-3" id="acquisition">
              <EmptyState
                icon={<Megaphone className="size-5" />}
                title="Acquisition sources aren’t tracked"
                detail="Server joins have no UTM or self-reported source field. Historical players cannot be attributed retroactively."
              />
            </Panel>
          </div>
        </>
      ) : !loading && !error ? (
        <EmptyState
          title="Analytics unavailable"
          detail="No analytics response was returned for this period."
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  icon,
  accent,
  label,
  value,
  detail,
  comparison,
  loading,
}: {
  icon: React.ReactNode;
  accent: "red" | "violet" | "cyan" | "blue";
  label: string;
  value: string;
  detail: string;
  comparison?: { text: string; positive: boolean | null } | null;
  loading: boolean;
}) {
  const accentClass = {
    red: "bg-primary/15 text-primary",
    violet: "bg-violet-500/15 text-violet-300",
    cyan: "bg-cyan-500/15 text-cyan-300",
    blue: "bg-blue-500/15 text-blue-300",
  }[accent];
  return (
    <article className="border-border/80 bg-card/65 min-w-0 rounded-xl border px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            accentClass,
          )}
        >
          {icon}
        </span>
        <p className="text-muted-foreground truncate text-[12px] font-medium">{label}</p>
      </div>
      <p
        className={cn(
          "mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums",
          loading && "text-muted-foreground animate-pulse",
        )}
      >
        {loading ? "···" : value}
      </p>
      <div className="mt-1 min-h-7">
        {comparison ? (
          <Comparison text={comparison.text} positive={comparison.positive} />
        ) : null}
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug">
          {detail}
        </p>
      </div>
    </article>
  );
}

function Comparison({ text, positive }: { text: string; positive: boolean | null }) {
  const Icon = positive === false ? ArrowDownRight : ArrowUpRight;
  return (
    <p
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        positive === true
          ? "text-emerald-400"
          : positive === false
            ? "text-rose-400"
            : "text-muted-foreground",
      )}
    >
      {positive == null ? null : <Icon className="size-3" />}
      {text}
    </p>
  );
}

function Panel({
  title,
  subtitle,
  info,
  action,
  className,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  info?: string;
  action?: React.ReactNode;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "border-border/80 bg-card/45 min-w-0 scroll-mt-16 rounded-xl border p-3",
        className,
      )}
    >
      <div className="mb-3 flex min-h-5 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
            {info ? (
              <span
                tabIndex={0}
                role="note"
                title={info}
                aria-label={info}
                className="text-muted-foreground focus-visible:outline-primary cursor-help rounded text-[12px] focus-visible:outline-2"
              >
                ⓘ
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ActivityChart({
  data,
  metric,
  onMetricChange,
}: {
  data: FleetOverviewResponse;
  metric: ActivityMetric;
  onMetricChange: (value: ActivityMetric) => void;
}) {
  const metrics: { key: ActivityMetric; label: string }[] = [
    { key: "players", label: "Unique Players" },
    { key: "sessions", label: "Sessions" },
    { key: "playtime", label: "Playtime" },
    { key: "concurrent", label: "Avg. Concurrent" },
  ];
  const rows = data.daily.map((day) => ({
    date: day.date,
    uniquePlayers: day.complete ? day.uniquePlayers : null,
    returningPlayers: day.complete ? day.returningPlayers : null,
    sessions: day.complete ? day.sessions : null,
    playtimeHours: day.complete ? day.playTimeMs / 3_600_000 : null,
    avgConcurrent: day.complete ? day.avgConcurrent : null,
  }));
  const key =
    metric === "players"
      ? "uniquePlayers"
      : metric === "sessions"
        ? "sessions"
        : metric === "playtime"
          ? "playtimeHours"
          : "avgConcurrent";
  const label = metrics.find((item) => item.key === metric)?.label ?? "Activity";

  return (
    <div>
      <div
        className="mb-2 flex flex-wrap gap-1"
        role="tablist"
        aria-label="Player activity metric"
      >
        {metrics.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={metric === item.key}
            onClick={() => onMetricChange(item.key)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium",
              metric === item.key
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {metric === "players" ? (
        <div className="text-muted-foreground mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <Legend color="bg-primary" label="Unique players" />
          <Legend color="bg-sky-400" label="Returning players (subset)" />
          <Legend color="bg-white" label="Avg concurrent" />
        </div>
      ) : null}
      <div
        className="h-[190px] w-full"
        role="img"
        aria-label={`${label} by complete IST day`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: metric === "players" ? 0 : 8, bottom: 0, left: -18 }}
          >
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dateLabel}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fill: "#9aa3ad", fontSize: 11 }}
              axisLine={{ stroke: "rgba(148,163,184,.2)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              allowDecimals={metric === "playtime" || metric === "concurrent"}
              tickFormatter={(value: number) =>
                metric === "playtime" ? `${value}h` : String(value)
              }
              tick={{ fill: "#8290a0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={[0, "auto"]}
            />
            {metric === "players" ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals
                tickFormatter={(value: number) => Number(value).toFixed(1)}
                tick={{ fill: "#8290a0", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={34}
                domain={[0, "auto"]}
              />
            ) : null}
            <Tooltip
              labelFormatter={(value) => `${dateLabel(String(value))} · IST`}
              formatter={(value, name) => [
                metric === "playtime" && value != null
                  ? `${Number(value).toFixed(1)} hours`
                  : (value ?? "No retained data"),
                name,
              ]}
              contentStyle={{
                background: "#12151a",
                border: "1px solid #2a313c",
                borderRadius: 8,
                fontSize: 10,
              }}
              labelStyle={{ color: "#f3f5f7" }}
            />
            {metric === "players" ? (
              <>
                <Bar
                  yAxisId="left"
                  dataKey="uniquePlayers"
                  name="Unique players"
                  fill="#e8242a"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="left"
                  dataKey="returningPlayers"
                  name="Returning players (subset)"
                  fill="#28a8d8"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="avgConcurrent"
                  name="Avg concurrent"
                  type="monotone"
                  stroke="#f3f5f7"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: "#f3f5f7" }}
                  activeDot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <Bar
                yAxisId="left"
                dataKey={key}
                name={label}
                fill={metric === "concurrent" ? "#28a8d8" : "#e8242a"}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Incomplete retained-history days are omitted, not rendered as zero. Playtime
        excludes sessions over 12 hours.
      </p>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: FleetOverviewResponse["activityHeatmap"] }) {
  const maximum = Math.max(
    1,
    ...data.map((cell) => cell.sessionStarts / Math.max(1, cell.occurrenceDays)),
  );
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[540px] grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-[3px]">
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={hour}
              className="text-muted-foreground text-center text-[10px] tabular-nums"
            >
              {hour % 2 === 0 ? String(hour).padStart(2, "0") : ""}
            </span>
          ))}
          {WEEKDAYS.map((day) => (
            <div key={day.value} className="contents">
              <span className="text-muted-foreground flex items-center text-[11px]">
                {day.label}
              </span>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = data.find(
                  (item) => item.dayOfWeek === day.value && item.hour === hour,
                );
                const average = cell
                  ? cell.sessionStarts / Math.max(1, cell.occurrenceDays)
                  : 0;
                const intensity = average / maximum;
                return (
                  <span
                    tabIndex={0}
                    role="img"
                    key={`${day.value}-${hour}`}
                    aria-label={`${day.label} ${String(hour).padStart(2, "0")}:00 IST`}
                    className="bg-primary aspect-square min-w-0 rounded-[2px]"
                    style={{ opacity: average ? 0.12 + intensity * 0.82 : 0.06 }}
                    title={
                      cell
                        ? `${day.label} ${String(hour).padStart(2, "0")}:00 IST · ${cell.sessionStarts} session starts across ${cell.occurrenceDays} matching day(s) · ${cell.distinctPlayers} distinct players · average concurrency ${cell.avgConcurrent}`
                        : `${day.label} ${String(hour).padStart(2, "0")}:00 IST · no session starts`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="text-muted-foreground mt-3 flex items-center justify-between text-[11px]">
        <span>
          Session starts per matching weekday/hour · reconnects can create extra records
        </span>
        <span className="flex shrink-0 items-center gap-1">
          Low <i className="bg-primary/20 inline-block size-2 rounded-sm" />{" "}
          <i className="bg-primary inline-block size-2 rounded-sm" /> High
        </span>
      </div>
    </div>
  );
}

function ConcurrencyChart({ daily }: { daily: FleetOverviewResponse["daily"] }) {
  const rows = daily.map((day) => ({
    date: day.date,
    peak: day.complete ? day.peakConcurrent : null,
    average: day.complete ? day.avgConcurrent : null,
  }));
  return (
    <div>
      <div className="text-muted-foreground mb-2 flex gap-3 text-[11px]">
        <Legend color="bg-primary" label="Peak concurrency" />
        <Legend color="bg-sky-400" label="Time-weighted average" />
      </div>
      <div
        className="h-[180px] w-full"
        role="img"
        aria-label="Daily peak and time-weighted average concurrent players"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dateLabel}
              interval="preserveStartEnd"
              minTickGap={16}
              tick={{ fill: "#9aa3ad", fontSize: 11 }}
              axisLine={{ stroke: "rgba(148,163,184,.2)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals
              tick={{ fill: "#8290a0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
              domain={[0, "auto"]}
            />
            <Tooltip
              labelFormatter={(value) => `${dateLabel(String(value))} · IST`}
              formatter={(value, name) => [value ?? "No retained data", name]}
              contentStyle={{
                background: "#12151a",
                border: "1px solid #2a313c",
                borderRadius: 8,
                fontSize: 10,
              }}
              labelStyle={{ color: "#f3f5f7" }}
            />
            <Bar
              dataKey="peak"
              name="Peak concurrent"
              fill="#e8242a"
              radius={[3, 3, 0, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            />
            <Bar
              dataKey="average"
              name="Time-weighted average"
              fill="#28a8d8"
              radius={[3, 3, 0, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Incomplete retained-history days are omitted; anomalies are capacity-clamped and
        noted above.
      </p>
    </div>
  );
}

function RetentionPanel({
  data,
  selected,
  onSelect,
  value,
  cohortSize,
  previousValue,
}: {
  data: FleetOverviewResponse;
  selected: RetentionMetric;
  onSelect: (metric: RetentionMetric) => void;
  value: number | null;
  cohortSize: number;
  previousValue: number | null;
}) {
  const label =
    selected === "d1"
      ? "Day 1 Retention"
      : selected === "d7"
        ? "Day 7 Retention"
        : "Day 30 Retention";
  const difference =
    previousValue != null && value != null && data.previousPeriod.available
      ? value - previousValue
      : null;
  return (
    <div>
      <div className="flex gap-1" role="tablist" aria-label="Retention cohort window">
        {(["d1", "d7", "d30"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={selected === item}
            title={`${item.toUpperCase()} is the share of first-ever players who connected again on exactly that IST calendar day.`}
            onClick={() => onSelect(item)}
            className={cn(
              "rounded px-2.5 py-1 text-[12px] font-semibold",
              selected === item
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {percent(value)}
          </p>
          <p
            className="text-muted-foreground mt-1 text-[12px]"
            title="Share of first-ever players with a session on exactly the selected day after their cohort day."
          >
            {label} · n={cohortSize}
          </p>
        </div>
        <div className="text-right">
          {difference != null ? (
            <p
              className={cn(
                "text-xs font-semibold",
                difference > 0
                  ? "text-emerald-400"
                  : difference < 0
                    ? "text-rose-400"
                    : "text-muted-foreground",
              )}
            >
              {difference > 0 ? "+" : ""}
              {difference.toFixed(1)} pp
            </p>
          ) : (
            <p className="text-muted-foreground text-[12px]">—</p>
          )}
          <p className="text-muted-foreground text-[11px]">vs previous period</p>
        </div>
      </div>
      <div className="border-border/70 text-muted-foreground mt-4 border-t pt-3 text-[11px]">
        Exact IST return-day cohorts; immature cohorts excluded. D30 is unavailable when
        its return day is outside retained session history. TTL coverage:{" "}
        {data.dataQuality.sessionRetentionDays} days.
      </div>
    </div>
  );
}

function PlayerMix({ data }: { data: FleetOverviewResponse }) {
  if (!data.dataQuality.sessionCoverageAvailable) {
    return (
      <EmptyState
        title="Player mix unavailable"
        detail="The selected period is outside the retained session window; no new/returning split is inferred."
      />
    );
  }
  const { newPlayers, returningPlayers, unclassifiedPlayers, uniquePlayers } =
    data.summary;
  const rows = [
    { name: "New players", value: newPlayers, color: "#e8242a" },
    { name: "Returning players", value: returningPlayers, color: "#28a8d8" },
    { name: "Unclassified", value: unclassifiedPlayers, color: "#64748b" },
  ].filter((item) => item.value > 0);
  const classifiedTotal = newPlayers + returningPlayers + unclassifiedPlayers;
  return (
    <div className="flex min-h-[160px] flex-wrap items-center justify-center gap-x-7 gap-y-3 py-1">
      {classifiedTotal ? (
        <div className="relative size-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="64%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {rows.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} player(s)`, name]}
                contentStyle={{
                  background: "#12151a",
                  border: "1px solid #2a313c",
                  borderRadius: 8,
                  fontSize: 10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-semibold tabular-nums">{uniquePlayers}</span>
            <span className="text-muted-foreground text-[11px]">Unique Players</span>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground border-border/80 flex size-32 items-center justify-center rounded-full border text-xs">
          No players
        </div>
      )}
      <div className="min-w-[9rem] space-y-2 text-[12px]">
        <MixLegend
          color="bg-primary"
          label="New players"
          count={newPlayers}
          total={classifiedTotal}
        />
        <MixLegend
          color="bg-sky-400"
          label="Returning players"
          count={returningPlayers}
          total={classifiedTotal}
        />
        {unclassifiedPlayers ? (
          <MixLegend
            color="bg-slate-500"
            label="Unclassified"
            count={unclassifiedPlayers}
            total={classifiedTotal}
          />
        ) : null}
        <p className="text-muted-foreground max-w-[12rem] pt-1 text-[11px]">
          First-seen groups are disjoint; unknown first-seen players are kept separate.
        </p>
      </div>
    </div>
  );
}

function MixLegend({
  color,
  label,
  count,
  total,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", color)} />
      <span className="text-muted-foreground min-w-0 flex-1">{label}</span>
      <span className="font-medium tabular-nums">
        {count} ({total ? Math.round((count / total) * 100) : 0}%)
      </span>
    </div>
  );
}

function DurationDistribution({
  buckets,
  available,
}: {
  buckets: FleetOverviewResponse["durationBuckets"];
  available: boolean;
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const rows = buckets.map((bucket) => ({
    ...bucket,
    percent: total ? (bucket.count / total) * 100 : 0,
  }));
  if (!available)
    return (
      <EmptyState
        title="Session history is outside retention"
        detail="Duration records for this range have expired."
      />
    );
  if (!total)
    return (
      <EmptyState
        title="No reliable duration data"
        detail="No in-range session records are available."
      />
    );
  return (
    <div>
      <div
        className="h-[175px] w-full"
        role="img"
        aria-label="Distribution of stored session durations"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 4, bottom: 2, left: -24 }}>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9aa3ad", fontSize: 10 }}
              interval={0}
              axisLine={{ stroke: "rgba(148,163,184,.2)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, "auto"]}
              tickFormatter={(value: number) => `${Math.round(value)}%`}
              tick={{ fill: "#8290a0", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as { count: number; percent: number };
                return (
                  <div className="border-border bg-popover text-popover-foreground rounded-md border px-2.5 py-2 text-[12px] shadow-lg">
                    <p className="font-medium">{String(label)}</p>
                    <p className="text-muted-foreground mt-0.5">
                      {row.count} sessions · {row.percent.toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="percent"
              name="Session share"
              fill="#e8242a"
              radius={[3, 3, 0, 0]}
              maxBarSize={30}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
        <span>{total} session records</span>
        <span>Reconnects may split visits</span>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Records over 12 hours are omitted as unreliable. These are sessions, not merged
        visits.
      </p>
    </div>
  );
}

function ServerCard({
  server,
  analytics,
  canManageServers,
  hasSessionCoverage,
  copied,
  onCopy,
}: {
  server: FleetOverviewResponse["servers"][number];
  analytics: FleetOverviewResponse["serverAnalytics"][number] | undefined;
  canManageServers: boolean;
  hasSessionCoverage: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const thumbnail = server.online ? mapThumbPath(server.map) : null;
  return (
    <article className="border-border/80 bg-background/40 min-w-0 overflow-hidden rounded-lg border">
      <div className="border-border/70 flex items-center justify-between gap-2 border-b px-2.5 py-2">
        <Link
          href={canManageServers ? `/admin/servers?edit=${server.id}` : "/servers"}
          className="hover:text-primary flex min-w-0 items-center gap-2"
        >
          <Server className="text-primary size-3.5 shrink-0" />
          <span className="truncate text-[12px] font-semibold">
            {server.shortName || shortServerLabel(server.name)}
          </span>
        </Link>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
            server.online
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-slate-500/10 text-slate-400",
          )}
        >
          {server.online ? "Online" : "Offline"}
        </span>
      </div>
      {thumbnail ? (
        // Existing map thumbnail mapping only; never constructs an address or asset path from user input.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt={`${server.map} map`}
          className="h-16 w-full object-cover opacity-70"
        />
      ) : (
        <div className="bg-secondary/40 flex h-16 items-center justify-center">
          <Gamepad2 className="text-muted-foreground size-5" />
        </div>
      )}
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground truncate">
            {server.online ? server.map : "Map unavailable while offline"}
          </span>
          <span className="shrink-0 tabular-nums">
            {server.online && server.players != null
              ? `${server.players}/${server.maxPlayers ?? "—"}`
              : "— / —"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono">
            {server.host}:{server.port}
          </span>
          {canManageServers ? (
            <button
              type="button"
              aria-label={`Copy ${server.shortName} address`}
              title={copied ? "Copied" : "Copy address"}
              onClick={onCopy}
              className="text-muted-foreground hover:text-foreground rounded p-1"
            >
              {copied ? (
                <span className="text-[10px] text-emerald-400">Copied</span>
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          ) : null}
        </div>
        <div className="border-border/70 grid grid-cols-3 border-t pt-2 text-center">
          <SmallServerStat
            value={
              hasSessionCoverage && analytics?.observedMs
                ? analytics.avgConcurrent.toFixed(1)
                : "—"
            }
            label="Avg players"
          />
          <SmallServerStat
            value={
              hasSessionCoverage && analytics?.observedMs
                ? String(analytics.peakConcurrent)
                : "—"
            }
            label="Peak players"
          />
          <SmallServerStat
            value="—"
            label="Uptime"
            title="Historical server uptime is unavailable: status snapshots expire after a short cache window."
          />
        </div>
      </div>
    </article>
  );
}

function SmallServerStat({
  value,
  label,
  title,
}: {
  value: string;
  label: string;
  title?: string;
}) {
  return (
    <div title={title} className="min-w-0 px-0.5">
      <p className="truncate text-[13px] font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground truncate text-[10px]">{label}</p>
    </div>
  );
}

function UtilizationPanel({
  data,
  servers,
}: {
  data: FleetOverviewResponse;
  servers: FleetOverviewResponse["servers"];
}) {
  if (!data.dataQuality.sessionCoverageAvailable) {
    return (
      <EmptyState
        title="Utilization unavailable"
        detail="No retained server-session intervals overlap this date range."
      />
    );
  }
  const enabledRows = servers
    .map((server) => ({
      id: server.id,
      label: shortServerLabel(server.shortName || server.name),
      bands: data.serverAnalytics.find((row) => row.id === server.id)?.utilization,
      observedMs:
        data.serverAnalytics.find((row) => row.id === server.id)?.observedMs ?? 0,
    }))
    .filter((row) => row.bands && row.observedMs > 0);
  const rows = [
    ...enabledRows,
    { id: "combined", label: "Combined fleet", bands: data.utilization },
  ];
  return (
    <div className="space-y-3 pt-1">
      {rows.map((row) =>
        row.bands ? (
          <StackedUtilizationRow key={row.id} label={row.label} bands={row.bands} />
        ) : null,
      )}
      <div className="border-border/70 text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-[10px]">
        <Legend color="bg-slate-500" label="Empty" />
        <Legend color="bg-sky-500" label="1–4" />
        <Legend color="bg-primary" label="5–9" />
        <Legend color="bg-rose-400" label="10+" />
      </div>
      <p className="text-muted-foreground text-[11px]">
        Time-weighted over each server’s configured lifetime in this range; bands sum to
        100% of observed time. Disabled/migrated IDs are excluded from individual rows.
      </p>
    </div>
  );
}

function StackedUtilizationRow({
  label,
  bands,
}: {
  label: string;
  bands: FleetOverviewResponse["utilization"];
}) {
  const segments = [
    {
      key: "emptyPercent",
      label: "Empty",
      value: bands.emptyPercent,
      color: "bg-slate-500",
    },
    {
      key: "oneToFourPercent",
      label: "1–4 players",
      value: bands.oneToFourPercent,
      color: "bg-sky-500",
    },
    {
      key: "fiveToNinePercent",
      label: "5–9 players",
      value: bands.fiveToNinePercent,
      color: "bg-primary",
    },
    {
      key: "tenPlusPercent",
      label: "10+ players",
      value: bands.tenPlusPercent,
      color: "bg-rose-400",
    },
  ];
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <span className="text-muted-foreground truncate text-[11px]" title={label}>
        {label}
      </span>
      <div className="bg-secondary/50 flex h-5 min-w-0 overflow-hidden rounded-sm">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.key}
              className={cn(
                "flex min-w-0 items-center justify-center text-[10px] font-semibold text-white",
                segment.color,
              )}
              style={{ width: `${segment.value}%` }}
              title={`${label} · ${segment.label}: ${segment.value.toFixed(1)}%`}
            >
              {segment.value >= 7 ? `${Math.round(segment.value)}%` : ""}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function RevenuePanel({ data }: { data: FleetOverviewResponse }) {
  const moneyMetrics = [
    {
      icon: <Wallet className="size-3.5" />,
      label: "Captured Revenue",
      value: formatInr(data.monetization.grossCapturedPaise),
      detail: `Refunds ${formatInr(data.monetization.refundsPaise)}`,
    },
    {
      icon: <CreditCard className="size-3.5" />,
      label: "Paying Customers",
      value: String(data.monetization.payingCustomers),
      detail: `${data.monetization.successfulPurchases} successful purchase(s)`,
    },
    {
      icon: <Gauge className="size-3.5" />,
      label: "Player → Paid",
      value: percent(data.monetization.playerToPayingPercent),
      detail:
        data.monetization.playerToPayingPercent == null
          ? "Requires complete player history"
          : `${data.monetization.payingActivePlayers} active players paid`,
    },
    {
      icon: <Users className="size-3.5" />,
      label: "Abandoned Checkouts",
      value: String(data.monetization.abandonedCheckouts),
      detail: "Created orders unpaid for 30+ minutes",
    },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {moneyMetrics.map((item) => (
          <div
            key={item.label}
            className="border-border/70 bg-background/35 min-w-0 rounded-lg border p-2.5"
          >
            <div className="text-primary flex items-center gap-1.5">
              <span>{item.icon}</span>
              <span className="text-muted-foreground truncate text-[11px]">
                {item.label}
              </span>
            </div>
            <p className="mt-2 truncate text-lg font-semibold tabular-nums">
              {item.value}
            </p>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Net after refunds:{" "}
        <span className="text-foreground">
          {formatInr(data.monetization.netRevenuePaise)}
        </span>{" "}
        · Fees are not recorded; operating costs are not configured, so break-even is
        unavailable. Free VIP is excluded.
      </p>
    </div>
  );
}

function VipPlanPanel({ data }: { data: FleetOverviewResponse }) {
  if (!data.monetization.successfulPurchases) {
    return (
      <EmptyState
        icon={<CreditCard className="size-5" />}
        title="No successful payments yet"
        detail="Revenue will appear here once players complete a purchase. Unpaid checkouts and free VIP grants are excluded."
      />
    );
  }
  return (
    <div className="space-y-2">
      {data.monetization.revenueByPlan.map((row) => (
        <div
          key={`${row.plan}:${row.accessType}`}
          className="border-border/70 flex items-center justify-between gap-3 border-b py-2 text-[12px] last:border-0"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.accessType === "ALL_RETAKES"
                ? "All Retakes bundle"
                : "Individual server"}
            </p>
            <p className="text-muted-foreground">
              {row.plan.replaceAll("_", " ")} · {row.purchases} purchase(s)
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums">{formatInr(row.grossPaise)}</p>
            <p className="text-muted-foreground text-[10px]">gross captured</p>
          </div>
        </div>
      ))}
      <p className="text-muted-foreground text-[11px]">
        Refunds: {formatInr(data.monetization.refundsPaise)} · monthly equivalent:{" "}
        {formatInr(data.monetization.monthlyEquivalentPaise)}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-[145px] flex-col items-center justify-center px-3 py-5 text-center">
      {icon ? (
        <span className="text-muted-foreground border-border/80 bg-background/40 mb-2 flex size-9 items-center justify-center rounded-full border">
          {icon}
        </span>
      ) : null}
      <p className="text-xs font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-[11px] leading-relaxed">
        {detail}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <i className={cn("size-2 rounded-[2px]", color)} />
      {label}
    </span>
  );
}
