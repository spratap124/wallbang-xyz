"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResult } from "@/lib/api/waitlist";
import type { GameServerAdminView } from "@/types/servers";
import { cn } from "@/lib/utils";

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
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
    if (!form.host.trim() || !Number.isFinite(port) || !Number.isFinite(maxPlayers)) {
      setError("Host, port, and max players are required.");
      return;
    }

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

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Server</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Address
              </th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {servers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {pending ? "Loading…" : "No servers yet."}
                </td>
              </tr>
            ) : (
              servers.map((server) => (
                <tr key={server.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{server.shortName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {server.id}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                    {server.host}:{server.port}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {server.featured ? (
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                          Featured
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          server.enabled
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {server.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
