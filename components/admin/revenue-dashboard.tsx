"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, TrendingUp, Users, Wallet } from "lucide-react";

import { VipBadge } from "@/components/profile/vip-badge";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";
import type { AdminRevenueResponse } from "@/types/admin-revenue";

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function RevenueDashboard() {
  const [data, setData] = useState<AdminRevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/v1/admin/revenue", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<ApiResult<AdminRevenueResponse>>)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setData(result.data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError("Revenue data could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  const revenue = data;
  const salesByCategory = [
    { key: "INDIVIDUAL_SERVER", title: "Individual servers" },
    { key: "BUNDLE", title: "Bundles" },
  ].map((group) => ({
    ...group,
    rows: [...(revenue?.revenueByPlan ?? [])]
      .filter((row) => group.key === "INDIVIDUAL_SERVER"
        ? row.accessType === "INDIVIDUAL_SERVER"
        : row.accessType !== "INDIVIDUAL_SERVER")
      .sort((a, b) => ["1_month", "3_months", "6_months", "1_year"].indexOf(a.plan) - ["1_month", "3_months", "6_months", "1_year"].indexOf(b.plan)),
  }));
  const metrics = [
    ["Combined revenue", revenue ? formatInr(revenue.grossCapturedPaise) : "—", Wallet],
    ["VIP purchases", revenue?.successfulPurchases.toString() ?? "—", CreditCard],
    ["Paying players", revenue?.payingCustomers.toString() ?? "—", Users],
    ["Net revenue", revenue ? formatInr(revenue.netRevenuePaise) : "—", TrendingUp],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revenue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            VIP purchases, paying players, and monetization performance.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Last 30 days · online captures and offline purchases, including today</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setReload((value) => value + 1)} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <div key={label} className="border-border bg-card rounded-xl border p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Icon className="text-primary size-4" /> {label}
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{loading ? "…" : value}</p>
          </div>
        ))}
      </div>

      {data ? (
        <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="border-border border-b px-4 py-4">
              <h2 className="font-semibold">VIP purchasers</h2>
              <p className="text-muted-foreground mt-1 text-xs">Online and offline VIP purchases recorded in the selected period.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground border-b text-xs">
                  <tr><th className="px-4 py-3 font-medium">Player</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Purchased</th><th className="px-4 py-3 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {revenue?.recentPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{purchase.avatarUrl ? <img src={purchase.avatarUrl} alt="" className="size-7 rounded-full" /> : null}<span className="font-medium">{purchase.playerName}</span><VipBadge compact /></div><span className="text-muted-foreground font-mono text-[10px]">{purchase.steamId}</span></td>
                      <td className="text-muted-foreground px-4 py-3">{purchase.bundleName ?? purchase.plan.replaceAll("_", " ")} · {purchase.durationDays}d</td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">{formatDate(purchase.paidAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatInr(purchase.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!revenue?.recentPurchases.length ? <p className="text-muted-foreground px-4 py-10 text-center text-sm">No VIP purchases found for this period.</p> : null}
            </div>
          </section>

          <section className="border-border bg-card rounded-xl border p-4">
            <h2 className="font-semibold">Revenue analytics</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Refunds</span><span>{formatInr(revenue?.refundsPaise ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly equivalent</span><span>{formatInr(revenue?.monthlyEquivalentPaise ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Abandoned checkouts</span><span>{revenue?.abandonedCheckouts ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Checkout conversion</span><span>{revenue?.checkoutConversionPercent == null ? "—" : `${revenue.checkoutConversionPercent}%`}</span></div>
            </div>
            <h3 className="border-border mt-6 border-t pt-4 text-sm font-semibold">Sales by plan</h3>
            <div className="mt-3 space-y-4">
              {salesByCategory.map((group) => <section key={group.key} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h4>
                {group.rows.length ? group.rows.map((row) => <div key={`${row.plan}:${row.accessType}`} className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground truncate">{row.plan.replaceAll("_", " ")} · {row.purchases} sales</span><span className="font-semibold tabular-nums">{formatInr(row.grossPaise)}</span></div>) : <p className="text-xs text-muted-foreground">No sales in this period.</p>}
              </section>)}
            </div>
          </section>
        </div>
        <section className="border-border bg-card overflow-hidden rounded-xl border">
          <div className="border-border border-b px-4 py-4">
            <h2 className="font-semibold">Offline purchases</h2>
            <p className="text-muted-foreground mt-1 text-xs">Manual VIP purchases recorded with source PURCHASE in the last 30 days. Included in combined revenue and purchase totals.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground border-b text-xs">
                <tr><th className="px-4 py-3 font-medium">Player</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Purchased</th><th className="px-4 py-3 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {revenue?.offlinePurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2">{purchase.avatarUrl ? <img src={purchase.avatarUrl} alt="" className="size-7 rounded-full" /> : null}<span className="font-medium">{purchase.playerName}</span><VipBadge compact /></div><span className="text-muted-foreground font-mono text-[10px]">{purchase.steamId}</span></td>
                    <td className="text-muted-foreground px-4 py-3">{purchase.bundleName ?? purchase.plan.replaceAll("_", " ")} · {purchase.durationDays}d</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{formatDate(purchase.paidAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatInr(purchase.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!revenue?.offlinePurchases.length ? <p className="text-muted-foreground px-4 py-10 text-center text-sm">No offline VIP purchases found for this period.</p> : null}
          </div>
        </section>
        </div>
      ) : null}
    </div>
  );
}
