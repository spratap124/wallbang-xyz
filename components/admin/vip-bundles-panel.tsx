"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResult } from "@/lib/api/waitlist";
import { formatInrFromPaise } from "@/lib/payments/format";
import { cn } from "@/lib/utils";
import type { VipBundleView, VipPlanId } from "@/types/vip";

const PLAN_IDS: VipPlanId[] = ["1_month", "3_months", "6_months", "1_year"];
const PLAN_LABELS: Record<VipPlanId, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
};

type ServerOption = { id: string; label: string; enabled: boolean };

type FormState = {
  id: string;
  name: string;
  description: string;
  serverIds: string[];
  pricesInr: Record<VipPlanId, string>;
  enabled: boolean;
  featured: boolean;
};

function emptyForm(): FormState {
  return {
    id: "",
    name: "",
    description: "",
    serverIds: [],
    pricesInr: { "1_month": "", "3_months": "", "6_months": "", "1_year": "" },
    enabled: true,
    featured: false,
  };
}

function formFromBundle(bundle: VipBundleView): FormState {
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? "",
    serverIds: [...bundle.serverIds],
    pricesInr: PLAN_IDS.reduce(
      (acc, plan) => {
        const paise = bundle.pricingByPlan[plan];
        acc[plan] = paise ? String(paise / 100) : "";
        return acc;
      },
      {} as Record<VipPlanId, string>,
    ),
    enabled: bundle.enabled,
    featured: bundle.featured,
  };
}

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

