import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isDiscordLinkConfigured } from "@/lib/discord/config";
import {
  buildDiscordAuthorizeUrl,
  createDiscordOAuthState,
} from "@/lib/discord/oauth";
import { sanitizeReturnTo } from "@/lib/auth/steam-openid";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Start Discord OAuth to link Discord to the current Steam session.
 * GET /api/auth/discord?returnTo=/offers
 */
export async function GET(request: Request): Promise<Response> {
  if (!isDiscordLinkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Discord linking is not configured." },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    const login = new URL("/api/auth/steam", request.url);
    login.searchParams.set("returnTo", "/offers");
    return NextResponse.redirect(login);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`discord-oauth:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many Discord link attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo") ?? "/offers");
  const state = createDiscordOAuthState({
    userId: session.id,
    returnTo,
  });

  return NextResponse.redirect(buildDiscordAuthorizeUrl(state));
}
