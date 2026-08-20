"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapThumbPath } from "@/lib/admin/format";
import type { ApiResult } from "@/lib/api/waitlist";
import type { GameServerAdminView } from "@/types/servers";
import { cn } from "@/lib/utils";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function formatPaiseToInrInput(paise: number | undefined): string {
  if (!paise || paise <= 0) return "";
  const value = (paise / 100).toFixed(2);
  return value.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function parseInrToPaise(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return Number.NaN;
  }
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return Number.NaN;
  }
  return Math.round(rupees * 100);
}

type FormState = {
  id: string;
  name: string;
  shortName: string;
  mode: string;
  map: string;
  region: string;
  city: string;
  host: string;
  port: string;
  maxPlayers: string;
  vipPrice1Month: string;
  vipPrice3Months: string;
  vipPrice6Months: string;
  vipPrice1Year: string;
  featured: boolean;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  id: "",
  name: "",
  shortName: "",
  mode: "Retakes",
  map: "de_mirage",
  region: "Mumbai, India",
  city: "Mumbai",
  host: "",
  port: "27015",
  maxPlayers: "10",
  vipPrice1Month: "",
  vipPrice3Months: "",
  vipPrice6Months: "",
  vipPrice1Year: "",
  featured: false,
  enabled: true,
});

function fromServer(s: GameServerAdminView): FormState {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    mode: s.mode,
    map: s.map,
    region: s.region,
    city: s.city,
    host: s.host,
    port: String(s.port),
    maxPlayers: String(s.maxPlayersOverride ?? s.maxPlayers),
    vipPrice1Month: formatPaiseToInrInput(s.vipPricingByPlan?.["1_month"]),
    vipPrice3Months: formatPaiseToInrInput(s.vipPricingByPlan?.["3_months"]),
    vipPrice6Months: formatPaiseToInrInput(s.vipPricingByPlan?.["6_months"]),
    vipPrice1Year: formatPaiseToInrInput(s.vipPricingByPlan?.["1_year"]),
    featured: s.featured,
    enabled: s.enabled,
  };
}

