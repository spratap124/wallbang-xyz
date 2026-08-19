"use client";

import Image from "next/image";
import { Check, Info, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BuyVipButton } from "@/components/vip/buy-vip-button";
import { RazorpayLogo, RazorpaySecuredBadge } from "@/components/vip/razorpay-brand";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { getMapImage } from "@/config/servers";
import { vipPerks } from "@/content/vip";
import type { ApiResult } from "@/lib/api/waitlist";
import { formatInrFromPaise } from "@/lib/payments/format";
import { countryFlagEmoji } from "@/lib/profile/format";
import { cn } from "@/lib/utils";
import type {
  VipDurationOption,
  VipPlanId,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
} from "@/types/vip";


function serverLabel(server: VipShopServer): string {
  return server.shortName;
}

function regionFlag(region: string): string {
  if (/india/i.test(region)) return countryFlagEmoji("IN") ?? "";
  return "";
}

function regionCountry(region: string): string {
  const parts = region.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || region;
}


type VipShopProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  hideBuy?: boolean;
};

const durationLabels: Record<VipPlanId, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
};

export function VipShop({
  catalog,
  loggedIn,
  purchasesEnabled,
  hideBuy = false,
}: VipShopProps) {
  const live = useLiveServers();
  const liveIds = catalog.servers.map((server) => server.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    catalog.quote.serverIds.length ? catalog.quote.serverIds : liveIds.slice(0, 1),
  );
  const [durationId, setDurationId] = useState<VipPlanId>("1_month");
  const [shopQuote, setShopQuote] = useState<VipShopQuote>(catalog.quote);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setShopQuote((prev) => ({ serverIds: [], durations: prev.durations }));
      return;
    }

    let cancelled = false;
    setQuoteError(null);

    void (async () => {
      try {
        const response = await fetch("/api/v1/payments/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverIds: selectedIds }),
        });
        const payload = (await response.json()) as ApiResult<VipShopQuote>;
        if (cancelled) return;
        if (!payload.ok) {
          setQuoteError(payload.error);
          return;
        }
        setShopQuote(payload.data);
      } catch {
        if (!cancelled) {
          setQuoteError("Unable to load pricing.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const hasSelection = selectedIds.length > 0;
  const duration =
    shopQuote.durations.find((item) => item.id === durationId) ??
    shopQuote.durations[0] ??
    null;

  const selected = catalog.servers.filter((server) =>
    selectedIds.includes(server.id),
  );
  const serverAmountMap = new Map(
    (duration?.serverAmounts ?? []).map((row) => [row.serverId, row.amountPaise]),
  );
  const nextUnselected = catalog.servers.find(
    (server) => !selectedIds.includes(server.id),
  );
  function toggleServer(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }


  if (catalog.servers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No VIP servers are listed yet.
      </p>
    );
  }

  return (
    <div id="vip-shop" className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-10">
        <section id="choose-servers">
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="text-primary">1.</span> Choose your servers
          </h2>
          <div className="mt-4 flex gap-6 border-b border-border text-xs font-medium tracking-[0.16em] uppercase">
            <button
              type="button"
              className="border-b-2 border-primary pb-3 text-foreground"
            >
              Servers
            </button>
          </div>

          <ul className="mt-4 space-y-3">
              {catalog.servers.map((server) => {
                const checked = selectedIds.includes(server.id);
                const liveRow = live.servers.find((item) => item.id === server.id);
                const online = liveRow?.online ?? server.status === "live";
                const map = liveRow?.map ?? server.map;
                const players = liveRow?.players ?? 0;
                const maxPlayers = liveRow?.maxPlayers ?? server.maxPlayers;
                const flag = regionFlag(server.region);
                return (
                  <li key={server.id}>
                    <button
                      type="button"
                      onClick={() => toggleServer(server.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card/50 hover:border-primary/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                        aria-hidden
                      >
                        {checked ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={getMapImage(map)}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {serverLabel(server)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs",
                              online ? "text-emerald-400" : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                online ? "bg-emerald-400" : "bg-muted-foreground",
                              )}
                            />
                            {online ? "Live" : "Offline"}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {flag ? `${flag} ` : null}
                            {regionCountry(server.region)}
                          </span>
                          <span>
                            {players} / {maxPlayers} Players
                          </span>
                          {server.pingMs > 0 ? (
                            <span>{server.pingMs}ms</span>
                          ) : null}
                        </span>
                        <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                          + Premium {server.mode.replace(/s$/i, "")} Server
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              disabled={!nextUnselected}
              onClick={() => nextUnselected && toggleServer(nextUnselected.id)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" />
              Add another server
            </button>
            {!nextUnselected ? (
              <p className="text-xs text-muted-foreground">
                More servers will appear here as they go live.
              </p>
            ) : null}
          </div>
        </section>

        <section id="choose-duration">
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="text-primary">2.</span> Choose a duration
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {shopQuote.durations.length > 0 ? (
              shopQuote.durations.map((item: VipDurationOption) => {
              const checked = item.id === durationId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDurationId(item.id)}
                  disabled={!hasSelection}
                  className={cn(
                    "relative flex flex-col rounded-xl border px-3 py-4 text-left transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card/50 hover:border-primary/30",
                    !hasSelection && "cursor-not-allowed opacity-60",
                  )}
                >
                  {item.badge === "popular" ? (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-primary-foreground uppercase">
                      Popular
                    </span>
                  ) : item.badge === "best-value" ? (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-primary-foreground uppercase">
                      Best value
                    </span>
                  ) : null}
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="mt-2 text-2xl font-semibold tracking-tight">
                    {formatInrFromPaise(item.amountPaise)}
                  </span>
                  {item.perMonthPaise ? (
                    <span className="mt-1 text-xs text-muted-foreground">
                      {formatInrFromPaise(item.perMonthPaise)}/month
                    </span>
                  ) : (
                    <span className="mt-1 min-h-4" aria-hidden />
                  )}
                </button>
              );
            })
            ) : (
              <p className="col-span-full text-sm text-muted-foreground">
                Select at least one server to see pricing.
              </p>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            All plans are prepaid. VIP access ends on expiry. No auto-renewal.
          </p>
        </section>
      </div>

      <aside className="rounded-2xl border border-border bg-card/70 p-5 lg:sticky lg:top-24">
        <h2 className="text-base font-semibold">Your selection</h2>

        <div className="mt-4 border-b border-border pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Servers ({selected.length})</span>
            <a href="#choose-servers" className="text-primary hover:underline">
              Edit
            </a>
          </div>
          {selected.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No server selected.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selected.map((server) => (
                <li key={server.id} className="flex items-center gap-2">
                  <span className="relative size-8 overflow-hidden rounded-md">
                    <Image
                      src={getMapImage(server.map)}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {serverLabel(server)}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      {serverAmountMap.get(server.id) ? (
                        <span className="font-medium text-foreground">
                          {formatInrFromPaise(serverAmountMap.get(server.id)!)}
                        </span>
                      ) : null}
                      {server.pingMs > 0 ? <span>{server.pingMs}ms</span> : null}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleServer(server.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label={`Remove ${serverLabel(server)}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-b border-border py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Duration</span>
            <a href="#choose-duration" className="text-primary hover:underline">
              Edit
            </a>
          </div>
          <p className="mt-2 text-sm font-medium">
            {duration?.name ?? durationLabels[durationId]}
          </p>
        </div>

        <div className="py-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {hasSelection && duration
              ? formatInrFromPaise(duration.amountPaise)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Incl. taxes</p>
          {quoteError ? (
            <p className="mt-1 text-xs text-destructive">{quoteError}</p>
          ) : null}
        </div>

        <div className="rounded-xl bg-secondary/60 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            VIP benefits
          </p>
          <ul className="mt-3 space-y-2">
            {vipPerks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          {hideBuy ? (
            <p className="text-sm text-muted-foreground">
              You already have lifetime VIP access.
            </p>
          ) : purchasesEnabled ? (
            <div>
              <BuyVipButton
                planId={durationId}
                serverIds={shopQuote.serverIds}
                loggedIn={loggedIn}
                disabled={!hasSelection || shopQuote.serverIds.length === 0}
                label={loggedIn ? "Continue to Payment" : "Sign in to continue"}
              />
              <RazorpaySecuredBadge />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-foreground">
                Checkout <span className="text-primary">— Coming Soon</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Secure payments powered by
              </p>
              <div className="mt-2 flex items-center justify-center">
                <RazorpayLogo className="h-6 w-auto" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
