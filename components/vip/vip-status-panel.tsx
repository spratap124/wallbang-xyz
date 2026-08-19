import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IST_TIME_ZONE } from "@/lib/time/ist";

function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST_TIME_ZONE,
  });
}

type VipStatusPanelProps = {
  isVip: boolean;
  lifetime: boolean;
  expiresAt: Date | null;
  paid?: boolean;
};

export function VipStatusPanel({
  isVip,
  lifetime,
  expiresAt,
  paid = false,
}: VipStatusPanelProps) {
  const active = isVip && (lifetime || (expiresAt ? expiresAt > new Date() : false));

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 sm:p-7",
        active
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border bg-card/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "size-2.5 rounded-full",
            active ? "bg-emerald-400" : "bg-orange-400",
          )}
          aria-hidden
        />
        <h2 className="text-lg font-semibold">
          {paid && active
            ? "Payment successful"
            : active
              ? "VIP active"
              : expiresAt
                ? "VIP expired"
                : "No VIP yet"}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {lifetime
          ? "You have lifetime VIP access."
          : active && expiresAt
            ? `VIP is active until ${formatExpiry(expiresAt)}. Renewing adds time to this date.`
            : expiresAt
              ? `VIP expired on ${formatExpiry(expiresAt)}. Buy a plan below to start a new term.`
              : "Choose servers and a duration below. There is no auto-renewal — you only pay when you continue to payment."}
      </p>
      {active && !lifetime ? (
        <Link
          href="#vip-shop"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
        >
          Renew VIP
        </Link>
      ) : null}
    </div>
  );
}
