"use client";

import Image from "next/image";
import { Check, ChevronDown, Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { BuyVipButton } from "@/components/vip/buy-vip-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { getMapImage } from "@/config/servers";
import { vipPerks } from "@/content/vip";
import type { ApiResult } from "@/lib/api/waitlist";
import { formatInrFromPaise } from "@/lib/payments/format";
import { cn } from "@/lib/utils";
import type {
  VipAccessType,
  VipDurationOption,
  VipPlanId,
  VipShopCatalog,
  VipShopQuote,
  VipShopServer,
} from "@/types/vip";
import type { PaymentProvider } from "@/types/payments";

export type VipShopRenewTarget = {
  accessType: VipAccessType;
  serverId: string | null;
};

function serverLabel(server: VipShopServer): string {
  return server.shortName;
}

function serverMonthlyHint(server: VipShopServer): string {
  const oneMonth = server.durationOptions.find((item) => item.id === "1_month");
  return oneMonth
    ? ` — from ${formatInrFromPaise(oneMonth.amountPaise)}/mo`
    : "";
}

type VipShopProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  paymentProvider: PaymentProvider;
  checkoutEnabled?: boolean;
  allRetakesEnabled?: boolean;
  hideBuy?: boolean;
  renewTarget?: VipShopRenewTarget | null;
};

const durationLabels: Record<VipPlanId, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
};

