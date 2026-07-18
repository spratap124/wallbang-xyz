import { NextResponse } from "next/server";

import { featureFlags } from "@/config/features.flags";
import { getSiteUrl, isSteamAuthConfigured } from "@/lib/auth/config";
import {
  buildSteamLoginUrl,
  sanitizeReturnTo,
} from "@/lib/auth/steam-openid";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request): Promise<Response> {
  if (!featureFlags.steamAuth || !isSteamAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Steam login is not available." },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`steam-login:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many login attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const callback = new URL("/api/auth/steam/callback", getSiteUrl());
  callback.searchParams.set("returnTo", returnTo);

  const steamUrl = buildSteamLoginUrl(callback.toString());
  return NextResponse.redirect(steamUrl);
}
