"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  SessionRoleSheet,
  type SessionRoleTarget,
} from "@/components/admin/session-role-sheet";
import { formatDateTime, formatDuration, shortServerLabel } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type { RoleCode } from "@/types/permissions";
import type { FleetOverviewRecentSession, ServerStatsRange } from "@/types/profile";

const RANGES: { value: ServerStatsRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

const ROLE_LABELS: Record<RoleCode, string> = {
  USER: "User",
  FOUNDING_MEMBER: "Founding Member",
  VIP: "VIP",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  OWNER: "Owner",
};

type ServerOption = { id: string; shortName: string; name: string };

type AdminSessionsPanelProps = {
  canManageRoles?: boolean;
};

export function AdminSessionsPanel({ canManageRoles = false }: AdminSessionsPanelProps) {
  const searchParams = useSearchParams();
  const initialServerId = searchParams.get("serverId")?.trim() ?? "";

  const [range, setRange] = useState<ServerStatsRange>("7d");
  const [serverId, setServerId] = useState(initialServerId);
  const [activeOnly, setActiveOnly] = useState(false);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [sessions, setSessions] = useState<FleetOverviewRecentSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [roleTarget, setRoleTarget] = useState<SessionRoleTarget | null>(null);

  useEffect(() => {
    if (initialServerId) setServerId(initialServerId);
  }, [initialServerId]);

  useEffect(() => {
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/servers");
      const payload = await readJson<ServerOption[]>(res);
      if (payload.ok) {
        setServers(
          payload.data.map((s) => ({
            id: s.id,
            shortName: s.shortName,
            name: s.name,
          })),
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

  function applyRoleUpdate(next: SessionRoleTarget) {
    setRoleTarget((current) =>
      current && current.steamId === next.steamId ? next : current,
    );
    setSessions((current) =>
      current.map((session) =>
        session.steamId === next.steamId
          ? {
              ...session,
              personaName: next.personaName,
              avatarUrl: next.avatarUrl,
              role: next.role,
            }
          : session,
      ),
    );
  }

  const columns = canManageRoles ? 9 : 8;
  const serverNameById = new Map(servers.map((s) => [s.id, s.name || s.shortName]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="border-border bg-background focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-2"
          >
            <option value="">All servers</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
          <label className="border-border flex items-center gap-2 rounded-lg border px-2.5 text-sm">
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
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-border bg-secondary/40 text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Player</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Server</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Map</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Joined</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Left</th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Duration</th>
              <th
                className="px-3 py-2.5 font-medium sm:px-4 sm:py-3"
                title="How many players were online on this server when they joined"
              >
                At join
              </th>
              <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Role</th>
              {canManageRoles ? (
                <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={columns}
                  className="text-muted-foreground px-4 py-10 text-center"
                >
                  {pending ? "Loading…" : "No sessions for this filter."}
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="hover:bg-secondary/20">
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
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
                    className="text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3"
                    title={session.serverName ?? undefined}
                  >
                    {shortServerLabel(
                      session.serverName || serverNameById.get(session.serverId),
                    ) || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3">
                    {session.map ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap sm:px-4 sm:py-3">
                    {formatDateTime(session.joinedAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap sm:px-4 sm:py-3">
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
                  <td
                    className="text-muted-foreground px-3 py-2.5 whitespace-nowrap tabular-nums sm:px-4 sm:py-3"
                    title="How many players were online on this server when they joined"
                  >
                    {session.concurrentAtJoin != null ? session.concurrentAtJoin : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap sm:px-4 sm:py-3">
                    {session.role ? (
                      <span className="text-foreground">{ROLE_LABELS[session.role]}</span>
                    ) : (
                      <span className="text-muted-foreground">Unregistered</span>
                    )}
                  </td>
                  {canManageRoles ? (
                    <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRoleTarget({
                            steamId: session.steamId,
                            personaName: session.personaName,
                            avatarUrl: session.avatarUrl,
                            role: session.role,
                          })
                        }
                      >
                        Edit role
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canManageRoles ? (
        <SessionRoleSheet
          target={roleTarget}
          onClose={() => setRoleTarget(null)}
          onUpdated={applyRoleUpdate}
        />
      ) : null}
    </div>
  );
}
