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
  filterReports,
  isValidSteamId64,
  orderReportsPendingFirst,
} from "@/lib/admin/moderation";
import type { ApiResult } from "@/lib/api/waitlist";
import type { ReportStatus, ReportView } from "@/types/moderation";

type StatusFilter = "pending" | "all" | ReportStatus;
const REPORT_STATUSES: ReportStatus[] = ["open", "assigned", "resolved", "dismissed"];

async function readJson<T>(response: Response): Promise<ApiResult<T>> {
  try {
    return (await response.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "The moderation API returned an invalid response." };
  }
}

function statusLabel(status: ReportStatus): string {
  return status[0]!.toUpperCase() + status.slice(1);
}

export function ModerationReportsPanel({ viewerId }: { viewerId: string }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [targetDraft, setTargetDraft] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [serverFilter, setServerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reports, setReports] = useState<ReportView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const load = useCallback(
    async (isCurrent: () => boolean) => {
      setLoading(true);
      setError(null);

      if (targetFilter && !isValidSteamId64(targetFilter)) {
        setReports([]);
        setError("Enter a valid 17-digit SteamID64 to filter by target.");
        setLoading(false);
        return;
      }

      const statuses =
        statusFilter === "pending"
          ? (["open", "assigned"] as const)
          : statusFilter === "all"
            ? REPORT_STATUSES
            : ([statusFilter] as const);

      try {
        const responses = await Promise.all(
          statuses.map(async (status) => {
            const params = new URLSearchParams({ status, limit: "200" });
            if (targetFilter) params.set("targetSteamId", targetFilter);
            const response = await fetch(`/api/v1/reports?${params}`, {
              cache: "no-store",
            });
            return readJson<ReportView[]>(response);
          }),
        );

        if (!isCurrent()) return;
        const failed = responses.find((response) => !response.ok);
        if (failed && !failed.ok) {
          setReports([]);
          setError(failed.error || "Unable to load reports.");
          return;
        }

        const combined = responses.flatMap((response) =>
          response.ok ? response.data : [],
        );
        setReports(orderReportsPendingFirst(combined));
      } catch {
        if (!isCurrent()) return;
        setReports([]);
        setError("Unable to connect to the moderation API.");
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [statusFilter, targetFilter],
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

  const visibleReports = useMemo(
    () =>
      orderReportsPendingFirst(
        filterReports(reports, {
          reason: reasonFilter || undefined,
          serverId: serverFilter || undefined,
          targetSteamId: targetFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      ),
    [reports, reasonFilter, serverFilter, targetFilter, fromDate, toDate],
  );

  const reasons = useMemo(
    () =>
      [...new Set(reports.map((report) => report.reason))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [reports],
  );
  const servers = useMemo(() => {
    const byId = new Map<string, string>();
    for (const report of reports)
      byId.set(report.serverId, report.serverName || report.serverId);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [reports]);

  function submitTargetFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setTargetFilter(targetDraft.trim());
  }

  async function updateReport(
    reportId: string,
    body: {
      status?: ReportStatus;
      assignedTo?: string | null;
      resolution?: string | null;
    },
  ) {
    if (busyId) return;
    setBusyId(reportId);
    setActionErrors((current) => ({ ...current, [reportId]: "" }));
    try {
      const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readJson<ReportView>(response);
      if (!result.ok) {
        setActionErrors((current) => ({ ...current, [reportId]: result.error }));
        return;
      }
      await reload();
    } catch {
      setActionErrors((current) => ({
        ...current,
        [reportId]: "Unable to connect to the moderation API.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="text-muted-foreground py-3 text-sm">
          Reports are allegations, not proof of misconduct. Review the context before
          taking action; reports never automatically ban a player.
        </CardContent>
      </Card>

      <form
        onSubmit={submitTargetFilter}
        className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-6"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="report-target-filter">Target SteamID64</Label>
          <Input
            id="report-target-filter"
            disabled={loading}
            inputMode="numeric"
            autoComplete="off"
            maxLength={17}
            value={targetDraft}
            onChange={(event) => setTargetDraft(event.target.value)}
            placeholder="17-digit SteamID64"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading}>
            Filter target
          </Button>
          {targetFilter ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTargetDraft("");
                setTargetFilter("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-status-filter">Status</Label>
          <select
            id="report-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="pending">Pending (open + assigned)</option>
            <option value="all">All statuses</option>
            {REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-reason-filter">Reason</Label>
          <select
            id="report-reason-filter"
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">All reasons</option>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-server-filter">Server</Label>
          <select
            id="report-server-filter"
            value={serverFilter}
            onChange={(event) => setServerFilter(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">All servers</option>
            {servers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-from-date">From</Label>
          <Input
            id="report-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to-date">To</Label>
          <Input
            id="report-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
      </form>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {loading
            ? "Loading reports…"
            : `${visibleReports.length} report${visibleReports.length === 1 ? "" : "s"} shown`}
          {!loading ? " · up to 200 records per status are available from the API" : ""}
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
        {!loading && !error && visibleReports.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No reports match these filters.
            </CardContent>
          </Card>
        ) : null}
        {visibleReports.map((report) => (
          <ReportCard
            key={report._id}
            report={report}
            viewerId={viewerId}
            busy={busyId !== null}
            saving={busyId === report._id}
            actionError={actionErrors[report._id]}
            resolution={resolutionDrafts[report._id] ?? ""}
            onResolutionChange={(value) =>
              setResolutionDrafts((current) => ({ ...current, [report._id]: value }))
            }
            onUpdate={(body) => void updateReport(report._id, body)}
          />
        ))}
      </div>
    </div>
  );
}

function ReportCard({
  report,
  viewerId,
  busy,
  saving,
  actionError,
  resolution,
  onResolutionChange,
  onUpdate,
}: {
  report: ReportView;
  viewerId: string;
  busy: boolean;
  saving: boolean;
  actionError?: string;
  resolution: string;
  onResolutionChange: (value: string) => void;
  onUpdate: (body: {
    status?: ReportStatus;
    assignedTo?: string | null;
    resolution?: string | null;
  }) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-border gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>{report.reason}</CardTitle>
          <CardDescription>
            Submitted {formatDateTime(report.createdAt)} ·{" "}
            {report.serverName || report.serverId}
          </CardDescription>
        </div>
        <span
          className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${report.status === "open" ? "bg-amber-500/10 text-amber-300" : report.status === "assigned" ? "bg-blue-500/10 text-blue-300" : "bg-muted text-muted-foreground"}`}
        >
          {statusLabel(report.status)}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Reported player</dt>
            <dd className="font-mono break-all">{report.targetSteamId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Reporter (staff only)</dt>
            <dd className="font-mono break-all">{report.reporterSteamId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Server</dt>
            <dd>
              {report.serverName || report.serverId}{" "}
              <span className="text-muted-foreground text-xs">({report.serverId})</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Assigned moderator</dt>
            <dd className="break-all">
              {report.assignedTo ? `Account ${report.assignedTo}` : "Unassigned"}
            </dd>
          </div>
        </dl>

        {report.details ? (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              Reporter details
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">{report.details}</p>
          </div>
        ) : null}
        {report.resolution ? (
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              Moderation resolution
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">{report.resolution}</p>
          </div>
        ) : null}

        {report.status !== "resolved" && report.status !== "dismissed" ? (
          <div className="border-border space-y-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor={`resolution-${report._id}`}>
                Resolution note (optional)
              </Label>
              <Textarea
                id={`resolution-${report._id}`}
                maxLength={1000}
                rows={2}
                value={resolution}
                onChange={(event) => onResolutionChange(event.target.value)}
                placeholder="Record the moderation outcome…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {!report.assignedTo || report.assignedTo !== viewerId ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onUpdate({ status: "assigned", assignedTo: viewerId })}
                >
                  {saving ? "Saving…" : "Assign to me"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onUpdate({ assignedTo: null })}
                >
                  Unassign
                </Button>
              )}
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  onUpdate({
                    status: "resolved",
                    ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
                  })
                }
              >
                {saving ? "Saving…" : "Resolve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  onUpdate({
                    status: "dismissed",
                    ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
                  })
                }
              >
                {saving ? "Saving…" : "Dismiss"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-border flex flex-wrap items-center gap-3 border-t pt-3">
            <p className="text-muted-foreground text-xs">
              This report is closed. History is retained.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate({ status: "open" })}
            >
              Reopen
            </Button>
          </div>
        )}
        {actionError ? (
          <p className="text-destructive text-sm" role="alert">
            {actionError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
