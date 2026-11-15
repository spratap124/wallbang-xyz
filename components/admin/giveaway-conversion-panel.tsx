"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Gift, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import type { GiveawayConversionAnalytics } from "@/lib/admin/giveaway-conversion-analytics";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function GiveawayConversionPanel() {
  const [data, setData] = useState<GiveawayConversionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/v1/admin/analytics/giveaway-conversion", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as ApiResult<GiveawayConversionAnalytics>;
        if (!response.ok || !result.ok) {
          throw new Error(result.ok ? "Could not load giveaway analytics." : result.error);
        }
        setData(result.data);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load giveaway analytics.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reload]);

  return (
    <section className="border-border bg-card/40 rounded-xl border p-3 sm:p-4" aria-labelledby="giveaway-conversion-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="giveaway-conversion-title" className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="text-primary size-4" /> VIP Giveaway Conversion
          </h2>
          <p className="text-muted-foreground mt-1 text-[12px]">
            Giveaway recipients who buy VIP after their complimentary access expires.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[12px]"
          onClick={() => setReload((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-xs" role="alert">
          {error}
          <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>Retry</button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 xl:grid-cols-[0.9fr_2.1fr]">
          <div className="border-border/70 bg-background/35 rounded-lg border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold">
              <CalendarClock className="size-3.5" /> GIVEAWAYS EXPIRING
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[7, 30].map((days) => (
                <div key={days}>
                  <p className="text-muted-foreground text-[11px]">Next {days} days</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">
                    {loading ? "—" : data?.expiring.find((item) => item.days === days)?.recipients ?? 0}
                  </p>
                  <p className="text-muted-foreground text-[10px]">recipients</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border/70 bg-background/35 rounded-lg border p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold">
              <TrendingUp className="size-3.5" /> POST-EXPIRY CONVERSION
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {data?.conversions.map((item) => (
                <div key={item.days} className="min-w-0 border-border/60 border-r pr-2 last:border-0">
                  <p className="text-muted-foreground text-[11px]">Within {item.days} days</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {loading || item.eligibleRecipients === 0
                      ? "—"
                      : `${item.convertedRecipients} / ${item.eligibleRecipients}`}
                  </p>
                  <p className="text-muted-foreground truncate text-[10px]">
                    {item.conversionPercent == null ? "No mature recipients" : `${item.conversionPercent.toFixed(1)}% converted`}
                  </p>
                  <p className="text-foreground mt-1 flex items-center gap-1 text-[11px] font-medium">
                    <Wallet className="size-3 text-primary" /> {formatInr(item.netRevenuePaise)} net
                  </p>
                </div>
              )) ??
                [7, 14, 30].map((days) => (
                  <div key={days} className="border-border/60 border-r pr-2 last:border-0">
                    <p className="text-muted-foreground text-[11px]">Within {days} days</p>
                    <p className="mt-0.5 text-lg font-semibold">—</p>
                    <p className="text-muted-foreground text-[10px]">—</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">— net</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      <p className="text-muted-foreground mt-2 text-[10px]">
        Conversion rates use only recipients whose full window has elapsed. Revenue is paid VIP sales net of refunds; complimentary grants are excluded.
      </p>
    </section>
  );
}
