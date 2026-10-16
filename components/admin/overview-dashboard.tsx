"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Database,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiResult } from "@/lib/api/waitlist";
import type { ServersResponse } from "@/lib/servers/types";
import type { AuthUser } from "@/types/auth";
import type { AdminHealthResponse } from "@/types/profile";
import type { RoleCode } from "@/types/permissions";

type Props = {
  user: AuthUser;
  displayRole: RoleCode;
  canManageServers: boolean;
  canManageUsers: boolean;
};

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  return (await response.json()) as ApiResult<T>;
}

export function OverviewDashboard({
  user,
  displayRole,
  canManageServers,
  canManageUsers,
}: Props) {
  const [servers, setServers] = useState<ServersResponse["servers"]>([]);
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [serversResult, healthResult] = await Promise.allSettled([
      fetch("/api/servers", { cache: "no-store" }),
      fetch("/api/v1/admin/health", { cache: "no-store" }),
    ]);

    if (serversResult.status === "fulfilled" && serversResult.value.ok) {
      const payload = (await serversResult.value.json()) as ServersResponse;
      setServers(payload.servers ?? []);
      setError(null);
    } else {
      setError("Live server status is temporarily unavailable.");
    }

    if (healthResult.status === "fulfilled" && healthResult.value.ok) {
      const payload = await readJson<AdminHealthResponse>(healthResult.value);
      if (payload.ok) {
        setHealth(payload.data);
        setHealthError(false);
      } else {
        setHealth(null);
        setHealthError(true);
      }
    } else {
      setHealth(null);
      setHealthError(true);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const onlineServers = useMemo(
    () => servers.filter((server) => server.online),
    [servers],
  );
  const onlinePlayers = onlineServers.reduce(
    (total, server) => total + (server.players ?? 0),
    0,
  );
  const fleetCapacity = servers.reduce(
    (total, server) => total + (server.maxPlayers ?? 0),
    0,
  );

  const healthTone =
    health?.overall === "operational"
      ? "healthy"
      : health?.overall === "down"
        ? "down"
        : "degraded";
  const checkedAt = health
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(health.checkedAt))
    : null;

  return (
    <div className="max-w-12xl mx-auto w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
            {displayRole} workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {user.personaName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your operational home. For growth and historical trends, open Analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/admin/analytics" />} size="sm" className="gap-2">
            <Activity className="size-3.5" data-icon="inline-start" />
            View Analytics
            <ArrowRight className="size-3.5" data-icon="inline-end" />
          </Button>
          {canManageServers ? (
            <Button
              render={<Link href="/admin/servers?new=1" />}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Add server
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh operational status"
            title="Refresh status"
            disabled={refreshing}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <CircleAlert className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={<Users className="size-4" />}
          label="Live players"
          value={loading ? "—" : `${onlinePlayers} / ${fleetCapacity || "—"}`}
          detail={`Across ${onlineServers.length} online server(s)`}
          tone="red"
        />
        <StatusCard
          icon={<Server className="size-4" />}
          label="Game servers"
          value={loading ? "—" : `${onlineServers.length} / ${servers.length}`}
          detail={servers.length ? "Enabled server fleet" : "No registered servers"}
          tone={onlineServers.length === servers.length ? "green" : "amber"}
        />
        <StatusCard
          icon={<ShieldCheck className="size-4" />}
          label="Platform health"
          value={
            health
              ? health.overall === "operational"
                ? "Operational"
                : health.overall === "degraded"
                  ? "Degraded"
                  : "Down"
              : healthError
                ? "Unavailable"
                : "Checking…"
          }
          detail={checkedAt ? `Checked ${checkedAt} IST` : "System health checks"}
          tone={healthTone}
        />
        <StatusCard
          icon={<Wifi className="size-4" />}
          label="Status refresh"
          value="30 sec"
          detail="Operational status only · analytics are separate"
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="border-border bg-card/40 min-w-0 rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Server status</h2>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Current A2S status · refreshed every 30 seconds
              </p>
            </div>
            <Link
              href="/admin/servers"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Manage fleet →
            </Link>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {servers.length ? (
              servers.map((server) => (
                <article
                  key={server.id}
                  className="border-border/80 bg-background/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        server.online
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400",
                      )}
                    >
                      <Server className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {server.shortName || server.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                        {server.online
                          ? `${server.map ?? "Map unknown"} · ${server.players ?? "—"}/${server.maxPlayers ?? "—"} players`
                          : "Currently unreachable"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate font-mono text-[9px]">
                        {server.ip}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-[9px] font-bold tracking-wide uppercase",
                      server.online
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-rose-500/10 text-rose-400",
                    )}
                  >
                    {server.online ? "Online" : "Offline"}
                  </span>
                </article>
              ))
            ) : (
              <p className="text-muted-foreground col-span-full py-8 text-center text-sm">
                {loading ? "Loading server status…" : "No servers are registered."}
              </p>
            )}
          </div>
        </section>

        <section className="border-border bg-card/40 rounded-xl border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="text-sm font-semibold">System checks</h2>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              Connectivity and service health
            </p>
          </div>
          <ul className="divide-border/60 divide-y">
            {(health?.checks ?? []).map((check) => (
              <li key={check.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    check.status === "ok" && "bg-emerald-400",
                    check.status === "degraded" && "bg-amber-400",
                    check.status === "down" && "bg-rose-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{check.label}</p>
                    <span className="text-muted-foreground text-[10px]">
                      {check.value}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    {check.detail}
                  </p>
                </div>
              </li>
            ))}
            {!health ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-xs">
                {healthError
                  ? "System checks are unavailable."
                  : "Loading system checks…"}
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="border-border bg-card/40 rounded-xl border p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Quick access</h2>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Operational tools and detailed analytics
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/admin/analytics"
            title="Analytics"
            detail="Growth, retention & revenue"
            icon={<Activity className="size-4" />}
          />
          <QuickLink
            href="/admin/sessions"
            title="Sessions"
            detail="Recent player connections"
            icon={<Wifi className="size-4" />}
          />
          {canManageUsers ? (
            <QuickLink
              href="/admin/players"
              title="Players"
              detail="Player directory & roles"
              icon={<Users className="size-4" />}
            />
          ) : null}
          {canManageServers ? (
            <QuickLink
              href="/admin/vip-bundles"
              title="VIP & subscriptions"
              detail="Plans and server bundles"
              icon={<Database className="size-4" />}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "red" | "green" | "amber" | "blue" | "degraded" | "down" | "healthy";
}) {
  const tones = {
    red: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    blue: "bg-sky-500/10 text-sky-400",
    healthy: "bg-emerald-500/10 text-emerald-400",
    degraded: "bg-amber-500/10 text-amber-400",
    down: "bg-rose-500/10 text-rose-400",
  }[tone];
  return (
    <article className="border-border bg-card/45 flex items-start gap-3 rounded-xl border p-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tones,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-[9px]">{detail}</p>
      </div>
    </article>
  );
}

function QuickLink({
  href,
  title,
  detail,
  icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="border-border/80 bg-background/30 hover:border-primary/40 hover:bg-secondary/40 group flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 transition-colors"
    >
      <span className="text-muted-foreground group-hover:text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{title}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[9px]">
          {detail}
        </span>
      </span>
      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
    </Link>
  );
}
