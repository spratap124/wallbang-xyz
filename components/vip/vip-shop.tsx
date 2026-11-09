"use client";

import Image from "next/image";
import { Check, Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BuyVipButton } from "@/components/vip/buy-vip-button";
import { RazorpaySecuredBadge } from "@/components/vip/razorpay-brand";
import { trackGaEvent } from "@/lib/analytics/gtag";
import { vipGaItem } from "@/lib/analytics/items";
import { getMapImage } from "@/config/servers";
import {
  hostedAccessDaysLabel,
  hostedAccessPlanBlurb,
  hostedAccessProduct,
} from "@/content/business";
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
  /** Set when renewing a specific bundle. */
  bundleId?: string | null;
};

function serverLabel(server: VipShopServer): string {
  return server.shortName;
}

const ITEM_LIST_ID = "vip_shop";
const ITEM_LIST_NAME = "VIP shop";

type VipShopProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  paymentProvider: PaymentProvider;
  checkoutEnabled?: boolean;
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

  const oneMonth = durations.find((item) => item.id === "1_month");

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
            <span className="mt-0.5 text-[0.65rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {hostedAccessProduct}
            </span>
            {item.promotion && item.baseAmountPaise ? (
              <span className="mt-2 text-xs text-muted-foreground line-through">
                {formatInrFromPaise(item.baseAmountPaise)}
              </span>
            ) : null}
            <span className="mt-1 text-2xl font-semibold tracking-tight">
              {formatInrFromPaise(item.amountPaise)}
            </span>
            {item.perMonthPaise ? (
              <span className="mt-1 text-xs text-muted-foreground">
                {formatInrFromPaise(item.perMonthPaise)}/month
              </span>
            ) : (
              <span className="mt-1 min-h-4" aria-hidden />
            )}
            <span className="mt-2 text-xs font-medium text-emerald-500">
              {item.promotion
                ? `Save ${formatInrFromPaise(item.promotion.discountAmountPaise)} with ${item.promotion.name}`
                : oneMonth && item.months > 1
                ? `Save ${formatInrFromPaise(Math.max(0, (oneMonth.baseAmountPaise ?? oneMonth.amountPaise) * item.months - (item.baseAmountPaise ?? item.amountPaise)))}`
                : "Save ₹0"}
            </span>
            {item.promotion ? <span className="mt-1 text-xs text-primary">{item.promotion.discountPercentage}% off</span> : null}
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
  hideBuy = false,
  renewTarget = null,
}: VipShopProps) {
  const router = useRouter();
  const defaultBundle =
    catalog.bundles.find((bundle) => bundle.featured) ?? catalog.bundles[0] ?? null;
  const defaultAccessType: VipAccessType = defaultBundle
    ? "BUNDLE"
    : catalog.quote.accessType;
  const [accessType, setAccessType] = useState<VipAccessType>(
    defaultAccessType,
  );
  const [selectedServerId, setSelectedServerId] = useState<string | null>(
    catalog.quote.serverId ?? catalog.servers[0]?.id ?? null,
  );
  const [durationId, setDurationId] = useState<VipPlanId>("6_months");
  const [bundleId, setBundleId] = useState<string | null>(defaultBundle?.id ?? null);
  const [shopQuote, setShopQuote] = useState<VipShopQuote>(() => defaultBundle
    ? { accessType: "BUNDLE", serverId: null, bundleId: defaultBundle.id, durations: defaultBundle.durations }
    : catalog.quote);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);

  useEffect(() => {
    if (accessType === "ALL_RETAKES") {
      // All Retakes is retired; fall back to the recommended bundle or a server.
      const fallback = catalog.bundles[0]?.id ?? null;
      if (fallback) {
        setAccessType("BUNDLE");
        setBundleId(fallback);
      } else {
        setAccessType("INDIVIDUAL_SERVER");
        setBundleId(null);
      }
    }
    if (
      accessType === "BUNDLE" &&
      !catalog.bundles.some((bundle) => bundle.id === bundleId)
    ) {
      setAccessType("INDIVIDUAL_SERVER");
      setBundleId(null);
    }
  }, [accessType, bundleId, catalog.bundles]);

  // GA4 ecommerce: offer views + explicit selections (no PII in payloads).
  const itemForPlan = (input: {
    plan: VipPlanId;
    amountPaise: number;
    accessTypeOverride?: VipAccessType;
  }) =>
    vipGaItem({
      accessType: input.accessTypeOverride ?? accessType,
      bundleKind:
        accessType === "ALL_RETAKES"
          ? "all"
          : accessType === "BUNDLE"
            ? "custom"
            : "server",
      plan: input.plan,
      amountPaise: input.amountPaise,
      serverId: accessType === "BUNDLE" ? null : selectedServerId,
      serverShortName: selectedServer?.shortName ?? null,
      bundleName: selectedBundle?.name ?? null,
    });

  useEffect(() => {
    if (shopQuote.durations.length === 0) return;
    if (!(purchasesEnabled || checkoutEnabled)) return;
    trackGaEvent("view_item_list", {
      item_list_id: ITEM_LIST_ID,
      item_list_name: ITEM_LIST_NAME,
      currency: "INR",
      items: shopQuote.durations.map((option) =>
        itemForPlan({
          plan: option.id as VipPlanId,
          amountPaise: option.amountPaise,
        }),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quote-dependent; fire when the visible list changes
  }, [accessType, shopQuote.durations, purchasesEnabled, checkoutEnabled]);

  function lookupPlanPrice(
    options: Array<{ id: string; amountPaise: number }>,
  ): number | null {
    return (
      options.find((option) => option.id === durationId)?.amountPaise ??
      options[0]?.amountPaise ??
      null
    );
  }

  function trackSelectItem(input: {
    plan: VipPlanId;
    accessTypeOverride?: VipAccessType;
    serverShortName?: string | null;
    amountOverride?: number | null;
  }): void {
    if (!(purchasesEnabled || checkoutEnabled)) return;
    trackGaEvent("select_item", {
      item_list_id: ITEM_LIST_ID,
      item_list_name: ITEM_LIST_NAME,
      currency: "INR",
      items: [
        vipGaItem({
          accessType: input.accessTypeOverride ?? accessType,
          bundleKind:
            accessType === "ALL_RETAKES"
              ? "all"
              : accessType === "BUNDLE"
                ? "custom"
                : "server",
          plan: input.plan,
          amountPaise: input.amountOverride ?? 0,
          serverId: accessType === "BUNDLE" ? null : selectedServerId,
          serverShortName: input.serverShortName ?? selectedServer?.shortName ?? null,
          bundleName: selectedBundle?.name ?? null,
        }),
      ],
    });
  }

  useEffect(() => {
    if (!renewTarget) return;
    if (
      renewTarget.accessType === "BUNDLE" &&
      renewTarget.bundleId &&
      catalog.bundles.some((bundle) => bundle.id === renewTarget.bundleId)
    ) {
      setAccessType("BUNDLE");
      setBundleId(renewTarget.bundleId);
      return;
    }
    if (renewTarget.accessType === "ALL_RETAKES") {
      const fallback = catalog.bundles[0]?.id ?? null;
      if (fallback) {
        setAccessType("BUNDLE");
        setBundleId(fallback);
      } else {
        setAccessType("INDIVIDUAL_SERVER");
      }
      return;
    }
    if (renewTarget.serverId) {
      setAccessType("INDIVIDUAL_SERVER");
      setSelectedServerId(renewTarget.serverId);
    }
  }, [renewTarget, catalog.bundles]);

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
            ...(accessType === "BUNDLE" && bundleId ? { bundleId } : {}),
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
  }, [accessType, selectedServerId, bundleId, catalog, quoteRefreshKey]);

  const duration =
    shopQuote.durations.find((item) => item.id === durationId) ??
    shopQuote.durations[0] ??
    null;
  const promotionEndsAt = duration?.promotion?.endsAt;
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setCountdownNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const refreshQuote = () => {
      router.refresh();
      setQuoteError(null);
      // Selection dependencies are unchanged; force the authoritative quote fetch.
      setQuoteRefreshKey((key) => key + 1);
    };
    const timer = promotionEndsAt
      ? window.setTimeout(refreshQuote, Math.max(0, new Date(promotionEndsAt).getTime() - Date.now() + 25))
      : undefined;
    const interval = window.setInterval(refreshQuote, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshQuote(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [promotionEndsAt, router]);

  const selectedServer =
    accessType === "INDIVIDUAL_SERVER" && selectedServerId
      ? catalog.servers.find((server) => server.id === selectedServerId) ?? null
      : null;

  // The featured bundle is recommended; otherwise the first one listed.
  const recommendedBundleId =
    catalog.bundles.find((bundle) => bundle.featured)?.id ??
    catalog.bundles[0]?.id ??
    null;

  const selectedBundle =
    accessType === "BUNDLE"
      ? (catalog.bundles.find((bundle) => bundle.id === bundleId) ?? null)
      : null;

  const promotionEligibleLabel = selectedBundle
    ? selectedBundle.name
    : selectedServer
      ? serverLabel(selectedServer)
      : null;
  const promotionRemainingMs = duration?.promotion
    ? Math.max(0, new Date(duration.promotion.endsAt).getTime() - countdownNow)
    : 0;
  const promotionRemainingSeconds = Math.floor(promotionRemainingMs / 1_000);
  const promotionCountdown = promotionRemainingMs <= 0
    ? "Offer ended"
    : `Ends in ${Math.floor(promotionRemainingSeconds / 86_400)}d ${Math.floor((promotionRemainingSeconds % 86_400) / 3_600)}h ${Math.floor((promotionRemainingSeconds % 3_600) / 60)}m ${promotionRemainingSeconds % 60}s`;

  const checkoutReady =
    (accessType === "BUNDLE" && Boolean(selectedBundle)) ||
    (accessType === "INDIVIDUAL_SERVER" && Boolean(selectedServerId));

  const hasAccessChoices = catalog.bundles.length > 0;
  const serverStep = hasAccessChoices ? 2 : 1;
  const durationStep = hasAccessChoices ? 3 : 2;
  const accessEditHref = hasAccessChoices ? "#choose-access" : "#choose-servers";

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
        {duration?.promotion ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {duration.promotion.name} — {duration.promotion.discountPercentage}% off
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Limited-time VIP pricing. {promotionEligibleLabel ? `Eligible for ${promotionEligibleLabel}.` : ""}
            </p>
            <p className="mt-2 inline-flex rounded-md border border-primary/30 bg-background/60 px-3 py-1.5 font-mono text-sm font-semibold tabular-nums text-foreground" aria-live="off">
              {promotionCountdown}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Offer ends {new Intl.DateTimeFormat("en-IN", {
                day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata", timeZoneName: "short",
              }).format(new Date(duration.promotion.endsAt))}.
            </p>
          </div>
        ) : null}
        {hasAccessChoices ? (
          <section id="choose-access">
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">1.</span> Choose your access
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setAccessType("INDIVIDUAL_SERVER");
                  trackSelectItem({ plan: durationId });
                }}
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
              {catalog.bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => {
                    setAccessType("BUNDLE");
                    setBundleId(bundle.id);
                    trackSelectItem({
                      plan: durationId,
                      accessTypeOverride: "BUNDLE",
                      amountOverride: bundle.durations[0]?.amountPaise ?? null,
                    });
                  }}
                  className={cn(
                    "relative rounded-xl border p-4 text-left transition-colors",
                    accessType === "BUNDLE" && bundleId === bundle.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card/50 hover:border-primary/30",
                  )}
                >
                  {bundle.id === recommendedBundleId ? (
                    <span className="bg-primary text-primary-foreground absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase">
                      <Sparkles className="size-3" />
                      Recommended
                    </span>
                  ) : null}
                  <p className="font-semibold">{bundle.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bundle.servers.length} server
                    {bundle.servers.length === 1 ? "" : "s"}
                    {bundle.durations[0]
                      ? ` — from ${formatInrFromPaise(bundle.durations[0].amountPaise)}/mo`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {accessType === "BUNDLE" && selectedBundle ? (
          <section id="choose-bundle">
            <h2 className="text-lg font-semibold tracking-tight">
              <span className="text-primary">{serverStep}.</span> Included
              servers
            </h2>
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">{selectedBundle.name}</p>
              {selectedBundle.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedBundle.description}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedBundle.servers.map((server) => (
                  <span
                    key={server.id}
                    className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs"
                  >
                    {server.name}
                  </span>
                ))}
              </div>
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
                {catalog.servers.map((server) => {
                  const checked = selectedServerId === server.id;
                  const price = lookupPlanPrice(server.durationOptions);
                  return (
                    <label
                      key={server.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card/50 hover:border-primary/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="vip-server"
                        value={server.id}
                        checked={checked}
                        onChange={() => {
                          setSelectedServerId(server.id);
                          trackSelectItem({
                            plan: durationId,
                            serverShortName: server.shortName,
                            amountOverride: price,
                          });
                        }}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {serverLabel(server)}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {server.city}
                        </span>
                      </span>
                      {price !== null ? (
                        <span className="shrink-0 text-right text-sm font-semibold">
                          {formatInrFromPaise(price)}
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {durationLabels[durationId]}
                          </span>
                        </span>
                      ) : null}
                    </label>
                  );
                })}
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
              onSelect={(id) => {
                setDurationId(id);
                trackSelectItem({ plan: id });
              }}
              disabled={!checkoutReady}
            />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {duration
              ? `${hostedAccessDaysLabel(duration.durationDays)}. ${hostedAccessPlanBlurb(duration.durationDays)} Prepaid once; not automatically renewed.`
              : "All plans are prepaid for a stated term. Access ends when that term ends. It is not automatically renewed."}
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
          {selectedBundle ? (
            <div className="mt-2">
              <p className="text-sm font-medium">{selectedBundle.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedBundle.servers.length} server
                {selectedBundle.servers.length === 1 ? "" : "s"}
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
                  <span className="block text-xs font-medium text-foreground">
                    {duration.promotion && duration.baseAmountPaise ? <span className="mr-1 text-muted-foreground line-through">{formatInrFromPaise(duration.baseAmountPaise)}</span> : null}
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
            {duration
              ? `${duration.name} — ${hostedAccessProduct}`
              : `${durationLabels[durationId]} — ${hostedAccessProduct}`}
          </p>
        </div>

        <div className="py-4">
          <p className="text-xs text-muted-foreground">Total</p>
          {duration?.promotion && duration.baseAmountPaise ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="line-through">{formatInrFromPaise(duration.baseAmountPaise)}</span>
              <span className="ml-2 text-emerald-500">−{formatInrFromPaise(duration.promotion.discountAmountPaise)} · {duration.promotion.name}</span>
            </p>
          ) : null}
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {checkoutReady && duration
              ? formatInrFromPaise(duration.amountPaise)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Prepaid, paid once</p>
          {quoteError ? (
            <p className="mt-1 text-xs text-destructive">{quoteError}</p>
          ) : null}
        </div>

        <div className="rounded-xl bg-secondary/60 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Hosted access benefits
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
          ) : purchasesEnabled || checkoutEnabled ? (
            <div>
              <BuyVipButton
                accessType={accessType}
                planId={durationId}
                serverId={
                  accessType === "INDIVIDUAL_SERVER" ? selectedServerId : null
                }
                bundleId={accessType === "BUNDLE" ? bundleId : null}
                loggedIn={loggedIn}
                paymentProvider={paymentProvider}
                disabled={
                  !checkoutEnabled ||
                  !checkoutReady ||
                  !duration ||
                  !purchasesEnabled
                }
                collectContact={checkoutEnabled}
                amountPaise={duration?.amountPaise ?? null}
                onPriceChange={(changed) => {
                  setShopQuote((current) => ({
                    ...current,
                    durations: current.durations.map((item) => item.id === changed.plan ? {
                      ...item,
                      amountPaise: changed.amount,
                      baseAmountPaise: changed.originalAmount,
                      perMonthPaise: item.months > 1 ? Math.round(changed.amount / item.months) : null,
                      promotion: changed.promotionId && changed.promotionName && changed.promotionEndsAt ? {
                        id: changed.promotionId,
                        name: changed.promotionName,
                        discountAmountPaise: changed.discountAmount,
                        discountPercentage: changed.originalAmount > 0 ? Math.round(changed.discountAmount / changed.originalAmount * 100) : 0,
                        endsAt: changed.promotionEndsAt,
                      } : undefined,
                    } : item),
                  }));
                }}
                serverShortName={
                  selectedBundle?.name ?? selectedServer?.shortName ?? null
                }
                label={
                  checkoutEnabled
                    ? loggedIn
                      ? "Continue to Payment"
                      : "Sign in to continue"
                    : "Checkout coming soon"
                }
              />
              {paymentProvider === "razorpay" && checkoutEnabled && loggedIn ? (
                <RazorpaySecuredBadge />
              ) : null}
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
