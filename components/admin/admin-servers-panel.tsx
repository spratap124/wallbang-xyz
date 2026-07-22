"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { ServerManageDashboard } from "@/components/admin/server-manage-dashboard";
import { ServerStatsDashboard } from "@/components/admin/server-stats-dashboard";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type { GameServerAdminView } from "@/types/servers";

type Tab = "activity" | "manage";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

export function AdminServersPanel() {
  const searchParams = useSearchParams();
  const wantsNew = searchParams.get("new") === "1";
  const editId = searchParams.get("edit")?.trim() || null;

  const [tab, setTab] = useState<Tab>(() =>
    wantsNew || editId ? "manage" : "activity",
  );
  const [servers, setServers] = useState<GameServerAdminView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/servers");
      const payload = await readJson<GameServerAdminView[]>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setError(null);
      setServers(payload.data);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (wantsNew || editId) setTab("manage");
  }, [wantsNew, editId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1">
        {(
          [
            { id: "activity" as const, label: "Activity" },
            { id: "manage" as const, label: "Manage" },
          ] as const
        ).map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
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
          Refresh list
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "activity" ? (
        <ServerStatsDashboard
          servers={servers.map((s) => ({
            id: s.id,
            name: s.name,
            shortName: s.shortName,
            mode: s.mode,
            region: s.region,
          }))}
        />
      ) : (
        <div className={cn(pending && servers.length === 0 && "opacity-60")}>
          <ServerManageDashboard
            initialMode={wantsNew ? "create" : editId ? "edit" : undefined}
            initialEditId={editId}
          />
        </div>
      )}
    </div>
  );
}