export function VipBundlesPanel() {
  const [bundles, setBundles] = useState<VipBundleView[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const [bundlesRes, serversRes] = await Promise.all([
        fetch("/api/v1/admin/vip-bundles", { cache: "no-store" }),
        fetch("/api/v1/admin/servers", { cache: "no-store" }),
      ]);
      const bundlePayload = await readJson<VipBundleView[]>(bundlesRes);
      const serverPayload = await readJson<
        Array<{ id: string; shortName: string; name: string; enabled: boolean }>
      >(serversRes);
      if (!bundlePayload.ok) {
        setError(bundlePayload.error);
        return;
      }
      setBundles(bundlePayload.data);
      if (serverPayload.ok) {
        setServers(
          serverPayload.data.map((server) => ({
            id: server.id,
            label: server.shortName || server.name,
            enabled: server.enabled,
          })),
        );
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function startEdit(bundle: VipBundleView) {
    setEditingId(bundle.id);
    setForm(formFromBundle(bundle));
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function toggleServer(id: string) {
    setForm((prev) => ({
      ...prev,
      serverIds: prev.serverIds.includes(id)
        ? prev.serverIds.filter((value) => value !== id)
        : [...prev.serverIds, id],
    }));
  }

  function submit() {
    setError(null);
    setMessage(null);

    const name = form.name.trim();
    if (!name) {
      setError("Enter a bundle name.");
      return;
    }
    if (form.serverIds.length === 0) {
      setError("Select at least one server.");
      return;
    }
    const pricingByPlan: Partial<Record<VipPlanId, number>> = {};
    for (const plan of PLAN_IDS) {
      const raw = form.pricesInr[plan].trim();
      const rupees = Number(raw);
      if (!raw || !Number.isFinite(rupees) || rupees <= 0) {
        setError(`Enter a price for ${PLAN_LABELS[plan]}.`);
        return;
      }
      pricingByPlan[plan] = Math.round(rupees * 100);
    }

    startTransition(async () => {
      const body = {
        name,
        description: form.description.trim() || null,
        serverIds: form.serverIds,
        pricingByPlan,
        enabled: form.enabled,
        featured: form.featured,
      };
      const res = editingId
        ? await fetch(`/api/v1/admin/vip-bundles/${encodeURIComponent(editingId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/v1/admin/vip-bundles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, id: form.id.trim().toLowerCase() }),
          });
      const payload = await readJson<VipBundleView>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setMessage(editingId ? `Updated ${payload.data.id}.` : `Created ${payload.data.id}.`);
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      load();
    });
  }

  function toggleEnabled(bundle: VipBundleView) {
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/admin/vip-bundles/${encodeURIComponent(bundle.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !bundle.enabled }),
        },
      );
      const payload = await readJson<VipBundleView>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      load();
    });
  }

  function removeBundle(bundle: VipBundleView) {
    if (
      !window.confirm(
        `Delete bundle "${bundle.name}"? Already-purchased access is unaffected.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/v1/admin/vip-bundles/${encodeURIComponent(bundle.id)}`,
        { method: "DELETE" },
      );
      const payload = await readJson<{ deleted: boolean }>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setMessage(`Deleted ${bundle.id}.`);
      load();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm">
          A bundle is a named set of servers sold at one price per duration —
          separate from individual server pricing and All Retakes. Bundles appear
          on the Pricing page as their own option.
        </p>
        <Button type="button" size="sm" onClick={startCreate}>
          Add bundle
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      {formOpen ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">
              {editingId ? `Edit ${editingId}` : "New bundle"}
            </CardTitle>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bundle-id">Bundle id</Label>
                <Input
                  id="bundle-id"
                  value={form.id}
                  disabled={Boolean(editingId)}
                  placeholder="mumbai-starter"
                  className="font-mono"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                />
                <p className="text-muted-foreground text-[11px]">
                  Lowercase letters, numbers and hyphens. Cannot change later.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bundle-name">Display name</Label>
                <Input
                  id="bundle-name"
                  value={form.name}
                  placeholder="Mumbai Starter Pack"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bundle-description">Description (optional)</Label>
              <Input
                id="bundle-description"
                value={form.description}
                placeholder="Retake #1 and #3 on Mumbai"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Servers</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {servers.map((server) => {
                  const checked = form.serverIds.includes(server.id);
                  return (
                    <label
                      key={server.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        checked ? "border-primary bg-primary/5" : "border-border",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleServer(server.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{server.label}</span>
                      {!server.enabled ? (
                        <span className="text-muted-foreground text-[10px] uppercase">
                          disabled
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prices (₹)</Label>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {PLAN_IDS.map((plan) => (
                  <div key={plan} className="space-y-1.5">
                    <span className="text-muted-foreground text-xs">
                      {PLAN_LABELS[plan]}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="decimal"
                      value={form.pricesInr[plan]}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pricesInr: { ...prev.pricesInr, [plan]: event.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                Enabled (shown on Pricing)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, featured: event.target.checked }))
                  }
                />
                Featured
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="button" disabled={pending} onClick={submit}>
                {editingId ? "Save changes" : "Create bundle"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bundles.length === 0 ? (
        <div className="border-border bg-card/40 text-muted-foreground rounded-xl border px-4 py-10 text-center text-sm">
          {pending ? "Loading…" : "No bundles yet."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bundles.map((bundle) => (
            <Card key={bundle.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{bundle.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-[11px]">
                      {bundle.id}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      bundle.enabled
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {bundle.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                {bundle.description ? (
                  <p className="text-muted-foreground text-xs">{bundle.description}</p>
                ) : null}

                <div className="flex flex-wrap gap-1">
                  {bundle.servers.map((server) => (
                    <span
                      key={server.id}
                      className="border-border rounded-full border px-2 py-0.5 text-[10px]"
                    >
                      {server.name}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
                  {PLAN_IDS.map((plan) => (
                    <div key={plan} className="bg-secondary/60 rounded px-2 py-1">
                      <p className="text-muted-foreground text-[10px] uppercase">
                        {PLAN_LABELS[plan]}
                      </p>
                      <p className="font-mono tabular-nums">
                        {bundle.pricingByPlan[plan]
                          ? formatInrFromPaise(bundle.pricingByPlan[plan]!)
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => startEdit(bundle)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleEnabled(bundle)}
                  >
                    {bundle.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    onClick={() => removeBundle(bundle)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
