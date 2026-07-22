"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResult } from "@/lib/api/waitlist";
import type {
  ResolvedPermissions,
  RoleCode,
  RoleSource,
} from "@/types/permissions";

type SearchUser = {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  role: RoleCode;
  lastLoginAt: string;
  createdAt: string;
};

const GRANTABLE_ROLES: RoleCode[] = [
  "VIP",
  "FOUNDING_MEMBER",
  "MODERATOR",
  "ADMIN",
  "OWNER",
];

const SOURCES: RoleSource[] = [
  "MANUAL",
  "PROMOTION",
  "FOUNDING",
  "GIVEAWAY",
  "TOURNAMENT",
  "PURCHASE",
  "SYSTEM",
];

type ExpiryPreset = "never" | "30" | "90" | "custom";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function AdminDashboard() {
  const searchParams = useSearchParams();
  const initialSteamId = searchParams.get("steamId")?.trim() ?? "";

  const [query, setQuery] = useState(initialSteamId);
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<ResolvedPermissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [roleCode, setRoleCode] = useState<RoleCode>("VIP");
  const [source, setSource] = useState<RoleSource>("MANUAL");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [customExpiry, setCustomExpiry] = useState("");

  const selectUser = useCallback((steamId: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/users?steamId=${encodeURIComponent(steamId)}`,
      );
      const payload = await readJson<ResolvedPermissions>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data);
    });
  }, []);

  useEffect(() => {
    if (initialSteamId) {
      selectUser(initialSteamId);
    }
  }, [initialSteamId, selectUser]);

  function search() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/v1/users?q=${encodeURIComponent(query)}`);
      const payload = await readJson<SearchUser[]>(res);
      if (!payload.ok) {
        setError(payload.error);
        setResults([]);
        return;
      }
      setResults(payload.data);
    });
  }

  function resolveExpiresAt(): string | null {
    if (expiryPreset === "never") return null;
    if (expiryPreset === "30") {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (expiryPreset === "90") {
      return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (!customExpiry) return null;
    return new Date(`${customExpiry}T23:59:59.000Z`).toISOString();
  }

  function grant() {
    if (!selected) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selected.userId,
          roleCode,
          source,
          expiresAt: resolveExpiresAt(),
        }),
      });
      const payload = await readJson<ResolvedPermissions>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data);
      setMessage(`Granted ${roleCode}.`);
    });
  }

  function revoke(assignmentId: string, code: RoleCode) {
    if (!selected) return;
    if (code === "USER") return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/revoke-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selected.userId,
          userRoleId: assignmentId,
        }),
      });
      const payload = await readJson<ResolvedPermissions>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data);
      setMessage(`Revoked ${code}.`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SteamID or username"
              onKeyDown={(e) => {
                if (e.key === "Enter") search();
              }}
            />
            <Button
              type="button"
              onClick={search}
              disabled={pending || !query.trim()}
            >
              Search
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                No results yet. Search by SteamID64 or persona name.
              </li>
            ) : (
              results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => selectUser(user.steamId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-full"
                      />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs">
                        {user.personaName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user.personaName}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {user.steamId}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.role}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card/40 p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Select a user to view roles and permissions.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                {selected.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.avatarUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 rounded-full"
                  />
                ) : null}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">
                    {selected.personaName}
                  </h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    {selected.steamId}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Display role:{" "}
                    <span className="text-foreground">
                      {selected.displayRole}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Active roles</h3>
                <ul className="space-y-2">
                  {selected.activeAssignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{a.roleCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.source}
                          {a.expiresAt
                            ? ` · expires ${formatDate(a.expiresAt)}`
                            : " · never expires"}
                        </p>
                      </div>
                      {a.roleCode !== "USER" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => revoke(a.id, a.roleCode)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Effective permissions
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selected.permissions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">None</span>
                  ) : (
                    selected.permissions.map((code) => (
                      <span
                        key={code}
                        className="rounded-md bg-secondary px-2 py-1 font-mono text-[0.7rem] text-muted-foreground"
                      >
                        {code}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Grant role</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value as RoleCode)}
                      className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {GRANTABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="source">Source</Label>
                    <select
                      id="source"
                      value={source}
                      onChange={(e) => setSource(e.target.value as RoleSource)}
                      className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry">Expiry</Label>
                    <select
                      id="expiry"
                      value={expiryPreset}
                      onChange={(e) =>
                        setExpiryPreset(e.target.value as ExpiryPreset)
                      }
                      className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <option value="never">Never</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="custom">Custom date</option>
                    </select>
                  </div>
                  {expiryPreset === "custom" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="customExpiry">Custom date</Label>
                      <Input
                        id="customExpiry"
                        type="date"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
                <Button type="button" onClick={grant} disabled={pending}>
                  Grant
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="text-sm text-muted-foreground">
        Role changes are recorded in the{" "}
        <Link
          href="/admin/audit"
          className="text-foreground underline-offset-4 hover:underline"
        >
          audit log
        </Link>
        .
      </p>
    </div>
  );
}
