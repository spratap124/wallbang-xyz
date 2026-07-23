import {
  CheckCircle2,
  Crown,
  ExternalLink,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { DiscordVerifyButton } from "@/components/offers/discord-verify-button";
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
import { isDiscordLinkConfigured } from "@/lib/discord/config";
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
    "Claim 3 months of free WallBang VIP — sign in with Steam, join Discord, then verify. First 100 players get reserved slots, VIP chat tag, and more.",
  path: "/offers",
});

function formatExpiry(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

type UserGiveawayState =
  | {
      kind: "active";
      position: number;
      expiresAt: Date;
      justGranted: boolean;
    }
  | { kind: "slots_full" }
  | { kind: "needs_discord" }
  | { kind: "not_in_guild"; discordUsername: string | null }
  | { kind: "ineligible" };

function discordFlashMessage(
  value: string | undefined,
): { tone: "ok" | "warn" | "error"; text: string } | null {
  switch (value) {
    case "granted":
      return { tone: "ok", text: "Discord linked — VIP is now active." };
    case "linked":
      return { tone: "ok", text: "Discord linked successfully." };
    case "not_in_guild":
      return {
        tone: "warn",
        text: "Discord linked, but you're not in the WallBang server yet. Join, then verify.",
      };
    case "slots_full":
      return {
        tone: "warn",
        text: "Discord linked, but launch VIP slots are full.",
      };
    case "already_linked":
      return {
        tone: "error",
        text: "That Discord account is already linked to another WallBang user.",
      };
    case "denied":
      return { tone: "error", text: "Discord authorization was cancelled." };
    case "failed":
    case "session_mismatch":
    case "rate_limit":
    case "unavailable":
    case "database":
    case "ineligible":
      return {
        tone: "error",
        text: "Could not link Discord. Try again in a moment.",
      };
    default:
      return null;
  }
}

export default async function LaunchOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const session = await getSession();
  const { discord: discordParam } = await searchParams;
  const flash = discordFlashMessage(discordParam);
  const discordReady = isDiscordLinkConfigured();

  let giveawayStatus = {
    maxWinners: 100,
    claimed: 0,
    remaining: 100,
    vipMonths: 3,
  };
  let userGiveaway: UserGiveawayState | null = null;

  if (isMongoConfigured()) {
    giveawayStatus = await getLaunchGiveawayStatus();

    if (session) {
      const result = await processLaunchGiveaway({ steamId: session.steamId });
      if (result.status === "granted") {
        userGiveaway = {
          kind: "active",
          position: result.position,
          expiresAt: result.expiresAt!,
          justGranted: true,
        };
        void announceLaunchGiveawayGrant(result).catch((err) => {
          console.error("[offers] Discord announcement failed", err);
        });
      } else if (result.status === "already_granted" && result.expiresAt) {
        userGiveaway = {
          kind: "active",
          position: result.position,
          expiresAt: result.expiresAt,
          justGranted: false,
        };
      } else if (result.status === "slots_full") {
        const permissions = await getUserPermissions({
          steamId: session.steamId,
        });
        const hasGiveawayVip = permissions?.activeAssignments.some(
          (a) => a.roleCode === "VIP" && a.source === "GIVEAWAY",
        );
        if (!hasGiveawayVip) {
          userGiveaway = { kind: "slots_full" };
        }
      } else if (result.status === "needs_discord") {
        userGiveaway = { kind: "needs_discord" };
      } else if (result.status === "not_in_guild") {
        userGiveaway = {
          kind: "not_in_guild",
          discordUsername: result.discordUsername ?? null,
        };
      } else if (result.status === "ineligible") {
        userGiveaway = { kind: "ineligible" };
      }
    }
  }

  const slotsRemaining = giveawayStatus.remaining;
  const isOfferOpen = slotsRemaining > 0;

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-offers-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Offers", path: "/offers" },
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
          description="Sign in with Steam, join the WallBang Discord, then verify membership. VIP unlocks only after both steps while slots last."
        />

        {flash ? (
          <div
            className={cn(
              "mb-6 rounded-xl border px-4 py-3 text-sm",
              flash.tone === "ok" &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
              flash.tone === "warn" &&
                "border-amber-500/40 bg-amber-500/10 text-amber-100",
              flash.tone === "error" &&
                "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {flash.text}
          </div>
        ) : null}

        {session && userGiveaway?.kind === "active" ? (
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
                  VIP chat tag.
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
                    Open Discord
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : session && userGiveaway?.kind === "needs_discord" ? (
          <div className="mb-10 rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,rgba(232,36,42,0.12),transparent_45%),#12151a] px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">
              Step 1 done — finish with Discord
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              You&apos;re signed in as <strong>{session.personaName}</strong>.
              Join the WallBang Discord, then link Discord here so we can confirm
              membership and unlock VIP.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={siteConfig.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <MessageCircle />
                Join Discord
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
              {discordReady ? (
                <a
                  href="/api/auth/discord?returnTo=/offers"
                  className={buttonVariants()}
                >
                  Link Discord &amp; claim VIP
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Discord linking is temporarily unavailable. Check back soon.
                </p>
              )}
            </div>
          </div>
        ) : session && userGiveaway?.kind === "not_in_guild" ? (
          <div className="mb-10 rounded-2xl border border-amber-500/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),transparent_45%),#12151a] px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">
              Discord linked — join the server next
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Linked as{" "}
              <strong>
                {userGiveaway.discordUsername ?? "your Discord account"}
              </strong>
              . Join the WallBang Discord server, then verify membership to claim
              VIP.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={siteConfig.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants()}
              >
                <MessageCircle />
                Join Discord
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
              <DiscordVerifyButton />
            </div>
          </div>
        ) : session && userGiveaway?.kind === "slots_full" ? (
          <div className="mb-10 rounded-2xl border border-border bg-card px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">Launch offer is full</h2>
            <p className="mt-2 text-muted-foreground">
              All {giveawayStatus.maxWinners} VIP slots have been claimed.
              You&apos;re signed in as <strong>{session.personaName}</strong> —
              follow Discord for future VIP announcements.
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
        ) : session && userGiveaway?.kind === "ineligible" ? (
          <div className="mb-10 rounded-2xl border border-border bg-card px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">Staff account</h2>
            <p className="mt-2 text-muted-foreground">
              Owner and staff accounts are not eligible for the launch VIP offer.
            </p>
          </div>
        ) : !session && isOfferOpen ? (
          <div className="mb-10 rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,rgba(232,36,42,0.12),transparent_45%),#12151a] px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold">Ready to claim your VIP?</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Sign in with Steam first, then join Discord and verify. VIP is only
              granted after both steps while slots remain.
            </p>
            <a
              href="/api/auth/steam?returnTo=/offers"
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
              {launchOfferSteps.map((item) => {
                const done =
                  (item.step === 1 && Boolean(session)) ||
                  (item.step === 2 &&
                    (userGiveaway?.kind === "active" ||
                      userGiveaway?.kind === "not_in_guild")) ||
                  (item.step === 3 && userGiveaway?.kind === "active");
                return (
                  <li
                    key={item.step}
                    className="flex gap-4 rounded-xl border border-border bg-card p-4"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        done
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {done ? "✓" : item.step}
                    </span>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
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
