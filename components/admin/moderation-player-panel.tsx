"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { formatDateTime } from "@/lib/admin/format";
import { getBanDisplayStatus, isValidSteamId64 } from "@/lib/admin/moderation";
import type { ApiResult } from "@/lib/api/waitlist";
import type { BanView, ReportView } from "@/types/moderation";

type PlayerModeration = { active: BanView | null; history: BanView[] };

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  try {
    return (await response.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "The moderation API returned an invalid response." };
  }
}

export function ModerationPlayerPanel({
  canReviewReports,
}: {
  canReviewReports: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [steamId, setSteamId] = useState("");
  const [player, setPlayer] = useState<PlayerModeration | null>(null);
  const [reports, setReports] = useState<ReportView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const value = draft.trim();
    setError(null);
    setReportsError(null);
    setPlayer(null);
    setReports([]);
    if (!isValidSteamId64(value)) {
      setError("Enter exactly 17 decimal digits for SteamID64.");
      return;
    }

    setSteamId(value);
    setLoading(true);
    const encoded = encodeURIComponent(value);
    try {
      const [playerResponse, reportResponse] = await Promise.all([
        fetch(`/api/v1/admin/moderation/players/${encoded}`, { cache: "no-store" }),
        canReviewReports
          ? fetch(`/api/v1/reports?targetSteamId=${encoded}&limit=200`, {
              cache: "no-store",
            })
          : Promise.resolve(null),
      ]);
      const playerResult = await readJson<PlayerModeration>(playerResponse);
      if (!playerResult.ok) {
        setError(playerResult.error || "Unable to load player moderation history.");
      } else {
        setPlayer(playerResult.data);
      }

      if (reportResponse) {
        const reportResult = await readJson<ReportView[]>(reportResponse);
        if (!reportResult.ok)
          setReportsError(
            reportResult.error || "Unable to load reports for this player.",
          );
        else setReports(reportResult.data);
      }
    } catch {
      setError("Unable to connect to the moderation API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={search}
        className="border-border bg-card flex max-w-xl flex-wrap items-end gap-2 rounded-xl border p-4"
      >
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor="moderation-player-steamid">Player SteamID64</Label>
          <Input
            id="moderation-player-steamid"
            inputMode="numeric"
            autoComplete="off"
            maxLength={17}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="76561198000000000"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search player"}
        </Button>
      </form>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Loading player history…
        </p>
      ) : null}

      {player ? (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base break-all">{steamId}</CardTitle>
              <CardDescription>
                WallBang-wide moderation record. Revocation ends enforcement but does not
                delete history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {player.active ? (
                <div className="border-destructive/25 bg-destructive/5 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Active ban</p>
                    <Badge variant="destructive">
                      {player.active.permanent ? "Permanent" : "Timed"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{player.active.reason}</p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Started {formatDateTime(player.active.startsAt)} ·{" "}
                    {player.active.permanent
                      ? "No expiry"
                      : `Expires ${formatDateTime(player.active.expiresAt ?? "")}`}
                  </p>
                </div>
              ) : (
                <p className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
                  No currently active ban.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ban history</CardTitle>
              <CardDescription>
                Expired and revoked records are retained as historical moderation actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {player.history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No ban history.</p>
              ) : (
                player.history.map((ban) => {
                  const status = getBanDisplayStatus(ban);
                  return (
                    <div key={ban._id} className="border-border rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{ban.reason}</p>
                        <Badge variant={status === "active" ? "destructive" : "outline"}>
                          {status === "active" && ban.permanent
                            ? "Active · permanent"
                            : status[0]!.toUpperCase() + status.slice(1)}
                        </Badge>
                      </div>
                      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Issued</dt>
                          <dd>
                            {formatDateTime(ban.createdAt)} by{" "}
                            <span className="font-mono">{ban.createdBySteamId}</span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Expiry</dt>
                          <dd>
                            {ban.permanent
                              ? "Never"
                              : ban.expiresAt
                                ? formatDateTime(ban.expiresAt)
                                : "—"}
                          </dd>
                        </div>
                        {ban.revokedAt ? (
                          <div>
                            <dt className="text-muted-foreground">Revoked</dt>
                            <dd>
                              {formatDateTime(ban.revokedAt)} ·{" "}
                              {ban.revokeReason || "No reason supplied"}
                            </dd>
                          </div>
                        ) : null}
                        {ban.revokedBy ? (
                          <div>
                            <dt className="text-muted-foreground">Revoking account</dt>
                            <dd className="font-mono break-all">{ban.revokedBy}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {canReviewReports ? (
            <Card>
              <CardHeader>
                <CardTitle>Reports about this player</CardTitle>
                <CardDescription>
                  Reports are allegations, not proof. A report never automatically creates
                  a ban.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reportsError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {reportsError}
                  </p>
                ) : null}
                {!reportsError && reports.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No reports found.</p>
                ) : null}
                {reports.map((report) => (
                  <div key={report._id} className="border-border rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{report.reason}</p>
                        <p className="text-muted-foreground text-xs">
                          {report.serverName || report.serverId} ·{" "}
                          {formatDateTime(report.createdAt)}
                        </p>
                      </div>
                      <Badge variant={report.status === "open" ? "outline" : "secondary"}>
                        {report.status}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          Reporter SteamID64 (staff only)
                        </dt>
                        <dd className="font-mono break-all">{report.reporterSteamId}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Assigned moderator</dt>
                        <dd className="break-all">
                          {report.assignedTo
                            ? `Account ${report.assignedTo}`
                            : "Unassigned"}
                        </dd>
                      </div>
                    </dl>
                    {report.details ? (
                      <p className="bg-muted/40 mt-3 rounded-md p-3 text-sm break-words whitespace-pre-wrap">
                        {report.details}
                      </p>
                    ) : null}
                    {report.resolution ? (
                      <p className="text-muted-foreground mt-2 text-sm break-words whitespace-pre-wrap">
                        Resolution: {report.resolution}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-4 text-sm">
                Your role can view ban history but cannot view reports.
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
