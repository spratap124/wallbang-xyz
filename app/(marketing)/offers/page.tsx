import {
  Check,
  Circle,
  Crown,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";

import { DiscordVerifyButton } from "@/components/offers/discord-verify-button";
import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { buttonVariants } from "@/components/ui/button";
import {
  launchOfferIncludes,
  launchOfferRewardBenefits,
  launchOfferSteps,
} from "@/content/offer";
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
  title: "Launch VIP",
  description:
    "Become one of WallBang's first 100 players and unlock 3 months of Launch VIP. Sign in with Steam, join Discord, and claim your limited-time reward.",
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

function StatusIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
        <Check className="size-5" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted-foreground ring-1 ring-border">
      <Circle className="size-5" strokeWidth={2} />
    </span>
  );
}

function SpotsRemaining({
  claimed,
  remaining,
  maxWinners,
}: {
  claimed: number | null;
  remaining: number | null;
  maxWinners: number;
}) {
  if (claimed === null || remaining === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-border/80 bg-white/[0.02] px-4 py-1.5 text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
        Spot counter coming soon
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-4 py-1.5 text-sm text-muted-foreground">
        All {maxWinners} spots claimed
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-400">
        <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
        {claimed} / {maxWinners} claimed
      </div>
      <div className="inline-flex items-center rounded-full border border-border/80 bg-white/[0.03] px-4 py-1.5 text-sm text-muted-foreground">
        {remaining} spots remaining
      </div>
    </div>
  );
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

  let giveawayStatus: {
    maxWinners: number;
    claimed: number;
    remaining: number;
    vipMonths: number;
  } | null = null;
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

  const maxWinners = giveawayStatus?.maxWinners ?? 100;
  const vipMonths = giveawayStatus?.vipMonths ?? 3;
  const claimed = giveawayStatus?.claimed ?? null;
  const remaining = giveawayStatus?.remaining ?? null;
  const isOfferOpen = remaining === null || remaining > 0;

  const steamDone = Boolean(session);
  const discordDone = userGiveaway?.kind === "active";
  const stepsCompleted = (steamDone ? 1 : 0) + (discordDone ? 1 : 0);
  const progressPercent = (stepsCompleted / 2) * 100;

  const showRewardSuccess = userGiveaway?.kind === "active";
  const isSlotsFull = userGiveaway?.kind === "slots_full";
  const isIneligible = userGiveaway?.kind === "ineligible";

  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.12),transparent_60%)]"
      />
      <JsonLd
        id="ld-offers-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Offers", path: "/offers" },
        ])}
      />
      <Container className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.1]">
            🎉 Become one of WallBang&apos;s first {maxWinners} players
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Complete the two steps below to unlock {vipMonths} months of Launch
            VIP. This limited-time reward is available only while spots remain.
          </p>

          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-border/80 bg-card/80 p-6 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="size-5 text-red-500" />
              <h2 className="text-base font-semibold tracking-tight">
                Launch VIP includes:
              </h2>
            </div>
            <ul className="space-y-3">
              {launchOfferIncludes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted-foreground sm:text-[15px]"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-red-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex justify-center">
            <SpotsRemaining
              claimed={claimed}
              remaining={remaining}
              maxWinners={maxWinners}
            />
          </div>
        </section>

        {flash ? (
          <div
            className={cn(
              "mx-auto mt-10 max-w-3xl rounded-2xl border px-4 py-3 text-sm",
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

        {isIneligible ? (
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card px-6 py-8 sm:px-8">
            <h2 className="text-xl font-semibold">Staff account</h2>
            <p className="mt-2 text-muted-foreground">
              Owner and staff accounts are not eligible for the launch VIP offer.
            </p>
          </div>
        ) : isSlotsFull || (!isOfferOpen && !showRewardSuccess) ? (
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card px-6 py-8 sm:px-8">
            <h2 className="text-xl font-semibold">Launch VIP is full</h2>
            <p className="mt-2 text-muted-foreground">
              All {maxWinners} spots have been claimed
              {session ? (
                <>
                  . You&apos;re signed in as{" "}
                  <strong>{session.personaName}</strong>
                </>
              ) : null}
              . Join Discord to stay updated on future VIP drops.
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
        ) : (
          <>
            {/* Progress */}
            <section className="mx-auto mt-14 max-w-3xl">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Progress
                </h2>
                <p className="text-sm text-muted-foreground">
                  {stepsCompleted} of 2 steps completed
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5 ring-1 ring-border/60">
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </section>

            {/* Step cards */}
            <section className="mx-auto mt-10 grid max-w-3xl gap-4 sm:gap-5">
              {/* Step 1 — Steam */}
              <article
                className={cn(
                  "rounded-2xl border p-6 transition-colors sm:p-7",
                  steamDone
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-border/80 bg-card/80",
                )}
              >
                <div className="flex gap-4">
                  <StatusIcon done={steamDone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Step 1
                      </p>
                      {steamDone ? (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Complete
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">
                      {launchOfferSteps[0].title}
                    </h3>
                    {steamDone ? (
                      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <Check className="size-4" />
                        {launchOfferSteps[0].successLabel}
                        {session ? (
                          <span className="font-normal text-muted-foreground">
                            · {session.personaName}
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {launchOfferSteps[0].description}
                        </p>
                        <a
                          href="/api/auth/steam?returnTo=/offers"
                          className={cn(
                            buttonVariants({
                              size: "lg",
                              className: "mt-5 bg-red-500 hover:bg-red-500/90",
                            }),
                          )}
                        >
                          Continue with Steam
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </article>

              {/* Step 2 — Discord */}
              <article
                className={cn(
                  "rounded-2xl border p-6 transition-colors sm:p-7",
                  discordDone
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-border/80 bg-card/80",
                )}
              >
                <div className="flex gap-4">
                  <StatusIcon done={discordDone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Step 2
                      </p>
                      {discordDone ? (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Complete
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">
                      {launchOfferSteps[1].title}
                    </h3>
                    {discordDone ? (
                      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <Check className="size-4" />
                        {launchOfferSteps[1].successLabel}
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {launchOfferSteps[1].description}
                        </p>
                        {userGiveaway?.kind === "not_in_guild" ? (
                          <p className="mt-3 text-sm text-amber-200/90">
                            Linked as{" "}
                            <strong>
                              {userGiveaway.discordUsername ??
                                "your Discord account"}
                            </strong>
                            . Join the server, then verify below.
                          </p>
                        ) : null}
                        {steamDone ? (
                          <div className="mt-5 flex flex-wrap items-start gap-3">
                            <a
                              href={siteConfig.discordUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({
                                  size: "lg",
                                  className:
                                    "bg-red-500 hover:bg-red-500/90",
                                }),
                              )}
                            >
                              <MessageCircle />
                              Join Discord
                              <ExternalLink className="size-3.5 opacity-70" />
                            </a>
                            {userGiveaway?.kind === "not_in_guild" ? (
                              <DiscordVerifyButton size="lg" />
                            ) : discordReady ? (
                              <a
                                href="/api/auth/discord?returnTo=/offers"
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "lg",
                                  }),
                                )}
                              >
                                I&apos;ve already joined
                              </a>
                            ) : (
                              <p className="self-center text-sm text-muted-foreground">
                                Discord linking is temporarily unavailable.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">
                            Sign in with Steam first to continue.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            </section>

            {/* Reward section */}
            <section className="mx-auto mt-10 max-w-3xl">
              {showRewardSuccess && userGiveaway?.kind === "active" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-6 sm:p-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    🎉 Launch VIP Activated
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Your VIP benefits are now available on all WallBang servers.
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Entry <strong>#{userGiveaway.position}</strong> of{" "}
                    {maxWinners} · Active until{" "}
                    <strong>{formatExpiry(userGiveaway.expiresAt)}</strong>
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-card/80 p-6 sm:p-8">
                  <div className="mb-4 flex items-center gap-2">
                    <Crown className="size-5 text-red-500" />
                    <h2 className="text-lg font-semibold tracking-tight">
                      Launch VIP Reward
                    </h2>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    After both requirements are completed, your Launch VIP is
                    activated automatically.
                  </p>
                  <p className="mt-5 text-sm font-medium text-foreground">
                    Benefits:
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {launchOfferRewardBenefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-start gap-3 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-red-500" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Primary CTA */}
            <section className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {!steamDone ? (
                <a
                  href="/api/auth/steam?returnTo=/offers"
                  className={cn(
                    buttonVariants({
                      size: "lg",
                      className:
                        "w-full bg-red-500 px-8 hover:bg-red-500/90 sm:w-auto",
                    }),
                  )}
                >
                  Continue with Steam
                </a>
              ) : showRewardSuccess ? (
                <Link
                  href="/profile"
                  className={cn(
                    buttonVariants({
                      size: "lg",
                      className:
                        "w-full bg-red-500 px-8 hover:bg-red-500/90 sm:w-auto",
                    }),
                  )}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <a
                    href={siteConfig.discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        size: "lg",
                        className:
                          "w-full bg-red-500 px-8 hover:bg-red-500/90 sm:w-auto",
                      }),
                    )}
                  >
                    <MessageCircle />
                    Join Discord
                  </a>
                  {userGiveaway?.kind === "not_in_guild" ? (
                    <DiscordVerifyButton size="lg" className="w-full sm:w-auto" />
                  ) : discordReady ? (
                    <a
                      href="/api/auth/discord?returnTo=/offers"
                      className={cn(
                        buttonVariants({
                          variant: "outline",
                          size: "lg",
                          className: "w-full sm:w-auto",
                        }),
                      )}
                    >
                      I&apos;ve already joined
                    </a>
                  ) : null}
                </>
              )}
            </section>
          </>
        )}
      </Container>
    </div>
  );
}
