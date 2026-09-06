import Link from "next/link";

import { VipMembershipDashboard } from "@/components/vip/vip-membership-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { pricingCheckoutHref } from "@/lib/payments/pricing-href";
import { cn } from "@/lib/utils";
import type { VipMembershipView } from "@/types/vip";

type VipPageBodyProps = {
  loggedIn: boolean;
  hideBuy?: boolean;
  membership: VipMembershipView | null;
};

export function VipPageBody({
  loggedIn,
  hideBuy = false,
  membership,
}: VipPageBodyProps) {
  const buyHref = pricingCheckoutHref();
  const buyLabel =
    membership?.hasActiveVip && !membership.lifetime ? "Renew VIP" : "Buy VIP";

  return (
    <>
      {loggedIn ? (
        <VipMembershipDashboard membership={membership} />
      ) : null}

      {hideBuy ? null : (
        <section className="mt-2 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card/60 px-6 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">
              {membership?.hasActiveVip ? "Extend your VIP" : "Want VIP access?"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a server and duration on the Pricing page, then pay once.
              No auto-renewal.
            </p>
          </div>
          <Link
            href={buyHref}
            className={cn(buttonVariants({ size: "lg" }), "h-11 shrink-0")}
          >
            {buyLabel}
          </Link>
        </section>
      )}
    </>
  );
}