function DurationCards({
  durations,
  durationId,
  onSelect,
  disabled,
}: {
  durations: VipDurationOption[];
  durationId: VipPlanId;
  onSelect: (id: VipPlanId) => void;
  disabled?: boolean;
}) {
  if (durations.length === 0) {
    return (
      <p className="col-span-full text-sm text-muted-foreground">
        Pricing is unavailable right now.
      </p>
    );
  }

  return (
    <>
      {durations.map((item) => {
        const checked = item.id === durationId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            disabled={disabled}
            className={cn(
              "relative flex flex-col rounded-xl border px-3 py-4 text-left transition-colors",
              checked
                ? "border-primary bg-primary/5"
                : "border-border bg-card/50 hover:border-primary/30",
              disabled && "cursor-not-allowed opacity-60",
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
      })}
    </>
  );
}

export function VipShop({
  catalog,
  loggedIn,
  purchasesEnabled,
  paymentProvider,
  checkoutEnabled = false,
  allRetakesEnabled = false,
  hideBuy = false,
  renewTarget = null,
}: VipShopProps) {
  const [accessType, setAccessType] = useState<VipAccessType>(
    allRetakesEnabled ? catalog.quote.accessType : "INDIVIDUAL_SERVER",
  );
  const [selectedServerId, setSelectedServerId] = useState<string | null>(
    catalog.quote.serverId ?? catalog.servers[0]?.id ?? null,
  );
  const [durationId, setDurationId] = useState<VipPlanId>("1_month");
  const [shopQuote, setShopQuote] = useState<VipShopQuote>(catalog.quote);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!allRetakesEnabled && accessType === "ALL_RETAKES") {
      setAccessType("INDIVIDUAL_SERVER");
    }
  }, [accessType, allRetakesEnabled]);

  useEffect(() => {
    if (!renewTarget) return;
    if (
      renewTarget.accessType === "ALL_RETAKES" &&
      allRetakesEnabled
    ) {
      setAccessType("ALL_RETAKES");
      return;
    }
    if (renewTarget.serverId) {
      setAccessType("INDIVIDUAL_SERVER");
      setSelectedServerId(renewTarget.serverId);
    }
  }, [renewTarget, allRetakesEnabled]);

  useEffect(() => {
    if (accessType === "INDIVIDUAL_SERVER" && !selectedServerId) {
      setShopQuote((prev) => ({
        ...prev,
        accessType: "INDIVIDUAL_SERVER",
        serverId: null,
      }));
      return;
    }

    let cancelled = false;
    setQuoteError(null);

    void (async () => {
      try {
        const response = await fetch("/api/v1/payments/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessType,
            ...(accessType === "INDIVIDUAL_SERVER" && selectedServerId
              ? { serverId: selectedServerId }
              : {}),
          }),
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
  }, [accessType, selectedServerId]);

  const duration =
    shopQuote.durations.find((item) => item.id === durationId) ??
    shopQuote.durations[0] ??
    null;

  const selectedServer =
    accessType === "INDIVIDUAL_SERVER" && selectedServerId
      ? catalog.servers.find((server) => server.id === selectedServerId) ?? null
      : null;

  const checkoutReady =
    accessType === "ALL_RETAKES" ||
    (accessType === "INDIVIDUAL_SERVER" && Boolean(selectedServerId));

  const serverStep = allRetakesEnabled ? 2 : 1;
  const durationStep = allRetakesEnabled ? 3 : 2;
  const accessEditHref = allRetakesEnabled
    ? "#choose-access"
    : "#choose-servers";

  if (catalog.servers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No VIP servers are listed yet.
      </p>
    );
  }

  return (
    <div
      id="vip-shop"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div className="space-y-10">
        {allRetakesEnabled ? (
          <section id="choose-access">
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">1.</span> Choose your access
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAccessType("INDIVIDUAL_SERVER")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  accessType === "INDIVIDUAL_SERVER"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card/50 hover:border-primary/30",
                )}
              >
                <p className="font-semibold">Individual Server</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose one premium retake server
                </p>
              </button>
              <button
                type="button"
                onClick={() => setAccessType("ALL_RETAKES")}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-colors",
                  accessType === "ALL_RETAKES"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card/50 hover:border-primary/30",
                )}
              >
                <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-primary-foreground uppercase">
                  <Sparkles className="size-3" />
                  Recommended
                </span>
                <p className="font-semibold">All Retakes</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Access all premium retake servers
                </p>
              </button>
            </div>
          </section>
        ) : null}

        {accessType === "INDIVIDUAL_SERVER" ? (
          <section id="choose-servers">
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">{serverStep}.</span> Choose your
              server
            </h2>
            <div className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="vip-server-select">Server</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    id="vip-server-select"
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:ring-2 data-popup-open:ring-ring/50"
                  >
                    <span className="truncate text-left">
                      {selectedServer
                        ? `${serverLabel(selectedServer)}${serverMonthlyHint(selectedServer)}`
                        : "Select a server"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64">
                    <DropdownMenuRadioGroup
                      value={selectedServerId ?? ""}
                      onValueChange={(value) =>
                        setSelectedServerId(value || null)
                      }
                    >
                      {catalog.servers.map((server) => {
                        const oneMonth = server.durationOptions.find(
                          (item) => item.id === "1_month",
                        );
                        return (
                          <DropdownMenuRadioItem
                            key={server.id}
                            value={server.id}
                            className="gap-3"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {serverLabel(server)}
                            </span>
                            {oneMonth ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                from {formatInrFromPaise(oneMonth.amountPaise)}/mo
                              </span>
                            ) : null}
                          </DropdownMenuRadioItem>
                        );
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </section>
        ) : allRetakesEnabled ? (
          <section id="choose-all-retakes">
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">{serverStep}.</span> All Retakes
            </h2>
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">All Retakes</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Access all currently available premium retake servers during your
                active VIP period.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {catalog.allRetakes.durations.map((option) => (
                  <span key={option.id}>
                    {option.name}:{" "}
                    <span className="font-medium text-foreground">
                      {formatInrFromPaise(option.amountPaise)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="choose-duration">
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="text-primary">{durationStep}.</span> Choose a
            duration
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DurationCards
              durations={shopQuote.durations}
              durationId={durationId}
              onSelect={setDurationId}
              disabled={!checkoutReady}
            />
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
            <span>Access</span>
            <a href={accessEditHref} className="text-primary hover:underline">
              Edit
            </a>
          </div>
          {accessType === "ALL_RETAKES" ? (
            <div className="mt-2">
              <p className="text-sm font-medium">All Retakes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Access all premium retake servers
              </p>
            </div>
          ) : selectedServer ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="relative size-8 overflow-hidden rounded-md">
                <Image
                  src={getMapImage(selectedServer.map)}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {serverLabel(selectedServer)}
                </span>
                {duration ? (
                  <span className="text-xs font-medium text-foreground">
                    {formatInrFromPaise(duration.amountPaise)}
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No server selected.
            </p>
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
            {checkoutReady && duration
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
                accessType={accessType}
                planId={durationId}
                serverId={
                  accessType === "INDIVIDUAL_SERVER" ? selectedServerId : null
                }
                loggedIn={loggedIn}
                paymentProvider={paymentProvider}
                disabled={
                  !checkoutEnabled || !checkoutReady || !duration
                }
                collectContact={checkoutEnabled}
                label={
                  checkoutEnabled
                    ? loggedIn
                      ? "Continue to Payment"
                      : "Sign in to continue"
                    : "Checkout coming soon"
                }
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-foreground">
                Checkout <span className="text-primary">— Coming Soon</span>
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
