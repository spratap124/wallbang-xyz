"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  formatDaysRemaining,
  formatVipExpiryDate,
} from "@/lib/payments/vip-display";
import { cn } from "@/lib/utils";
import type {
  VipAccessType,
  VipEntitlement,
  VipMembershipView,
} from "@/types/vip";

export type VipRenewTarget = {
  accessType: VipAccessType;
  serverId: string | null;
};

type VipMembershipDashboardProps = {
  membership: VipMembershipView | null;
  onRenew: (target: VipRenewTarget) => void;
};

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        active ? "bg-emerald-400" : "bg-orange-400",
      )}
      aria-hidden
    />
  );
}

function EntitlementCard({
  entitlement,
  onRenew,
}: {
  entitlement: VipEntitlement;
  onRenew: (target: VipRenewTarget) => void;
}) {
  const active = entitlement.status === "active";
  const daysRemaining =
    entitlement.kind !== "lifetime"
      ? formatDaysRemaining(entitlement.expiresAt)
      : null;

  const renewTarget: VipRenewTarget =
    entitlement.kind === "bundle"
      ? { accessType: "ALL_RETAKES", serverId: null }
      : entitlement.kind === "individual"
        ? { accessType: "INDIVIDUAL_SERVER", serverId: entitlement.serverId }
        : { accessType: "INDIVIDUAL_SERVER", serverId: null };

  return (
    <article className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            {entitlement.kind === "bundle"
              ? entitlement.label
              : entitlement.kind === "individual"
                ? entitlement.serverName
                : entitlement.label}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {entitlement.kind === "bundle"
              ? "All Retake Servers"
              : entitlement.kind === "individual"
                ? "Individual Server Access"
                : entitlement.kind === "lifetime"
                  ? "Lifetime Access"
                  : "VIP Access"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            active ? "text-emerald-400" : "text-muted-foreground",
          )}
        >
          <StatusDot active={active} />
          {active ? "Active" : "Expired"}
        </span>
      </div>

      {entitlement.kind === "bundle" ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Includes</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {entitlement.includedServers.map((server) => (
              <li key={server.id} className="text-foreground/90">
                {server.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {entitlement.kind !== "lifetime" && entitlement.expiresAt ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            Expires{" "}
            <span className="font-medium text-foreground">
              {formatVipExpiryDate(entitlement.expiresAt)}
            </span>
          </p>
          {daysRemaining ? (
            <p className="mt-0.5 text-xs">{daysRemaining}</p>
          ) : null}
        </div>
      ) : entitlement.kind === "lifetime" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Lifetime access — no expiry date.
        </p>
      ) : null}

      {active && entitlement.kind !== "lifetime" ? (
        <button
          type="button"
          onClick={() => onRenew(renewTarget)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
        >
          Renew
        </button>
      ) : null}
    </article>
  );
}

export function VipMembershipDashboard({
  membership,
  onRenew,
}: VipMembershipDashboardProps) {
  if (!membership) {
    return (
      <section className="mb-8 space-y-3">
        <h2 className="text-base font-semibold tracking-tight">
          Your VIP Access
        </h2>
        <div className="rounded-xl border border-border bg-card/40 px-5 py-4 text-sm text-muted-foreground">
          We couldn&apos;t load your current VIP access.
        </div>
      </section>
    );
  }

  const { hasActiveVip, lifetime, entitlements, lastExpiredAt } = membership;

  if (hasActiveVip || lifetime) {
    return (
      <section id="vip-membership" className="mb-8 space-y-4">
        <h2 className="text-base font-semibold tracking-tight">
          Your VIP Access
        </h2>
        {entitlements.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {entitlements.map((entitlement) => (
              <EntitlementCard
                key={
                  entitlement.kind === "individual"
                    ? entitlement.serverId
                    : entitlement.kind === "bundle"
                      ? entitlement.bundleId
                      : entitlement.kind === "lifetime"
                        ? "lifetime"
                        : "general"
                }
                entitlement={entitlement}
                onRenew={onRenew}
              />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (lastExpiredAt) {
    return (
      <section className="mb-8 space-y-4">
        <h2 className="text-base font-semibold tracking-tight">
          Your WallBang VIP
        </h2>
        <div className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot active={false} />
            <h3 className="text-lg font-semibold">VIP Expired</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your previous VIP access expired on{" "}
            <span className="font-medium text-foreground">
              {formatVipExpiryDate(lastExpiredAt)}
            </span>
            .
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-base font-semibold tracking-tight">
        Your WallBang VIP
      </h2>
      <div className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6">
        <p className="text-sm font-medium text-foreground">
          No active VIP access
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          You don&apos;t currently have VIP access. Choose a server and duration
          below to get started.
        </p>
      </div>
    </section>
  );
}
