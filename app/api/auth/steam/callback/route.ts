import { NextResponse } from "next/server";

import { featureFlags } from "@/config/features.flags";
import {
  authConfig,
  getSiteUrl,
  isSteamAuthConfigured,
} from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { fetchSteamPlayerSummary } from "@/lib/auth/steam-api";
import {
  sanitizeReturnTo,
  verifySteamOpenIdAssertion,
} from "@/lib/auth/steam-openid";
import { upsertSteamUser } from "@/lib/auth/users";
import { isMongoConfigured } from "@/lib/mongo";
import { rateLimit } from "@/lib/rate-limit";

function redirectWithError(code: string): NextResponse {
  const url = new URL("/", getSiteUrl());
  url.searchParams.set("authError", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<Response> {
  if (!featureFlags.steamAuth || !isSteamAuthConfigured()) {
    return redirectWithError("unavailable");
  }

  if (!isMongoConfigured()) {
    return redirectWithError("database");
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`steam-callback:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return redirectWithError("rate_limit");
  }

  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  try {
    const steamId = await verifySteamOpenIdAssertion(searchParams);
    const profile = await fetchSteamPlayerSummary(steamId);
    const user = await upsertSteamUser(profile);
    const token = await createSessionToken(user);

    const response = NextResponse.redirect(new URL(returnTo, getSiteUrl()));
    response.cookies.set(
      authConfig.sessionCookie,
      token,
      sessionCookieOptions(),
    );
    return response;
  } catch (err) {
    console.error("[steam/callback]", err);
    return redirectWithError("failed");
  }
}
