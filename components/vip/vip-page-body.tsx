import {
  ArrowRight,
  Crown,
  Headset,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { pricingCheckoutHref } from "@/lib/payments/pricing-href";
import {
  formatDaysRemaining,
  formatVipExpiryDate,
  formatVipExpiryDateCompact,
} from "@/lib/payments/vip-display";
import { cn } from "@/lib/utils";
import type { VipEntitlement, VipMembershipView } from "@/types/vip";

type VipPageUser = {
  personaName: string;
  avatarUrl: string;
};

type VipPageBodyProps = {
  user: VipPageUser | null;
  membership: VipMembershipView | null;
  showPricing?: boolean;
  hideBuy?: boolean;
};

const PERKS = [
  {
    icon: Server,
    title: "Reserved Server Slot",
    body: "Your slot is reserved on your Retake server, even when the server is full.",
  },
  {
    icon: MessageSquare,
    title: "Custom Chat Color",
    body: "Stand out in chat with a special VIP color.",
  },
  {
    icon: Zap,
    title: "Priority Queue",
    body: "Get priority access when joining a full server.",
  },
] as const;

function SteamMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.304 1.265.789.354 1.81.323 2.545-.24.741-.567.948-1.509.55-2.24-.395-.728-1.277-.997-2.083-.786-.263.07-.505.196-.715.366l1.52.628c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012h-.003zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

function entitlementKey(entitlement: VipEntitlement): string {
  switch (entitlement.kind) {
    case "individual":
      return entitlement.serverId;
    case "bundle":
      return entitlement.bundleId;
    case "lifetime":
      return "lifetime";
    case "general":
      return "general";
  }
}

function entitlementTitle(entitlement: VipEntitlement): string {
  return entitlement.kind === "individual"
    ? entitlement.serverName
    : entitlement.label;
}

function entitlementKindLabel(entitlement: VipEntitlement): string {
  switch (entitlement.kind) {
    case "individual":
      return "Individual Server Access";
    case "bundle":
      return "All Retake Servers";
    case "lifetime":
      return "Lifetime Access";
    case "general":
      return "VIP Access";
  }
}

function renewHref(entitlement: VipEntitlement): string {
  if (entitlement.kind === "bundle") {
    return pricingCheckoutHref({ accessType: "ALL_RETAKES", serverId: null });
  }
  if (entitlement.kind === "individual") {
    return pricingCheckoutHref({
      accessType: "INDIVIDUAL_SERVER",
      serverId: entitlement.serverId,
    });
  }
  return pricingCheckoutHref({ accessType: "INDIVIDUAL_SERVER", serverId: null });
}

function canRenew(entitlement: VipEntitlement, showPricing: boolean): boolean {
  return showPricing && entitlement.kind !== "lifetime";
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-orange-500/15 text-orange-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-400" : "bg-orange-300",
        )}
        aria-hidden
      />
      {active ? "Active" : "Expired"}
    </span>
  );
}

function ExpiryCopy({
  entitlement,
  compact = false,
}: {
  entitlement: VipEntitlement;
  compact?: boolean;
}) {
  if (!entitlement.expiresAt) {
    return <p className="text-sm text-muted-foreground">Does not expire</p>;
  }

  const date = compact
    ? formatVipExpiryDateCompact(entitlement.expiresAt)
    : formatVipExpiryDate(entitlement.expiresAt);
  const remaining = formatDaysRemaining(entitlement.expiresAt);

  if (compact) {
    return <p className="text-sm text-foreground/90">{date}</p>;
  }

  return (
    <div className="text-sm text-muted-foreground">
      <p>
        Expires{" "}
        <span className="font-medium text-foreground">{date}</span>
      </p>
      {remaining ? <p className="mt-0.5 text-xs">{remaining}</p> : null}
    </div>
  );
}

function RenewLink({
  entitlement,
  prominent = false,
}: {
  entitlement: VipEntitlement;
  prominent?: boolean;
}) {
  return (
    <Link
      href={renewHref(entitlement)}
      className={cn(
        buttonVariants({ size: prominent ? "lg" : "sm" }),
        prominent ? "h-11 w-full px-5 sm:w-auto" : "h-8 px-3",
      )}
    >
      {prominent ? <RefreshCw /> : null}
      {prominent ? "Renew Access" : "Renew"}
    </Link>
  );
}

function FeaturedAccess({
  entitlement,
  showPricing,
}: {
  entitlement: VipEntitlement;
  showPricing: boolean;
}) {
  const included =
    entitlement.kind === "bundle" ? entitlement.includedServers : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Crown className="size-6 text-primary" aria-hidden />
        <p className="text-2xl font-bold tracking-tight">VIP</p>
        <StatusPill active={entitlement.status === "active"} />
      </div>

      <h2 className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">
        {entitlementTitle(entitlement)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {entitlementKindLabel(entitlement)}
      </p>
      {included.length > 0 ? (
        <p className="mt-2 text-sm text-foreground/80">
          {included.map((server) => server.name).join(", ")}
        </p>
      ) : null}

      <div className="mt-5">
        <ExpiryCopy entitlement={entitlement} />
      </div>

      {canRenew(entitlement, showPricing) ? (
        <div className="mt-6">
          <RenewLink entitlement={entitlement} prominent />
        </div>
      ) : null}
    </div>
  );
}

