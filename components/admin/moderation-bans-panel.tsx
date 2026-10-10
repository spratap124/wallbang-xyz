"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/admin/format";
import {
  getBanDisplayStatus,
  isValidSteamId64,
  type BanDisplayStatus,
} from "@/lib/admin/moderation";
import type { ApiResult } from "@/lib/api/waitlist";
import type { BanView } from "@/types/moderation";

type BanFilter = "all" | BanDisplayStatus;

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  try {
    return (await response.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "The moderation API returned an invalid response." };
  }
}

function displayStatus(status: BanDisplayStatus): string {
  return status[0]!.toUpperCase() + status.slice(1);
}

export function ModerationBansPanel({
  canIssueTimed,
  canIssuePermanent,
  canRevoke,
}: {
  canIssueTimed: boolean;
  canIssuePermanent: boolean;
  canRevoke: boolean;
}) {
  const [banFilter, setBanFilter] = useState<BanFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [steamIdFilter, setSteamIdFilter] = useState("");
  const [bans, setBans] = useState<BanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [banKind, setBanKind] = useState<"timed" | "permanent">(
    canIssueTimed ? "timed" : "permanent",
  );
  const [durationHours, setDurationHours] = useState("24");
  const [newSteamId, setNewSteamId] = useState("");
  const [reason, setReason] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (banKind === "timed" && !canIssueTimed && canIssuePermanent)
      setBanKind("permanent");
    if (banKind === "permanent" && !canIssuePermanent && canIssueTimed)
      setBanKind("timed");
  }, [banKind, canIssuePermanent, canIssueTimed]);

  const load = useCallback(
    async (isCurrent: () => boolean) => {
      setLoading(true);
      setError(null);
      if (steamIdFilter && !isValidSteamId64(steamIdFilter)) {
        setBans([]);
        setError("Enter a valid 17-digit SteamID64.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ limit: "200" });
      if (steamIdFilter) params.set("steamId", steamIdFilter);
      if (banFilter === "active" || banFilter === "expired")
        params.set("status", "active");
      if (banFilter === "revoked") params.set("status", "revoked");

      try {
        const response = await fetch(`/api/v1/admin/moderation/bans?${params}`, {
          cache: "no-store",
        });
        const result = await readJson<BanView[]>(response);
        if (!isCurrent()) return;
        if (!result.ok) {
          setBans([]);
          setError(result.error || "Unable to load bans.");
          return;
        }
        setBans(result.data);
      } catch {
        if (!isCurrent()) return;
        setBans([]);
        setError("Unable to connect to the moderation API.");
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [banFilter, steamIdFilter],
  );

  const reload = useCallback(async () => {
    await load(() => true);
  }, [load]);

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  const visibleBans = useMemo(
    () =>
      bans.filter((ban) => {
        const status = getBanDisplayStatus(ban, now);
        return banFilter === "all" || status === banFilter;
      }),
    [bans, banFilter, now],
  );

  async function createBan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationPending) return;
    setMutationError(null);
    const steamId = newSteamId.trim();
    const trimmedReason = reason.trim();
    if (!isValidSteamId64(steamId)) {
      setMutationError("SteamID64 must contain exactly 17 decimal digits.");
      return;
    }
    if (trimmedReason.length < 3 || trimmedReason.length > 500) {
      setMutationError("Reason must be between 3 and 500 characters.");
      return;
    }

    const permanent = banKind === "permanent";
    const hours = Number(durationHours);
    if (!permanent && (!Number.isInteger(hours) || hours < 1 || hours > 8760)) {
      setMutationError("Timed bans must be between 1 and 8,760 whole hours.");
      return;
    }
    if (permanent && !window.confirm(`Confirm permanent global ban for ${steamId}?`))
      return;

    setMutationPending(true);
    try {
      const response = await fetch("/api/v1/admin/moderation/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId,
          reason: trimmedReason,
          permanent,
          ...(permanent ? {} : { durationHours: hours }),
        }),
      });
      const result = await readJson<BanView>(response);
      if (!result.ok) {
        setMutationError(result.error || "Unable to create the ban.");
        return;
      }
      setNewSteamId("");
      setReason("");
      await reload();
    } catch {
      setMutationError("Unable to connect to the moderation API.");
    } finally {
      setMutationPending(false);
    }
  }

  async function revokeBan(ban: BanView) {
    if (mutationPending) return;
    const trimmedReason = revokeReason.trim();
    if (trimmedReason.length < 3 || trimmedReason.length > 500) {
      setMutationError("Revocation reason must be between 3 and 500 characters.");
      return;
    }
    if (
      !window.confirm(
        `Confirm revocation of the ban for ${ban.steamId}? The ban history will remain.`,
      )
    )
      return;

    setMutationError(null);
    setMutationPending(true);
    try {
      const response = await fetch(
        `/api/v1/admin/moderation/bans/${encodeURIComponent(ban._id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmedReason }),
        },
      );
      const result = await readJson<BanView>(response);
      if (!result.ok) {
        setMutationError(result.error || "Unable to revoke the ban.");
        return;
      }
      setRevokeId(null);
      setRevokeReason("");
      await reload();
    } catch {
      setMutationError("Unable to connect to the moderation API.");
    } finally {
      setMutationPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {canIssueTimed || canIssuePermanent ? (
        <Card>
          <CardHeader>
            <CardTitle>Issue a global ban</CardTitle>
            <CardDescription>
              Global bans apply across WallBang servers. Revoking a ban preserves its
              history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBan} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ban-steamid">Player SteamID64</Label>
                <Input
                  id="ban-steamid"
                  inputMode="numeric"
                  maxLength={17}
                  autoComplete="off"
                  required
                  value={newSteamId}
                  onChange={(event) => setNewSteamId(event.target.value)}
                  placeholder="76561198000000000"
                  aria-invalid={
                    Boolean(newSteamId) && !isValidSteamId64(newSteamId.trim())
                  }
                />
                {newSteamId && !isValidSteamId64(newSteamId.trim()) ? (
                  <p className="text-destructive text-xs">
                    Use exactly 17 decimal digits.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ban-kind">Duration</Label>
                <select
                  id="ban-kind"
                  value={banKind}
                  onChange={(event) =>
                    setBanKind(event.target.value as "timed" | "permanent")
                  }
                  className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {canIssueTimed ? <option value="timed">Timed ban</option> : null}
                  {canIssuePermanent ? (
                    <option value="permanent">Permanent ban</option>
                  ) : null}
                </select>
              </div>
              {banKind === "timed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ban-duration-hours">Duration (hours)</Label>
                  <Input
                    id="ban-duration-hours"
                    type="number"
                    min={1}
                    max={8760}
                    step={1}
                    required
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="ban-reason">Reason</Label>
                <Textarea
                  id="ban-reason"
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason for the moderation action"
                />
              </div>
              {mutationError ? (
                <p className="text-destructive text-sm md:col-span-2" role="alert">
                  {mutationError}
                </p>
              ) : null}
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    mutationPending ||
                    (banKind === "timed" ? !canIssueTimed : !canIssuePermanent)
                  }
                >
                  {mutationPending
                    ? "Submitting…"
                    : banKind === "permanent"
                      ? "Issue permanent ban"
                      : "Issue timed ban"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSteamIdFilter(searchDraft.trim());
        }}
        className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto_auto]"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ban-search">Search SteamID64</Label>
          <Input
            id="ban-search"
            inputMode="numeric"
            maxLength={17}
            autoComplete="off"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="17-digit SteamID64"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ban-status-filter">Ban status</Label>
          <select
            id="ban-status-filter"
            value={banFilter}
            onChange={(event) => setBanFilter(event.target.value as BanFilter)}
            className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </div>
        {steamIdFilter ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchDraft("");
                setSteamIdFilter("");
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </form>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {mutationError ? (
        <p className="text-destructive text-sm" role="alert">
          {mutationError}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {loading
            ? "Loading bans…"
            : `${visibleBans.length} ban${visibleBans.length === 1 ? "" : "s"} shown · API limit 200`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void reload()}
        >
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {!loading && !error && visibleBans.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No bans match these filters.
            </CardContent>
          </Card>
        ) : null}
        {visibleBans.map((ban) => (
          <BanCard
            key={ban._id}
            ban={ban}
            status={getBanDisplayStatus(ban, now)}
            canRevoke={canRevoke}
            mutationPending={mutationPending}
            revokeOpen={revokeId === ban._id}
            revokeReason={revokeId === ban._id ? revokeReason : ""}
            onStartRevoke={() => {
              setMutationError(null);
              setRevokeId(ban._id);
              setRevokeReason("");
            }}
            onCancelRevoke={() => {
              setRevokeId(null);
              setRevokeReason("");
            }}
            onReasonChange={setRevokeReason}
            onRevoke={() => void revokeBan(ban)}
          />
        ))}
      </div>
    </div>
  );
}

function BanCard({
  ban,
  status,
  canRevoke,
  mutationPending,
  revokeOpen,
  revokeReason,
  onStartRevoke,
  onCancelRevoke,
  onReasonChange,
  onRevoke,
}: {
  ban: BanView;
  status: BanDisplayStatus;
  canRevoke: boolean;
  mutationPending: boolean;
  revokeOpen: boolean;
  revokeReason: string;
  onStartRevoke: () => void;
  onCancelRevoke: () => void;
  onReasonChange: (value: string) => void;
  onRevoke: () => void;
}) {
  return (
    <Card>
      <CardHeader className="border-border gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="font-mono text-sm break-all">{ban.steamId}</CardTitle>
          <CardDescription>{ban.reason}</CardDescription>
        </div>
        <span
          className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${status === "active" ? "bg-destructive/10 text-destructive" : status === "revoked" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-300"}`}
        >
          {displayStatus(status)}
          {ban.permanent ? " · Permanent" : ""}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Issued by (SteamID64)</dt>
            <dd className="font-mono text-xs break-all">{ban.createdBySteamId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Started</dt>
            <dd>{formatDateTime(ban.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Expires</dt>
            <dd>
              {ban.permanent
                ? "Never (permanent)"
                : ban.expiresAt
                  ? formatDateTime(ban.expiresAt)
                  : "Unknown"}
            </dd>
          </div>
          {ban.originServerId ? (
            <div>
              <dt className="text-muted-foreground text-xs">
                Origin server (ban is global)
              </dt>
              <dd>{ban.originServerName || ban.originServerId}</dd>
            </div>
          ) : null}
          {ban.revokedAt ? (
            <div>
              <dt className="text-muted-foreground text-xs">Revoked</dt>
              <dd>{formatDateTime(ban.revokedAt)}</dd>
            </div>
          ) : null}
          {ban.revokedBy ? (
            <div>
              <dt className="text-muted-foreground text-xs">Revoked by (account ID)</dt>
              <dd className="font-mono text-xs break-all">{ban.revokedBy}</dd>
            </div>
          ) : null}
          {ban.revokeReason ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <dt className="text-muted-foreground text-xs">Revocation reason</dt>
              <dd>{ban.revokeReason}</dd>
            </div>
          ) : null}
        </dl>
        {status === "revoked" || status === "expired" ? (
          <p className="border-border text-muted-foreground border-t pt-3 text-xs">
            Historical record retained; this ban is not currently enforced.
          </p>
        ) : null}
        {canRevoke && status === "active" ? (
          revokeOpen ? (
            <div className="border-border space-y-2 border-t pt-3">
              <Label htmlFor={`revoke-reason-${ban._id}`}>Revocation reason</Label>
              <Textarea
                id={`revoke-reason-${ban._id}`}
                minLength={3}
                maxLength={500}
                rows={2}
                value={revokeReason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Why is this ban being revoked?"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={mutationPending || revokeReason.trim().length < 3}
                  onClick={onRevoke}
                >
                  {mutationPending ? "Submitting…" : "Confirm revoke"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutationPending}
                  onClick={onCancelRevoke}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-border border-t pt-3">
              <Button size="sm" variant="outline" onClick={onStartRevoke}>
                Revoke ban…
              </Button>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
