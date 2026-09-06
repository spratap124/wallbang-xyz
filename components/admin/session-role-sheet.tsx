"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import type {
  ResolvedPermissions,
  RoleCode,
  RoleSource,
} from "@/types/permissions";

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

const ROLE_LABELS: Record<RoleCode, string> = {
  USER: "User",
  FOUNDING_MEMBER: "Founding Member",
  VIP: "VIP",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  OWNER: "Owner",
};

type ExpiryPreset = "never" | "30" | "90" | "custom";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function assignmentExpiresAt(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

export type SessionRoleTarget = {
  steamId: string;
  personaName: string | null;
  avatarUrl: string | null;
  role: RoleCode | null;
};

type SessionRoleSheetProps = {
  target: SessionRoleTarget | null;
  onClose: () => void;
  onUpdated: (next: SessionRoleTarget) => void;
};

export function SessionRoleSheet({
  target,
  onClose,
  onUpdated,
}: SessionRoleSheetProps) {
  const open = Boolean(target);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedPermissions | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [roleCode, setRoleCode] = useState<RoleCode>("VIP");
  const [source, setSource] = useState<RoleSource>("MANUAL");
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("never");
  const [customExpiry, setCustomExpiry] = useState("");

  const steamId = target?.steamId ?? null;

  useEffect(() => {
    if (!steamId) {
      setResolved(null);
      setError(null);
      setMessage(null);
      setLoaded(false);
      setRoleCode("VIP");
      setSource("MANUAL");
      setExpiryPreset("never");
      setCustomExpiry("");
      return;
    }

    setError(null);
    setMessage(null);
    setResolved(null);
    setLoaded(false);

    let cancelled = false;
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/users?steamId=${encodeURIComponent(steamId)}`,
      );
      const payload = await readJson<ResolvedPermissions>(res);
      if (cancelled) return;
      if (!payload.ok) {
        if (res.status !== 404) setError(payload.error);
        setLoaded(true);
        return;
      }
      setResolved(payload.data);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [steamId]);

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

  function applyResolved(data: ResolvedPermissions, note: string) {
    setResolved(data);
    setMessage(note);
    onUpdated({
      steamId: data.steamId,
      personaName: data.personaName,
      avatarUrl: data.avatarUrl || null,
      role: data.displayRole,
    });
  }

  function grant() {
    if (!target) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSteamId: target.steamId,
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
      applyResolved(payload.data, `Granted ${ROLE_LABELS[roleCode]}.`);
    });
  }

  function revoke(assignmentId: string, code: RoleCode) {
    if (!target || code === "USER") return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/revoke-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSteamId: target.steamId,
          userRoleId: assignmentId,
        }),
      });
      const payload = await readJson<ResolvedPermissions>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      applyResolved(payload.data, `Revoked ${ROLE_LABELS[code]}.`);
    });
  }

  const unregistered = loaded && !resolved;
  const displayName =
    resolved?.personaName ?? target?.personaName ?? "Unknown";
  const avatarUrl = resolved?.avatarUrl || target?.avatarUrl;
  const displayRole = resolved?.displayRole ?? target?.role;

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent side="right" className="w-[min(100%,24rem)] p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Edit role</SheetTitle>
          <SheetDescription>
            Grant or revoke roles for this Steam account. Unregistered players
            get a WallBang account from their Steam profile on the first grant.
          </SheetDescription>
        </SheetHeader>

        {target ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex items-start gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 rounded-full"
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{displayName}</p>
                <a
                  href={`https://steamcommunity.com/profiles/${target.steamId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {target.steamId}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {displayRole
                    ? `Current role: ${ROLE_LABELS[displayRole]}`
                    : "Not registered"}
                </p>
              </div>
            </div>

            {unregistered ? (
              <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                This player has not signed in on the website. Granting a role
                creates their account from Steam and applies the role for
                in-game permissions.
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}

            {resolved ? (
              <div>
                <h3 className="mb-2 text-sm font-medium">Active roles</h3>
                <ul className="space-y-2">
                  {resolved.activeAssignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {ROLE_LABELS[assignment.roleCode]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.source}
                          {assignment.expiresAt
                            ? ` · expires ${formatDate(assignmentExpiresAt(assignment.expiresAt))}`
                            : " · never expires"}
                        </p>
                      </div>
                      {assignment.roleCode !== "USER" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            revoke(assignment.id, assignment.roleCode)
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Grant role</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="session-role">Role</Label>
                  <select
                    id="session-role"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value as RoleCode)}
                    className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {GRANTABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="session-source">Source</Label>
                  <select
                    id="session-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value as RoleSource)}
                    className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {SOURCES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="session-expiry">Expiry</Label>
                  <select
                    id="session-expiry"
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
                    <Label htmlFor="session-custom-expiry">Custom date</Label>
                    <Input
                      id="session-custom-expiry"
                      type="date"
                      value={customExpiry}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={grant}
                disabled={pending || (expiryPreset === "custom" && !customExpiry)}
              >
                {unregistered ? "Create account and grant" : "Grant"}
              </Button>
            </div>

            {resolved ? (
              <p className="text-xs text-muted-foreground">
                Need VIP entitlements or badges?{" "}
                <Link
                  href={`/admin/permissions?steamId=${encodeURIComponent(target.steamId)}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Open full permissions
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
