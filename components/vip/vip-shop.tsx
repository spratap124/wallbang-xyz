"use client";

import Image from "next/image";
import { Check, Info, Lock, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { BuyVipButton } from "@/components/vip/buy-vip-button";
import { useLiveServers } from "@/components/servers/live-servers-provider";
import { getMapImage } from "@/config/servers";
import { vipPerks } from "@/content/vip";
import { formatInrFromPaise } from "@/lib/payments/format";
import { quoteVipSelection } from "@/lib/payments/quote";
import { countryFlagEmoji } from "@/lib/profile/format";
import { cn } from "@/lib/utils";
import type { VipPlanId, VipShopCatalog, VipShopServer } from "@/types/vip";

type Tab = "servers" | "bundles";

function serverLabel(server: VipShopServer): string {
  return `${server.city} ${server.mode.replace(/s$/i, "")}`;
}

function regionFlag(region: string): string {
  if (/india/i.test(region)) return countryFlagEmoji("IN") ?? "";
  return "";
}

function regionCountry(region: string): string {
  const parts = region.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || region;
}

function savingsPercent(monthlyPaise: number, months: number, quoted: number): number {
  const full = monthlyPaise * months;
  if (full <= 0 || quoted >= full) return 0;
  return Math.round((1 - quoted / full) * 100);
}

type VipShopProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  hideBuy?: boolean;
};

export function VipShop({
  catalog,
  loggedIn,
  purchasesEnabled,
  hideBuy = false,
}: VipShopProps) {
  const live = useLiveServers();
  const liveIds = catalog.servers.map((server) => server.id);
  const [tab, setTab] = useState<Tab>("servers");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    liveIds.slice(0, 1),
  );
  const [durationId, setDurationId] = useState<VipPlanId>("1_month");

  const duration =
    catalog.durations.find((item) => item.id === durationId) ??
    catalog.durations[0];
  const monthPlan = catalog.durations.find((item) => item.id === "1_month");

  const quote = useMemo(() => {
    if (!duration) return null;
    return quoteVipSelection({
      selectedServerIds: selectedIds,
      liveServerIds: liveIds,
      duration,
    });
  }, [duration, liveIds, selectedIds]);

  const selected = catalog.servers.filter((server) =>
    selectedIds.includes(server.id),
  );
  const nextUnselected = catalog.servers.find(
    (server) => !selectedIds.includes(server.id),
  );
  const allSelected = selectedIds.length === liveIds.length && liveIds.length > 0;

  function toggleServer(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAll() {
    setSelectedIds(liveIds);
    setTab("servers");
  }

  if (catalog.servers.length === 0 || !duration || !quote) {
    return (
      <p className="text-sm text-muted-foreground">
        No VIP servers are listed yet.
      </p>
    );
  }

  const monthlyBase =
    (monthPlan?.perServerPaise ?? duration.perServerPaise) *
    Math.max(quote.serverCount, 1);

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
              onClick={() => setTab("servers")}
              className={cn(
                "border-b-2 pb-3",
                tab === "servers"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              Servers
            </button>
            <button
              type="button"
              onClick={() => setTab("bundles")}
              className={cn(
                "border-b-2 pb-3",
                tab === "bundles"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              Bundles
            </button>
          </div>

          {tab === "servers" ? (
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
          ) : (
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                "mt-4 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                allSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/50 hover:border-primary/30",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border",
                  allSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
                aria-hidden
              >
                {allSelected ? <Check className="size-3.5" /> : null}
              </span>
              <span>
                <span className="block font-semibold">All servers</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  VIP on every current WallBang box, billed at the fleet rate.
                </span>
              </span>
            </button>
          )}

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
            {catalog.durations.map((item) => {
              const checked = item.id === duration.id;
              const priced = quoteVipSelection({
                selectedServerIds: selectedIds.length ? selectedIds : liveIds.slice(0, 1),
                liveServerIds: liveIds,
                duration: item,
              });
              const save = savingsPercent(monthlyBase, item.months, priced.amountPaise);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDurationId(item.id)}
                  className={cn(
                    "relative flex flex-col rounded-xl border px-3 py-4 text-left transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card/50 hover:border-primary/30",
                  )}
                >
                  {item.id === "1_year" ? (
                    <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-primary-foreground uppercase">
                      Best value
                    </span>
                  ) : null}
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="mt-2 text-2xl font-semibold tracking-tight">
                    {formatInrFromPaise(priced.amountPaise)}
                  </span>
                  {save > 0 ? (
                    <span className="mt-1 text-xs font-medium text-primary">
                      Save {save}%
                    </span>
                  ) : (
                    <span className="mt-1 min-h-4" aria-hidden />
                  )}
                </button>
              );
            })}
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
                    {server.pingMs > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {server.pingMs}ms
                      </span>
                    ) : null}
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
          <p className="mt-2 text-sm font-medium">{duration.name}</p>
        </div>

        <div className="py-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {formatInrFromPaise(quote.amountPaise)}
          </p>
          <p className="text-xs text-muted-foreground">Incl. taxes</p>
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
            <BuyVipButton
              planId={duration.id}
              serverIds={quote.serverIds}
              loggedIn={loggedIn}
              disabled={quote.serverCount === 0}
              label={loggedIn ? "Continue to Payment" : "Sign in to continue"}
            />
          ) : (
            <button
              type="button"
              disabled
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 text-center text-sm font-medium text-muted-foreground"
            >
              <Lock className="size-4 shrink-0" />
              Checkout is not enabled on this environment yet.
            </button>
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          <Lock className="size-3" />
          Secured by Razorpay
        </p>
      </aside>
    </div>
  );
}
