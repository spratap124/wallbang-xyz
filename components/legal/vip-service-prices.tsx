import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { hostedAccessPlanLabel } from "@/content/business";
import { getVipShopCatalog } from "@/config/vip-plans";
import { formatInrFromPaise } from "@/lib/payments/format";
import { getGameServers } from "@/lib/servers/registry";
import { cn } from "@/lib/utils";

export async function VipServicePrices() {
  const servers = await getGameServers();
  const catalog = getVipShopCatalog(servers);
  const pricedServers = catalog.servers
    .map((server) => ({
      id: server.id,
      label: server.shortName || server.name,
      plans: server.durationOptions.filter((option) => option.amountPaise > 0),
    }))
    .filter((server) => server.plans.length > 0);

  return (
    <section className="mt-10 max-w-3xl border-t border-border pt-10">
      <h2 className="text-2xl font-semibold">Hosted server access pricing</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Prepaid access to one WallBang Counter-Strike 2 community server. Paid
        once for the term. No automatic renewal. Prices below are the same
        amounts charged at checkout.
      </p>
      {pricedServers.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Server prices are listed on the Pricing page before payment.
        </p>
      ) : (
        pricedServers.map((server) => (
          <div key={server.id} className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">
              {server.label}
            </h3>
            <ul className="mt-3 divide-y divide-border border border-border">
              {server.plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {hostedAccessPlanLabel(plan.name)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatInrFromPaise(plan.amountPaise)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Link
        href="/pricing"
        className={cn(buttonVariants({ className: "mt-5" }))}
      >
        View pricing
      </Link>
    </section>
  );
}
