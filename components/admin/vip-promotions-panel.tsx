"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResult } from "@/lib/api/waitlist";
import { formatInrFromPaise } from "@/lib/payments/format";
import type { VipPlanId, VipPromotionTarget, VipPromotionView } from "@/types/vip";

const plans: VipPlanId[] = ["1_month", "3_months", "6_months", "1_year"];
const labels: Record<VipPlanId, string> = { "1_month": "1 Month", "3_months": "3 Months", "6_months": "6 Months", "1_year": "1 Year" };
type TargetOption = { targetType: "server" | "bundle"; id: string; name: string; enabled: boolean; pricingByPlan: Record<VipPlanId, number> };
type Payload = { promotions: VipPromotionView[]; targets: TargetOption[] };
type Form = { name: string; description: string; startsAt: string; endsAt: string; percentage: string; targets: Record<string, Record<VipPlanId, string>> };
const empty = (): Form => ({ name: "", description: "", startsAt: "", endsAt: "", percentage: "", targets: {} });
const targetKey = (type: string, id: string) => `${type}:${id}`;
const dateToIstInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16);
};
const inrInput = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

async function readJson<T>(response: Response): Promise<ApiResult<T>> { return response.json() as Promise<ApiResult<T>>; }

export function VipPromotionsPanel() {
  const [data, setData] = useState<Payload>({ promotions: [], targets: [] });
  const [form, setForm] = useState<Form>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => startTransition(async () => {
    const response = await fetch("/api/v1/admin/vip-promotions", { cache: "no-store" });
    const result = await readJson<Payload>(response);
    if (result.ok) setData(result.data); else setError(result.error);
  }), []);
  useEffect(() => { load(); }, [load]);

  function startCreate(copy?: VipPromotionView) {
    setEditingId(null); setError(null); setNotice(null);
    if (!copy) setForm(empty());
    else {
      const targets = Array.isArray(copy.targets) ? copy.targets : [];
      setForm({
        name: `${copy.name || "Untitled offer"} (copy)`, description: copy.description ?? "",
        startsAt: dateToIstInput(copy.startsAt), endsAt: dateToIstInput(copy.endsAt), percentage: "",
        targets: Object.fromEntries(targets.map((target) => [targetKey(target.targetType, target.targetId), Object.fromEntries(plans.map((plan) => [plan, inrInput(target.pricingByPlan[plan] ?? 0)]))])) as Form["targets"],
      });
    }
    setFormOpen(true);
  }
  function startEdit(promotion: VipPromotionView) {
    setEditingId(promotion.id); setError(null); setNotice(null);
    const targets = Array.isArray(promotion.targets) ? promotion.targets : [];
    setForm({
      name: promotion.name || "", description: promotion.description ?? "",
      startsAt: dateToIstInput(promotion.startsAt), endsAt: dateToIstInput(promotion.endsAt), percentage: "",
      targets: Object.fromEntries(targets.map((target) => [targetKey(target.targetType, target.targetId), Object.fromEntries(plans.map((plan) => [plan, inrInput(target.pricingByPlan[plan] ?? 0)]))])) as Form["targets"],
    });
    setFormOpen(true);
  }
  function toggleTarget(target: TargetOption) {
    const key = targetKey(target.targetType, target.id);
    setForm((current) => {
      const next = { ...current.targets };
      if (next[key]) delete next[key];
      else next[key] = { "1_month": "", "3_months": "", "6_months": "", "1_year": "" };
      return { ...current, targets: next };
    });
  }
  function applyPercentage() {
    const pct = Number(form.percentage);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) { setError("Enter a discount from 1% to 99%."); return; }
    setForm((current) => ({ ...current, targets: Object.fromEntries(Object.entries(current.targets).map(([key, values]) => {
      const target = data.targets.find((item) => targetKey(item.targetType, item.id) === key);
      if (!target) return [key, values];
      return [key, Object.fromEntries(plans.map((plan) => [plan, inrInput(Math.round(target.pricingByPlan[plan] * (100 - pct) / 10000) * 100)])) as Record<VipPlanId, string>];
    })) }));
    setError(null);
  }
  function submit() {
    setError(null); setNotice(null);
    if (!form.name.trim() || !form.startsAt || !form.endsAt) { setError("Enter an offer name and both schedule times."); return; }
    const targets: VipPromotionTarget[] = [];
    for (const [key, values] of Object.entries(form.targets)) {
      const target = data.targets.find((item) => targetKey(item.targetType, item.id) === key);
      if (!target) continue;
      const pricingByPlan: Partial<Record<VipPlanId, number>> = {};
      for (const plan of plans) {
        if (!values[plan].trim()) continue;
        const rupees = Number(values[plan]);
        if (!Number.isFinite(rupees) || rupees <= 0) { setError(`Enter a valid promotional price for ${target.name} · ${labels[plan]}, or leave it blank.`); return; }
        const pricePaise = Math.round(rupees * 100);
        if (pricePaise === target.pricingByPlan[plan]) continue;
        pricingByPlan[plan] = pricePaise;
      }
      if (Object.keys(pricingByPlan).length === 0) { setError(`Set at least one promotional duration for ${target.name}.`); return; }
      targets.push({ targetType: target.targetType, targetId: target.id, pricingByPlan });
    }
    if (!targets.length) { setError("Select at least one server or bundle."); return; }
    const toUtc = (value: string) => new Date(`${value}:00+05:30`).toISOString();
    const body = { name: form.name.trim(), description: form.description.trim() || null, startsAt: toUtc(form.startsAt), endsAt: toUtc(form.endsAt), targets };
    startTransition(async () => {
      const response = await fetch(editingId ? `/api/v1/admin/vip-promotions/${encodeURIComponent(editingId)}` : "/api/v1/admin/vip-promotions", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await readJson<VipPromotionView>(response);
      if (!result.ok) { setError(result.error); return; }
      setNotice(editingId ? "Promotion updated." : "Promotion scheduled."); setFormOpen(false); setEditingId(null); load();
    });
  }
  function setEnabled(promotion: VipPromotionView) {
    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/vip-promotions/${encodeURIComponent(promotion.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !promotion.enabled }) });
      const result = await readJson<VipPromotionView>(response);
      if (!result.ok) setError(result.error); else { setNotice(result.data.enabled ? "Promotion enabled." : "Promotion disabled."); load(); }
    });
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Promotional Offers</h1><p className="mt-1 text-sm text-muted-foreground">Schedule VIP prices in India Standard Time. Prices are stored in paise; promotions activate and expire automatically.</p></div><Button onClick={() => startCreate()}>Create offer</Button></div>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
    {formOpen ? <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-2"><div><Label>Offer name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali Offer — 20% OFF" /></div><div><Label>Description (optional)</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Starts · IST</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div><div><Label>Ends · IST</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div></div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-secondary/40 p-3"><div><Label>Apply X% discount</Label><Input type="number" min="1" max="99" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} className="w-36" /></div><Button type="button" variant="outline" onClick={applyPercentage}>Suggest whole-rupee prices</Button><span className="text-xs text-muted-foreground">Suggestions can be edited below; saved prices determine checkout.</span></div>
      <div className="grid gap-5 xl:grid-cols-2">{(["server", "bundle"] as const).map((type) => <fieldset key={type} className="space-y-3 rounded-lg border border-border p-4"><legend className="px-1 font-medium">{type === "server" ? "Individual servers" : "VIP bundles"}</legend>{data.targets.filter((target) => target.targetType === type).map((target) => { const key = targetKey(type, target.id); const selected = Boolean(form.targets[key]); return <div key={key} className="rounded-md bg-secondary/30 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected} onChange={() => toggleTarget(target)} />{target.name}{!target.enabled ? <span className="text-xs text-muted-foreground">(disabled)</span> : null}</label>{selected ? <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{plans.map((plan) => <div key={plan}><Label className="text-xs">{labels[plan]} · base {formatInrFromPaise(target.pricingByPlan[plan])}</Label><Input type="number" min="0.01" step="0.01" value={form.targets[key]?.[plan] ?? ""} onChange={(e) => setForm((current) => ({ ...current, targets: { ...current.targets, [key]: { ...current.targets[key]!, [plan]: e.target.value } } }))} placeholder="Promotional ₹" /></div>)}</div> : null}</div>})}</fieldset>)}</div>
      <div className="flex gap-2"><Button disabled={pending} onClick={submit}>{editingId ? "Save changes" : "Schedule offer"}</Button><Button variant="outline" onClick={() => { setFormOpen(false); setEditingId(null); }}>Cancel</Button></div>
    </section> : null}
    <div className="space-y-3">
      {data.promotions.map((promotion) => {
        // Keep the admin list readable if an older or partially-written Mongo row lacks targets.
        const promotionTargets = Array.isArray(promotion.targets) ? promotion.targets : [];
        return (
          <article key={promotion.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{promotion.name || "Untitled offer"}</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{promotion.status}</span>
                </div>
                {promotion.description ? <p className="mt-1 text-sm text-muted-foreground">{promotion.description}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(promotion.startsAt))}
                  {" – "}
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(promotion.endsAt))}
                  {" IST · "}{promotionTargets.length} target(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startCreate(promotion)}>Duplicate</Button>
                {promotion.status !== "active" ? <Button size="sm" variant="outline" onClick={() => startEdit(promotion)}>Edit</Button> : null}
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEnabled(promotion)}>{promotion.enabled ? "Disable" : "Enable"}</Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {promotionTargets.map((target) => {
                const name = data.targets.find((item) => item.targetType === target.targetType && item.id === target.targetId)?.name ?? target.targetId;
                return <span key={targetKey(target.targetType, target.targetId)} className="rounded-full border border-border px-2 py-1 text-xs">{name}</span>;
              })}
            </div>
          </article>
        );
      })}
      {!data.promotions.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No promotional offers yet.</p> : null}
    </div>
  </div>;
}