export function ServerManageDashboard({
  initialMode,
  initialEditId,
}: {
  initialMode?: "create" | "edit";
  initialEditId?: string | null;
} = {}) {
  const [servers, setServers] = useState<GameServerAdminView[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(
    initialEditId ?? null,
  );
  const [formOpen, setFormOpen] = useState(
    () => initialMode === "create" || Boolean(initialEditId),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [filterQuery, setFilterQuery] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">(
    "all",
  );

  const filteredServers = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return servers.filter((server) => {
      if (enabledFilter === "enabled" && !server.enabled) return false;
      if (enabledFilter === "disabled" && server.enabled) return false;
      if (!q) return true;
      return (
        server.id.toLowerCase().includes(q) ||
        server.name.toLowerCase().includes(q) ||
        server.shortName.toLowerCase().includes(q) ||
        server.host.toLowerCase().includes(q)
      );
    });
  }, [servers, filterQuery, enabledFilter]);

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/v1/admin/servers");
      const payload = await readJson<GameServerAdminView[]>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setServers(payload.data);
      if (initialMode === "create") {
        setEditingId(null);
        setForm(emptyForm());
        setFormOpen(true);
      } else if (initialEditId) {
        const match = payload.data.find((s) => s.id === initialEditId);
        if (match) {
          setEditingId(match.id);
          setForm(fromServer(match));
          setFormOpen(true);
        }
      }
    });
  }, [initialEditId, initialMode]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function startEdit(server: GameServerAdminView) {
    setEditingId(server.id);
    setForm(fromServer(server));
    setFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  function save() {
    setError(null);
    setMessage(null);
    const port = Number(form.port);
    const maxPlayers = Number(form.maxPlayers);
    const vipPricingByPlan = {
      "1_month": parseInrToPaise(form.vipPrice1Month),
      "3_months": parseInrToPaise(form.vipPrice3Months),
      "6_months": parseInrToPaise(form.vipPrice6Months),
      "1_year": parseInrToPaise(form.vipPrice1Year),
    };
    if (!form.host.trim() || !Number.isFinite(port) || !Number.isFinite(maxPlayers)) {
      setError("Host, port, and max players are required.");
      return;
    }
    for (const [plan, price] of Object.entries(vipPricingByPlan)) {
      if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
        setError(`${plan} VIP price must be a positive INR value (up to 2 decimals).`);
        return;
      }
    }

    const vipPricingByPlanInr = {
      "1_month":
        vipPricingByPlan["1_month"] !== undefined
          ? vipPricingByPlan["1_month"] / 100
          : undefined,
      "3_months":
        vipPricingByPlan["3_months"] !== undefined
          ? vipPricingByPlan["3_months"] / 100
          : undefined,
      "6_months":
        vipPricingByPlan["6_months"] !== undefined
          ? vipPricingByPlan["6_months"] / 100
          : undefined,
      "1_year":
        vipPricingByPlan["1_year"] !== undefined
          ? vipPricingByPlan["1_year"] / 100
          : undefined,
    };

    startTransition(async () => {
      if (editingId) {
        const res = await fetch(
          `/api/v1/admin/servers/${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name,
              shortName: form.shortName,
              mode: form.mode,
              map: form.map,
              region: form.region,
              city: form.city,
              host: form.host,
              port,
              maxPlayers,
              maxPlayersOverride: maxPlayers,
              vipPricingByPlanInr,
              featured: form.featured,
              enabled: form.enabled,
            }),
          },
        );
        const payload = await readJson<GameServerAdminView>(res);
        if (!payload.ok) {
          setError(payload.error);
          return;
        }
        setMessage(`Updated ${payload.data.id}.`);
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm());
        load();
        return;
      }

      if (!form.id.trim()) {
        setError("Server id is required (e.g. retake-2).");
        return;
      }

      const res = await fetch("/api/v1/admin/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id.trim().toLowerCase(),
          name: form.name,
          shortName: form.shortName,
          mode: form.mode,
          map: form.map,
          region: form.region,
          city: form.city,
          host: form.host,
          port,
          maxPlayers,
          maxPlayersOverride: maxPlayers,
          vipPricingByPlanInr,
          featured: form.featured,
          enabled: form.enabled,
        }),
      });
      const payload = await readJson<GameServerAdminView>(res);
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setMessage(`Created ${payload.data.id}.`);
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      load();
    });
  }

  function toggleEnabled(server: GameServerAdminView) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (server.enabled) {
        const res = await fetch(
          `/api/v1/admin/servers/${encodeURIComponent(server.id)}`,
          { method: "DELETE" },
        );
        const payload = await readJson<GameServerAdminView>(res);
        if (!payload.ok) {
          setError(payload.error);
          return;
        }
        setMessage(`Disabled ${server.id}.`);
      } else {
        const res = await fetch(
          `/api/v1/admin/servers/${encodeURIComponent(server.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: true }),
          },
        );
        const payload = await readJson<GameServerAdminView>(res);
        if (!payload.ok) {
          setError(payload.error);
          return;
        }
        setMessage(`Enabled ${server.id}.`);
      }
      load();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Fleet registry is stored in MongoDB. After adding a server, set the CS2
          plugin <span className="font-mono text-xs">ServerId</span> to the same
          id and enable WallBang.Presence so heartbeats and stats work.
        </p>
        {!formOpen ? (
          <Button type="button" size="sm" onClick={startCreate}>
            Add server
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter by name, id, or host"
          className="sm:max-w-xs"
        />
        <select
          value={enabledFilter}
          onChange={(e) =>
            setEnabledFilter(e.target.value as "all" | "enabled" | "disabled")
          }
          className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-40"
        >
          <option value="all">All status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          {pending ? "Loading…" : "No servers yet."}
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No servers match this filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredServers.map((server) => {
            const thumb = mapThumbPath(server.map);
            return (
              <div
                key={server.id}
                className="overflow-hidden rounded-xl border border-border bg-card/40"
              >
                <div className="relative h-28 bg-secondary">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="size-full object-cover opacity-80"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {server.shortName || server.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {server.id}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {server.featured ? (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                          Featured
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                          server.enabled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {server.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-4 text-xs text-muted-foreground">
                  <p className="font-mono">
                    {server.host}:{server.port}
                  </p>
                  <p>
                    {server.maxPlayersOverride ?? server.maxPlayers} slots ·{" "}
                    {server.map} · {server.mode}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => startEdit(server)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      render={
                        <Link
                          href={`/admin/sessions?serverId=${encodeURIComponent(server.id)}`}
                        />
                      }
                    >
                      Sessions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => toggleEnabled(server)}
                    >
                      {server.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {!formOpen ? (
            <button
              type="button"
              onClick={startCreate}
              className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background/20 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-border">
                <Plus className="size-4" />
              </span>
              Add Server
            </button>
          ) : null}
        </div>
      )}

      {formOpen ? (
        <section className="rounded-lg border border-border bg-card/40 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {editingId ? `Edit ${editingId}` : "Add server"}
            </h2>
            <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {!editingId ? (
              <Field label="Id" htmlFor="srv-id">
                <Input
                  id="srv-id"
                  value={form.id}
                  onChange={(e) => setField("id", e.target.value)}
                  placeholder="retake-2"
                  className="font-mono"
                />
              </Field>
            ) : null}
            <Field label="Short name" htmlFor="srv-short">
              <Input
                id="srv-short"
                value={form.shortName}
                onChange={(e) => setField("shortName", e.target.value)}
                placeholder="Retake Mumbai #2"
              />
            </Field>
            <Field label="Full name" htmlFor="srv-name">
              <Input
                id="srv-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="[WallBang] Retake #2 | [Mumbai]"
              />
            </Field>
            <Field label="Mode" htmlFor="srv-mode">
              <Input
                id="srv-mode"
                value={form.mode}
                onChange={(e) => setField("mode", e.target.value)}
              />
            </Field>
            <Field label="Host" htmlFor="srv-host">
              <Input
                id="srv-host"
                value={form.host}
                onChange={(e) => setField("host", e.target.value)}
                placeholder="1.2.3.4"
                className="font-mono"
              />
            </Field>
            <Field label="Port" htmlFor="srv-port">
              <Input
                id="srv-port"
                value={form.port}
                onChange={(e) => setField("port", e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Max players" htmlFor="srv-max">
              <Input
                id="srv-max"
                value={form.maxPlayers}
                onChange={(e) => setField("maxPlayers", e.target.value)}
              />
            </Field>
            <Field label="Map" htmlFor="srv-map">
              <Input
                id="srv-map"
                value={form.map}
                onChange={(e) => setField("map", e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="City" htmlFor="srv-city">
              <Input
                id="srv-city"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </Field>
            <Field label="Region" htmlFor="srv-region">
              <Input
                id="srv-region"
                value={form.region}
                onChange={(e) => setField("region", e.target.value)}
              />
            </Field>
            <Field label="VIP 1M (INR)" htmlFor="srv-vip-1m">
              <Input
                id="srv-vip-1m"
                value={form.vipPrice1Month}
                onChange={(e) => setField("vipPrice1Month", e.target.value)}
                placeholder="99"
                className="font-mono"
              />
            </Field>
            <Field label="VIP 3M (INR)" htmlFor="srv-vip-3m">
              <Input
                id="srv-vip-3m"
                value={form.vipPrice3Months}
                onChange={(e) => setField("vipPrice3Months", e.target.value)}
                placeholder="279"
                className="font-mono"
              />
            </Field>
            <Field label="VIP 6M (INR)" htmlFor="srv-vip-6m">
              <Input
                id="srv-vip-6m"
                value={form.vipPrice6Months}
                onChange={(e) => setField("vipPrice6Months", e.target.value)}
                placeholder="549"
                className="font-mono"
              />
            </Field>
            <Field label="VIP 1Y (INR)" htmlFor="srv-vip-1y">
              <Input
                id="srv-vip-1y"
                value={form.vipPrice1Year}
                onChange={(e) => setField("vipPrice1Year", e.target.value)}
                placeholder="999"
                className="font-mono"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setField("featured", e.target.checked)}
              />
              Featured (hero Play Now preference)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setField("enabled", e.target.checked)}
              />
              Enabled on public list
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={save}>
              {editingId ? "Save changes" : "Create server"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={closeForm}
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
