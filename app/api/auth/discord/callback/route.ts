import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { linkDiscordAccount } from "@/lib/auth/users";
import { getSiteUrl } from "@/lib/auth/config";
import { isDiscordOAuthConfigured } from "@/lib/discord/config";
import { announceLaunchGiveawayGrant } from "@/lib/discord/giveaway-announce";
import {
  discordOfferReturnUrl,
  exchangeDiscordCode,
  fetchDiscordIdentity,
  parseDiscordOAuthState,
} from "@/lib/discord/oauth";
import { processLaunchGiveaway } from "@/lib/permissions/service";
import { isMongoConfigured } from "@/lib/mongo";
import { rateLimit } from "@/lib/rate-limit";

function isOffersReturnTo(returnTo: string): boolean {
  return new URL(returnTo, getSiteUrl()).pathname === "/offers";
}

function redirectOffers(status: string): NextResponse {
  return NextResponse.redirect(discordOfferReturnUrl(status));
}

function redirectToProfile(returnTo: string, status: string): NextResponse {
  const target = new URL(returnTo, getSiteUrl());
  target.searchParams.set("discord", status);
  return NextResponse.redirect(target);
}

/**
 * Discord OAuth callback — link Discord to Steam user, then try VIP grant.
 * GET /api/auth/discord/callback?code=...&state=...
 */
export async function GET(request: Request): Promise<Response> {
  if (!isDiscordOAuthConfigured()) {
    return redirectOffers("unavailable");
  }
  if (!isMongoConfigured()) {
    return redirectOffers("database");
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`discord-callback:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return redirectOffers("rate_limit");
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/steam?returnTo=/offers", getSiteUrl()),
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return redirectOffers("denied");
  }

  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  if (!code || !stateRaw) {
    return redirectOffers("failed");
  }

  let returnTo = "/offers";
  try {
    const state = parseDiscordOAuthState(stateRaw);
    returnTo = state.returnTo;
    if (state.userId !== session.id) {
      return redirectOffers("session_mismatch");
    }

    const { accessToken } = await exchangeDiscordCode(code);
    const identity = await fetchDiscordIdentity(accessToken);
    const displayName = identity.globalName || identity.username;

    await linkDiscordAccount({
      userId: session.id,
      discordUserId: identity.id,
      discordUsername: displayName,
    });

    // Discord linking is also available from the player profile. Keep that
    // account-link action independent of the expired launch giveaway flow.
    if (!isOffersReturnTo(state.returnTo)) {
      return redirectToProfile(state.returnTo, "linked");
    }

    const giveaway = await processLaunchGiveaway({
      steamId: session.steamId,
      discordUserId: identity.id,
      discordUsername: displayName,
    });

    if (giveaway.status === "granted") {
      void announceLaunchGiveawayGrant(giveaway).catch((err) => {
        console.error("[discord/callback] Discord announcement failed", err);
      });
      return NextResponse.redirect(discordOfferReturnUrl("granted"));
    }
    if (giveaway.status === "already_granted") {
      return NextResponse.redirect(discordOfferReturnUrl("linked"));
    }
    if (giveaway.status === "not_in_guild") {
      return NextResponse.redirect(discordOfferReturnUrl("not_in_guild"));
    }
    if (giveaway.status === "slots_full") {
      return NextResponse.redirect(discordOfferReturnUrl("slots_full"));
    }
    if (giveaway.status === "ineligible") {
      return NextResponse.redirect(discordOfferReturnUrl("ineligible"));
    }
    if (giveaway.status === "revoked") {
      return NextResponse.redirect(discordOfferReturnUrl("revoked"));
    }

    const redirectUrl = new URL(state.returnTo, getSiteUrl());
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[discord/callback]", err);
    const message = err instanceof Error ? err.message : "";
    if (!isOffersReturnTo(returnTo)) {
      return redirectToProfile(
        returnTo,
        message.includes("already linked") ? "already_linked" : "failed",
      );
    }
    if (message.includes("already linked")) {
      return redirectOffers("already_linked");
    }
    return redirectOffers("failed");
  }
}
