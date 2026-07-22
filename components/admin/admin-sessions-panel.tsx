"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type {
  FleetOverviewRecentSession,
  ServerStatsRange,
} from "@/types/profile";

const RANGES: { value: ServerStatsRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

type ServerOption = { id: string; shortName: string };

export function AdminSessionsPanel() {
  const searchParams = useSearchParams();
  const initialServerId = searchParams.get("serverId")?.trim() ?? "";

  const [range, setRange] = useState<ServerStatsRange>("7d");
  const [serverId, setServerId] = useState(initialServerId);
  const [activeOnly, setActiveOnly] = useState(false);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [sessions, setSessions] = useState<FleetOverviewRecentSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialServerId) setServerId(initialServerId);
  }, [initialServerId]);

  useEffect(() => {
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/servers");
      const payload = await readJson<
        Array<{ id: string; shortName: string }>
      >(res);
      if (payload.ok) {
        setServers(
          payload.data.map((s) => ({ id: s.id, shortName: s.shortName })),
        );
      }
    });
  }, []);

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const params = new URLSearchParams({
        range,
        limit: "100",
      });
      if (serverId) params.set("serverId", serverId);
      if (activeOnly) params.set("active", "1");
      const res = await fetch(`/api/v1/admin/sessions?${params}`);
      const payload = await readJson<FleetOverviewRecentSession[]>(res);
      if (!payload.ok) {
        setError(payload.error);
        setSessions([]);
        return;
      }
      setSessions(payload.data);
    });
  }, [activeOnly, range, serverId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">All servers</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Live only
          </label>
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
            onClick={load}
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Server</th>
              <th className="px-4 py-3 font-medium">Map</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Left</th>
              <th className="px-4 py-3 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {pending ? "Loading…" : "No sessions for this filter."}
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
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
                    {session.serverName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {session.map ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(session.joinedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {session.active
                      ? "—"
                      : session.leftAt
                        ? formatDateTime(session.leftAt)
                        : formatDateTime(session.lastSeenAt)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 whitespace-nowrap",
                      session.active && "text-emerald-400",
                    )}
                  >
                    {formatDuration(session.durationMs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
