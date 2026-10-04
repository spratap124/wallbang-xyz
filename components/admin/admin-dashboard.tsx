"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import { BADGE_LABELS } from "@/lib/profile/badges";
import type {
  ResolvedPermissions,
  RoleCode,
  RoleSource,
} from "@/types/permissions";
import { BADGE_TYPES, type BadgeType } from "@/types/profile";

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

type VipEntitlementAdminRow = {
  key: string;
  label: string;
  purchaseCount: number;
  expiresAt: string | null;
};

type VipServerOption = {
  id: string;
  label: string;
  hasAccess: boolean;
};

const ALL_RETAKES_KEY = "all_retakes";

function nextEntitlementKeys(keys: string[], key: string): string[] {
  if (key === ALL_RETAKES_KEY) {
    return keys.includes(ALL_RETAKES_KEY) ? [] : [ALL_RETAKES_KEY];
  }
  const withoutBundle = keys.filter((item) => item !== ALL_RETAKES_KEY);
  return withoutBundle.includes(key)
    ? withoutBundle.filter((item) => item !== key)
    : [...withoutBundle, key];
}

function VipServerPicker({
  servers,
  selectedKeys,
  onToggle,
}: {
  servers: VipServerOption[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  const allServersSelected = selectedKeys.includes(ALL_RETAKES_KEY);

  if (servers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No servers in the fleet registry.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
        <input
          type="checkbox"
          className="size-3.5 accent-foreground"
          checked={allServersSelected}
          onChange={() => onToggle(ALL_RETAKES_KEY)}
        />
        <span className="font-medium">All servers</span>
        <span className="text-xs text-muted-foreground">
          All Retakes Bundle · {servers.length} server
          {servers.length === 1 ? "" : "s"}
        </span>
      </label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {servers.map((server) => (
          <label
            key={server.id}
            className={`flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm ${
              allServersSelected ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              disabled={allServersSelected}
              checked={allServersSelected || selectedKeys.includes(server.id)}
              onChange={() => onToggle(server.id)}
            />
            <span className="min-w-0 flex-1 truncate">{server.label}</span>
            {server.hasAccess ? (
              <span className="text-xs text-muted-foreground">active</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}

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

const EXPIRY_PRESETS = [
  { value: "30", label: "30 days", days: 30 },
  { value: "60", label: "60 days", days: 60 },
  { value: "90", label: "90 days", days: 90 },
  { value: "180", label: "6 months", days: 180 },
  { value: "365", label: "1 year", days: 365 },
  { value: "lifetime", label: "Lifetime", days: null },
] as const;

type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"];

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
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
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("30");
  const [badgeType, setBadgeType] = useState<BadgeType>("VIP");
  const [vipEntitlements, setVipEntitlements] = useState<
    VipEntitlementAdminRow[]
  >([]);
  const [vipServers, setVipServers] = useState<VipServerOption[]>([]);
  const [roleGrantKeys, setRoleGrantKeys] = useState<string[]>([]);

  const loadVipEntitlements = useCallback((userId: string) => {
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/admin/vip-membership?userId=${encodeURIComponent(userId)}`,
      );
      const payload = await readJson<{
        entitlements: VipEntitlementAdminRow[];
        servers: VipServerOption[];
      }>(res);
      if (!payload.ok) {
        setVipEntitlements([]);
        setVipServers([]);
        return;
      }
      setVipEntitlements(payload.data.entitlements);
      setVipServers(payload.data.servers);
    });
  }, []);

  const selectUser = useCallback(
    (steamId: string) => {
      setError(null);
      setMessage(null);
      setVipEntitlements([]);
      setVipServers([]);
      setRoleGrantKeys([]);
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
        loadVipEntitlements(payload.data.userId);
      });
    },
    [loadVipEntitlements],
  );

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
    const days = EXPIRY_PRESETS.find((p) => p.value === expiryPreset)?.days;
    if (!days) return null;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  function grant() {
    if (!selected) return;
    if (roleCode === "VIP" && roleGrantKeys.length === 0) return;
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
          ...(roleCode === "VIP" ? { entitlementKeys: roleGrantKeys } : {}),
        }),
      });
      const payload = await readJson<ResolvedPermissions>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data);
      if (roleCode === "VIP") {
        setRoleGrantKeys([]);
        loadVipEntitlements(selected.userId);
      }
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
      if (code === "VIP") {
        loadVipEntitlements(selected.userId);
      }
      setMessage(`Revoked ${code}.`);
    });
  }

  function revokeAllVip() {
    if (!selected) return;
    const ok = window.confirm(
      `Revoke all VIP access for ${selected.personaName}?\n\nThis clears the VIP role and purchase history (membership cards). Payments are not refunded. Use for testing.`,
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/revoke-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selected.userId,
        }),
      });
      const payload = await readJson<{
        scope: "all";
        permissions: ResolvedPermissions;
        deactivatedVipRoles: number;
        deletedHistoryRows: number;
      }>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data.permissions);
      setVipEntitlements([]);
      setVipServers((servers) =>
        servers.map((server) => ({ ...server, hasAccess: false })),
      );
      setMessage(
        `Revoked all VIP · ${payload.data.deactivatedVipRoles} role(s), ${payload.data.deletedHistoryRows} history row(s) cleared.`,
      );
    });
  }

  function toggleRoleGrantKey(key: string) {
    setRoleGrantKeys((keys) => nextEntitlementKeys(keys, key));
  }

  function revokeVipEntitlement(row: VipEntitlementAdminRow) {
    if (!selected) return;
    const ok = window.confirm(
      `Revoke ${row.label} for ${selected.personaName}?\n\nRemoves ${row.purchaseCount} purchase history row(s) for this entitlement only. Payments are not refunded.`,
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/revoke-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selected.userId,
          entitlementKey: row.key,
        }),
      });
      const payload = await readJson<{
        scope: "entitlement";
        permissions: ResolvedPermissions;
        entitlementKey: string;
        deletedHistoryRows: number;
        vipDeactivated: boolean;
      }>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setSelected(payload.data.permissions);
      loadVipEntitlements(selected.userId);
      setMessage(
        `Revoked ${row.label} · ${payload.data.deletedHistoryRows} history row(s)${
          payload.data.vipDeactivated ? " · VIP role cleared" : ""
        }.`,
      );
    });
  }

  function grantBadge() {
    if (!selected) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/grant-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId: selected.steamId,
          badgeType,
        }),
      });
      const payload = await readJson<{
        type: BadgeType;
        grantedAt: string;
        steamId: string;
      }>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setMessage(
        `Granted ${BADGE_LABELS[payload.data.type] ?? payload.data.type} badge.`,
      );
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
                  <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary">
                    <button
                      type="button"
                      onClick={() => selectUser(user.steamId)}
                      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
                      aria-label={`Select ${user.personaName}`}
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
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => selectUser(user.steamId)}
                        className="block w-full truncate text-left text-sm font-medium"
                      >
                        {user.personaName}
                      </button>
                      <a
                        href={
                          user.profileUrl ||
                          `https://steamcommunity.com/profiles/${user.steamId}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                      >
                        {user.steamId}
                      </a>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user.role}
                    </span>
                  </div>
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
                  <a
                    href={
                      selected.profileUrl ||
                      `https://steamcommunity.com/profiles/${selected.steamId}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    {selected.steamId}
                  </a>
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
                <div className="mt-3 space-y-3 rounded-md border border-border/80 bg-muted/20 px-3 py-3">
                  <div>
                    <h4 className="text-sm font-medium">VIP entitlements</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Servers this player can use right now. Grant access from
                      Grant role below.
                    </p>
                  </div>
                  {vipEntitlements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No active VIP entitlements.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {vipEntitlements.map((row) => (
                        <li
                          key={row.key}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.expiresAt
                                ? `Expires ${formatDate(row.expiresAt)}`
                                : "Never expires"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => revokeVipEntitlement(row)}
                          >
                            Revoke
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {vipEntitlements.length > 0 ||
                  selected.activeAssignments.some(
                    (assignment) => assignment.roleCode === "VIP",
                  ) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={revokeAllVip}
                    >
                      Revoke all VIP access
                    </Button>
                  ) : null}
                </div>
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
                      {EXPIRY_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {roleCode === "VIP" ? (
                  <div className="space-y-2">
                    <div>
                      <Label>Servers</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        VIP is scoped per server. Pick one or more, or All
                        servers for the bundle.
                      </p>
                    </div>
                    <VipServerPicker
                      servers={vipServers}
                      selectedKeys={roleGrantKeys}
                      onToggle={toggleRoleGrantKey}
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={grant}
                  disabled={
                    pending ||
                    (roleCode === "VIP" && roleGrantKeys.length === 0)
                  }
                >
                  Grant
                </Button>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Grant badge</h3>
                <p className="text-xs text-muted-foreground">
                  Awards a profile badge without changing RBAC roles.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="badgeType">Badge</Label>
                  <select
                    id="badgeType"
                    value={badgeType}
                    onChange={(e) =>
                      setBadgeType(e.target.value as BadgeType)
                    }
                    className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:max-w-xs"
                  >
                    {BADGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BADGE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={grantBadge}
                  disabled={pending}
                >
                  Grant badge
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="text-sm text-muted-foreground">
        Role and badge changes are recorded in the{" "}
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
