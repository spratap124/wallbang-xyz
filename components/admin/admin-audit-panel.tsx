"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import { formatDate } from "@/lib/admin/format";
import { BADGE_LABELS } from "@/lib/profile/badges";
import type { AuditLogDoc } from "@/types/permissions";
import type { BadgeType } from "@/types/profile";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function stringField(
  value: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const raw = value?.[key];
  return typeof raw === "string" ? raw : null;
}

function auditDetailLabel(entry: AuditLogDoc): string {
  switch (entry.action) {
    case "GRANT_ROLE":
    case "REVOKE_ROLE": {
      const code =
        stringField(entry.newValue, "roleCode") ??
        stringField(entry.oldValue, "roleCode");
      return code ?? "—";
    }
    case "REVOKE_VIP_ACCESS": {
      const scope = stringField(entry.oldValue, "scope");
      if (scope === "entitlement") {
        const key = stringField(entry.oldValue, "entitlementKey") ?? "entitlement";
        const history = entry.newValue?.deletedHistoryRows;
        return typeof history === "number"
          ? `${key} · ${history} history`
          : key;
      }
      const roles = entry.newValue?.deactivatedVipRoles;
      const history = entry.newValue?.deletedHistoryRows;
      const rolePart =
        typeof roles === "number" ? `${roles} VIP role(s)` : "all VIP";
      const historyPart =
        typeof history === "number" ? `${history} history` : null;
      return historyPart ? `${rolePart} · ${historyPart}` : rolePart;
    }
    case "GRANT_BADGE": {
      const type = stringField(entry.newValue, "badgeType");
      if (!type) return "—";
      return BADGE_LABELS[type as BadgeType] ?? type;
    }
    case "CREATE_SERVER":
    case "UPDATE_SERVER":
    case "DISABLE_SERVER": {
      const name =
        entry.targetServerName ??
        stringField(entry.newValue, "name") ??
        stringField(entry.oldValue, "name");
      const id =
        entry.targetServerId ??
        stringField(entry.newValue, "id") ??
        stringField(entry.oldValue, "id");
      if (name && id) return `${name} (${id})`;
      return name ?? id ?? "—";
    }
    default:
      return "—";
  }
}

function auditTargetLabel(entry: AuditLogDoc): string {
  if (
    entry.action === "CREATE_SERVER" ||
    entry.action === "UPDATE_SERVER" ||
    entry.action === "DISABLE_SERVER"
  ) {
    return (
      entry.targetServerName ??
      stringField(entry.newValue, "shortName") ??
      entry.targetServerId ??
      "—"
    );
  }
  return entry.targetPersonaName ?? "—";
}

function auditTargetId(entry: AuditLogDoc): string {
  if (
    entry.action === "CREATE_SERVER" ||
    entry.action === "UPDATE_SERVER" ||
    entry.action === "DISABLE_SERVER"
  ) {
    return entry.targetServerId ?? stringField(entry.newValue, "id") ?? "—";
  }
  return entry.targetSteamId ?? "—";
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
              <th className="px-3 py-2 font-medium">Detail</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">ID</th>
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
                    {auditDetailLabel(entry)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.adminSteamId ?? "SYSTEM"}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {auditTargetLabel(entry)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {auditTargetId(entry)}
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
