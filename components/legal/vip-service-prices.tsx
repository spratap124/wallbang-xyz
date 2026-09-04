import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  durationMetas,
  readPricingEnv,
} from "@/lib/payments/vip-pricing";
import { formatInrFromPaise } from "@/lib/payments/format";
import { cn } from "@/lib/utils";
import type { VipPlanId } from "@/types/vip";

export function VipServicePrices() {
  const pricing = readPricingEnv();
  const plans = durationMetas();

  return (
    <section className="mt-10 max-w-3xl border-t border-border pt-10">
      <h2 className="text-2xl font-semibold">VIP membership pricing</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Prepaid VIP for one WallBang community/retake server. Paid once for the
        term. No automatic renewal. Current prices:
      </p>
      <ul className="mt-5 divide-y divide-border border border-border">
        {plans.map((plan) => {
          const planId = plan.id as VipPlanId;
          const amount = pricing.individualDefaultPaise[planId];
          return (
            <li
              key={plan.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span className="font-medium text-foreground">{plan.name}</span>
              <span className="font-mono text-muted-foreground">
                {formatInrFromPaise(amount)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        Server-specific prices, if different, are shown on the Pricing page
        before payment.
      </p>
      <Link
        href="/pricing"
        className={cn(buttonVariants({ className: "mt-5" }))}
      >
        View pricing
      </Link>
    </section>
  );
}