function AccessList({
  entitlements,
  showPricing,
}: {
  entitlements: VipEntitlement[];
  showPricing: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Crown className="size-6 text-primary" aria-hidden />
        <h2 className="text-2xl font-bold tracking-tight">VIP Access</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {entitlements.length} Retake servers
      </p>

      <div className="mt-5">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_5.5rem_7rem_auto] items-center gap-3 px-1 pb-2 text-xs text-muted-foreground sm:grid">
          <span>Server</span>
          <span>Status</span>
          <span>Expires</span>
          <span className="sr-only">Renew</span>
        </div>
        <ul className="divide-y divide-white/10">
          {entitlements.map((entitlement) => (
            <li key={entitlementKey(entitlement)}>
              <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.5fr)_5.5rem_7rem_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entitlementTitle(entitlement)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entitlementKindLabel(entitlement)}
                  </p>
                </div>
                <StatusPill active={entitlement.status === "active"} />
                <ExpiryCopy entitlement={entitlement} compact />
                {canRenew(entitlement, showPricing) ? (
                  <RenewLink entitlement={entitlement} />
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MembershipDetails({
  loggedIn,
  membership,
  showPricing,
}: {
  loggedIn: boolean;
  membership: VipMembershipView | null;
  showPricing: boolean;
}) {
  if (!loggedIn) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Crown className="size-6 text-primary" aria-hidden />
          <p className="text-2xl font-bold tracking-tight">VIP</p>
        </div>
        <h2 className="mt-6 text-xl font-semibold tracking-tight">
          Reserved access for Retake servers
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Sign in with Steam to see the Retake servers and expiry on your
          account.
        </p>
      </div>
    );
  }

  if (!membership) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Crown className="size-6 text-primary" aria-hidden />
          <p className="text-2xl font-bold tracking-tight">VIP</p>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          We couldn&apos;t load your VIP access. Refresh the page and try again.
        </p>
      </div>
    );
  }

  if (membership.entitlements.length === 1) {
    return (
      <FeaturedAccess
        entitlement={membership.entitlements[0]}
        showPricing={showPricing}
      />
    );
  }

  if (membership.entitlements.length > 1) {
    return (
      <AccessList
        entitlements={membership.entitlements}
        showPricing={showPricing}
      />
    );
  }

  if (membership.lastExpiredAt) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Crown className="size-6 text-primary" aria-hidden />
          <p className="text-2xl font-bold tracking-tight">VIP</p>
          <StatusPill active={false} />
        </div>
        <h2 className="mt-6 text-xl font-semibold tracking-tight">
          VIP Access expired
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your previous VIP access expired on{" "}
          <span className="font-medium text-foreground">
            {formatVipExpiryDate(membership.lastExpiredAt)}
          </span>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Crown className="size-6 text-primary" aria-hidden />
        <p className="text-2xl font-bold tracking-tight">VIP</p>
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">
        No active VIP access
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You don&apos;t currently have VIP access on a Retake server.
      </p>
    </div>
  );
}

function PerkList() {
  return (
    <div>
      <h2 className="text-base font-semibold">Your VIP perks</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        More than just a reserved slot.
      </p>
      <ul className="mt-5 space-y-4">
        {PERKS.map((perk) => (
          <li key={perk.title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <perk.icon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold">{perk.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {perk.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VipPageBody({
  user,
  membership,
  showPricing = true,
  hideBuy = false,
}: VipPageBodyProps) {
  return (
    <>
      <header className="border-border bg-card relative overflow-hidden rounded-xl border">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <Image
            src="/vip-banner.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover object-[72%_center]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(11,13,16,0.88) 0%, rgba(11,13,16,0.62) 24%, rgba(11,13,16,0.18) 46%, rgba(11,13,16,0) 64%)",
            }}
          />
        </div>

        <div className="relative flex min-h-[12.75rem] max-w-xl flex-col justify-center p-5 sm:min-h-[16.5rem] sm:p-8">
          <h1 className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">
            VIP
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Get reserved access to our Retake servers with extra perks.
          </p>

          {user ? (
            <div className="mt-5 flex items-center gap-2.5">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <SteamMark className="size-5 text-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.personaName}
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <SteamMark className="size-5 shrink-0 text-foreground" />
                <p>Sign in with Steam to see VIP access for your account.</p>
              </div>
              <a
                href="/api/auth/steam?returnTo=/vip"
                className={cn(buttonVariants(), "h-10 w-full px-4 sm:w-auto")}
              >
                Continue with Steam
              </a>
            </div>
          )}
        </div>
      </header>

      <section className="mt-8 rounded-2xl border border-primary/25 bg-card/40">
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-12 lg:p-8">
          <MembershipDetails
            loggedIn={Boolean(user)}
            membership={membership}
            showPricing={showPricing}
          />
          <PerkList />
        </div>
      </section>

      {hideBuy || !showPricing ? null : (
        <section className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Need to extend your access?</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Choose a server and duration on the Pricing page, then pay once
              for that term. No auto-renewal.
            </p>
          </div>
          <Link
            href="/pricing"
            className={cn(buttonVariants(), "h-11 w-full px-5 sm:w-auto")}
          >
            View Pricing
            <ArrowRight />
          </Link>
        </section>
      )}

      <section className="mt-12 flex flex-col gap-4 border-t border-border/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Need help?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join our Discord or contact support.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={siteConfig.discordUrl}
            rel="noopener noreferrer"
            className={cn(buttonVariants(), "h-10 w-full px-4 sm:w-auto")}
          >
            <MessageCircle />
            Join Discord
          </a>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 w-full px-4 sm:w-auto",
            )}
          >
            <Headset />
            Contact Support
          </Link>
        </div>
      </section>
    </>
  );
}
