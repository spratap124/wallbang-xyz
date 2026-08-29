import {
  ChevronRight,
  CreditCard,
  Headset,
  MessageCircle,
  Server,
  Sparkles,
  ExternalLink,
  Timer,
} from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { VipHero } from "@/components/vip/vip-hero";
import { VipPageBody } from "@/components/vip/vip-page-body";
import { LiveServersProvider } from "@/components/servers/live-servers-provider";
import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { getVipShopCatalog } from "@/config/vip-plans";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { getUserVipMembership } from "@/lib/payments/entitlements";
import { isPaymentConfigured, isPayuActive } from "@/lib/payments/provider";
import {
  isVipAllRetakesEnabled,
  isVipCheckoutEnabled,
  isVipPageEnabled,
} from "@/lib/platform/feature-flags";
import { getGameServers } from "@/lib/servers/registry";
import { cn } from "@/lib/utils";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "VIP",
  description:
    "Buy prepaid WallBang VIP — pick servers, choose 1 / 3 / 6 months or 1 year, pay once. No auto-renewal.",
  path: "/vip",
});

type VipPageProps = {
  searchParams: Promise<{ paid?: string }>;
};

const howItWorks = [
  {
    icon: Server,
    title: "Select servers",
    body: "Pick the server(s) you want VIP access to.",
  },
  {
    icon: Timer,
    title: "Choose duration",
    body: "Pick 1M, 3M, 6M or 1Y that suits you.",
  },
  {
    icon: CreditCard,
    title: "Pay once",
    body: "Make a one-time payment. That's it.",
  },
  {
    icon: Sparkles,
    title: "Enjoy VIP",
    body: "VIP turns off when the term ends. Renew anytime.",
  },
] as const;

function SteamMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.304 1.265.789.354 1.81.323 2.545-.24.741-.567.948-1.509.55-2.24-.395-.728-1.277-.997-2.083-.786-.263.07-.505.196-.715.366l1.52.628c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012h-.003zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

export default async function VipPage({ searchParams }: VipPageProps) {
  if (!(await isVipPageEnabled())) {
    redirect("/");
  }

  const params = await searchParams;
  const paid = params.paid === "1";
  const session = await getSession();
  const servers = await getGameServers();
  const catalog = getVipShopCatalog(servers);
  const purchasesEnabled = isPaymentConfigured();
  const paymentProvider = isPayuActive() ? "payu" : "razorpay";
  const [allRetakesEnabled, checkoutEnabled] = await Promise.all([
    isVipAllRetakesEnabled(),
    isVipCheckoutEnabled(),
  ]);

  let membership = null;
  let lifetime = false;

  if (session && isMongoConfigured()) {
    membership = await getUserVipMembership({
      userId: session.id,
      eligibleServers: servers.map((server) => ({
        id: server.id,
        shortName: server.shortName || server.name,
        name: server.name,
      })),
    });
    lifetime = membership.lifetime;
  }

  return (
    <div>
      <JsonLd
        id="ld-vip-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "VIP", path: "/vip" },
        ])}
      />
      <VipHero />

      <Container className="py-10 sm:py-12">
        {session ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-5 py-4">
            <div className="flex items-center gap-3">
              {session.avatarUrl ? (
                <Image
                  src={session.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full border border-border object-cover"
                  unoptimized
                />
              ) : (
                <SteamMark className="size-8 text-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {session.personaName}
                </span>
                . VIP will be applied to this Steam account.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 flex flex-col gap-4 rounded-xl border border-border bg-card/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <SteamMark className="size-8 text-foreground" />
              <p className="text-sm">
                <span className="font-semibold">Sign in with Steam</span>
                <span className="text-muted-foreground">
                  {" "}
                  — Buy VIP on the same account you use in-game.
                </span>
              </p>
            </div>
            <a
              href="/api/auth/steam?returnTo=/vip"
              className={cn(buttonVariants({ size: "lg" }), "h-11 shrink-0 gap-2")}
            >
              Continue with Steam
              <ExternalLink />
            </a>
          </div>
        )}

        <LiveServersProvider>
          <VipPageBody
            catalog={catalog}
            loggedIn={Boolean(session)}
            purchasesEnabled={purchasesEnabled}
            paymentProvider={paymentProvider}
            checkoutEnabled={checkoutEnabled}
            allRetakesEnabled={allRetakesEnabled}
            hideBuy={lifetime}
            membership={membership}
            paid={paid}
          />
        </LiveServersProvider>

        <section className="mt-16">
          <h2 className="text-center text-lg font-semibold">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, index) => (
              <li key={step.title} className="relative text-center">
                {index < howItWorks.length - 1 ? (
                  <ChevronRight
                    className="pointer-events-none absolute top-5 -right-3 hidden size-5 text-muted-foreground/40 lg:block"
                    aria-hidden
                  />
                ) : null}
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <step.icon className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card/60 px-6 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Need help?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Join our Discord or contact support.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={siteConfig.discordUrl}
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "h-11")}
            >
              <MessageCircle />
              Join Discord
            </a>
            <a
              href="/contact"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
            >
              <Headset />
              Contact Support
            </a>
          </div>
        </section>
      </Container>
    </div>
  );
}
