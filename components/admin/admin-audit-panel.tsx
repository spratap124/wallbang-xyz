"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import type { AuditLogDoc } from "@/types/permissions";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function auditRoleLabel(entry: AuditLogDoc): string {
  const fromNew = entry.newValue?.roleCode;
  const fromOld = entry.oldValue?.roleCode;
  const code =
    typeof fromNew === "string"
      ? fromNew
      : typeof fromOld === "string"
        ? fromOld
        : null;
  return code ?? "—";
}

export function AdminAuditPanel() {
  const [audit, setAudit] = useState<AuditLogDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/audit?limit=100");
      const payload = await readJson<AuditLogDoc[]>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setAudit(payload.data);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={load}
        >
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">SteamID</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  {pending ? "Loading…" : "No audit entries yet."}
                </td>
              </tr>
            ) : (
              audit.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
                  <td className="px-3 py-2 text-xs font-medium">
                    {auditRoleLabel(entry)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.adminSteamId ?? "SYSTEM"}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {entry.targetPersonaName ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {entry.targetSteamId}
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
