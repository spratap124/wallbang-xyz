import {
  CheckCircle2,
  Crown,
  ExternalLink,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { launchOfferPerks, launchOfferSteps } from "@/content/offer";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import {
  getLaunchGiveawayStatus,
  getUserPermissions,
  processLaunchGiveaway,
} from "@/lib/permissions/service";
import { announceLaunchGiveawayGrant } from "@/lib/discord/giveaway-announce";
import { cn } from "@/lib/utils";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Launch VIP Offer",
  description:
    "Claim 3 months of free WallBang VIP — sign in with Steam and join Discord. First 100 players get reserved slots, VIP chat tag, and more.",
  path: "/offer",
});

function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default async function LaunchOfferPage() {
  const session = await getSession();
  let giveawayStatus = {
    maxWinners: 100,
    claimed: 0,
    remaining: 100,
    vipMonths: 3,
  };
  let userGiveaway:
    | {
        position: number;
        expiresAt: Date;
        justGranted: boolean;
      }
    | { slotsFull: true }
    | null = null;

  if (isMongoConfigured()) {
    giveawayStatus = await getLaunchGiveawayStatus();

    if (session) {
      const result = await processLaunchGiveaway({ steamId: session.steamId });
      if (result.status === "granted") {
        userGiveaway = {
          position: result.position,
          expiresAt: result.expiresAt!,
          justGranted: true,
        };
        void announceLaunchGiveawayGrant(result).catch((err) => {
          console.error("[offer] Discord announcement failed", err);
        });
      } else if (result.status === "already_granted" && result.expiresAt) {
        userGiveaway = {
          position: result.position,
          expiresAt: result.expiresAt,
          justGranted: false,
        };
      } else if (result.status === "slots_full") {
        const permissions = await getUserPermissions({ steamId: session.steamId });
        const hasGiveawayVip = permissions?.activeAssignments.some(
          (a) => a.roleCode === "VIP" && a.source === "GIVEAWAY",
        );
        if (!hasGiveawayVip) {
          userGiveaway = { slotsFull: true };
        }
      }
    }
  }

  const slotsRemaining = giveawayStatus.remaining;
  const isOfferOpen = slotsRemaining > 0;

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-offer-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Launch VIP Offer", path: "/offer" },
        ])}
      />
      <Container>
        <div className="mb-12 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" />
            Limited launch offer
          </Badge>
          {isOfferOpen ? (
            <Badge variant="outline">
              {slotsRemaining} of {giveawayStatus.maxWinners} slots left
            </Badge>
          ) : (
            <Badge variant="destructive">All slots claimed</Badge>
          )}
        </div>

        <SectionHeading
          eyebrow="Launch offer"
          title={`${giveawayStatus.vipMonths} months of VIP — free for the first ${giveawayStatus.maxWinners} players`}
          description="No forms, no profile links, no extra steps. Sign in with Steam on WallBang and VIP is applied automatically while slots last. Then join Discord to stay close to the community."
        />

        {session && userGiveaway && "position" in userGiveaway ? (
          <div className="mb-10 rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,rgba(232,36,42,0.12),transparent_45%),#12151a] px-6 py-8 sm:px-10">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-0.5 size-8 shrink-0 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">
                  {userGiveaway.justGranted
                    ? "You're in — VIP is active!"
                    : "Your launch VIP is active"}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Entry <strong>#{userGiveaway.position}</strong> of{" "}
                  {giveawayStatus.maxWinners} · Active until{" "}
                  <strong>{formatExpiry(userGiveaway.expiresAt)}</strong>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Connect to WallBang CS2 servers to use your reserved slot and
                  VIP chat tag. Join Discord for updates and community.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/servers" className={buttonVariants()}>
                    Find a server
                  </Link>
                  <a
                    href={siteConfig.discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }))}
                  >
                    <MessageCircle />
                    Join Discord
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : session && userGiveaway && "slotsFull" in userGiveaway ? (
          <div className="mb-10 rounded-2xl border border-border bg-card px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">Launch offer is full</h2>
            <p className="mt-2 text-muted-foreground">
              All {giveawayStatus.maxWinners} VIP slots have been claimed. You&apos;re
              signed in as <strong>{session.personaName}</strong> — follow Discord
              for future VIP announcements.
            </p>
            <a
              href={siteConfig.discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ className: "mt-5" }))}
            >
              <MessageCircle />
              Join Discord
            </a>
          </div>
        ) : !session && isOfferOpen ? (
          <div className="mb-10 rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,rgba(232,36,42,0.12),transparent_45%),#12151a] px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">Ready to claim your VIP?</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Sign in with Steam to get {giveawayStatus.vipMonths} months of VIP
              instantly — no Discord posting required.
            </p>
            <a
              href="/api/auth/steam?returnTo=/offer"
              className={cn(buttonVariants({ size: "lg", className: "mt-5" }))}
            >
              Sign in with Steam
            </a>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-lg font-semibold">How it works</h3>
            <ol className="space-y-4">
              {launchOfferSteps.map((item) => (
                <li
                  key={item.step}
                  className="flex gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {!session ? (
              <a
                href={siteConfig.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", className: "mt-6" }),
                )}
              >
                <MessageCircle />
                Join Discord
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
            ) : null}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Crown className="size-5 text-primary" />
              <h3 className="text-lg font-semibold">What VIP includes</h3>
            </div>
            <div className="grid gap-3">
              {launchOfferPerks.map((perk) => (
                <Card key={perk.title} size="sm">
                  <CardHeader>
                    <CardTitle>{perk.title}</CardTitle>
                    <CardDescription>{perk.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Card className="mt-4 border-dashed">
              <CardContent className="pt-4 text-sm text-muted-foreground">
                VIP is cosmetic and access-focused — no pay-to-win advantages.
                Weapon stats and match rules stay the same for everyone.
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
