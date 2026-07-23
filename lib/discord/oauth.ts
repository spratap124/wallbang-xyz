import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getAuthSecret, getSiteUrl } from "@/lib/auth/config";
import {
  getDiscordClientId,
  getDiscordClientSecret,
  getDiscordOAuthRedirectUri,
} from "@/lib/discord/config";
import { sanitizeReturnTo } from "@/lib/auth/steam-openid";

const STATE_TTL_MS = 10 * 60 * 1000;

type DiscordOAuthState = {
  returnTo: string;
  userId: string;
  exp: number;
};

export type DiscordIdentity = {
  id: string;
  username: string;
  globalName: string | null;
};

function signPayload(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createDiscordOAuthState(input: {
  userId: string;
  returnTo?: string | null;
}): string {
  const state: DiscordOAuthState = {
    returnTo: sanitizeReturnTo(input.returnTo ?? "/offers"),
    userId: input.userId,
    exp: Date.now() + STATE_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  );
  return `${payload}.${signPayload(payload)}`;
}

export function parseDiscordOAuthState(raw: string): DiscordOAuthState {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) throw new Error("Invalid Discord OAuth state.");

  const expected = signPayload(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Discord OAuth state signature mismatch.");
  }

  const state = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as DiscordOAuthState;

  if (!state.userId || !state.returnTo || !state.exp) {
    throw new Error("Discord OAuth state is incomplete.");
  }
  if (Date.now() > state.exp) {
    throw new Error("Discord OAuth state expired.");
  }
  return {
    ...state,
    returnTo: sanitizeReturnTo(state.returnTo),
  };
}

export function buildDiscordAuthorizeUrl(state: string): string {
  const clientId = getDiscordClientId();
  if (!clientId) throw new Error("DISCORD_CLIENT_ID is not set.");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getDiscordOAuthRedirectUri(),
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(
  code: string,
): Promise<{ accessToken: string }> {
  const clientId = getDiscordClientId();
  const clientSecret = getDiscordClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Discord OAuth is not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: getDiscordOAuthRedirectUri(),
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Discord token exchange failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Discord token response missing access_token.");
  }
  return { accessToken: json.access_token };
}

export async function fetchDiscordIdentity(
  accessToken: string,
): Promise<DiscordIdentity> {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Discord identity fetch failed (${response.status}).`);
  }
  const json = (await response.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
  };
  if (!json.id) throw new Error("Discord identity missing id.");
  return {
    id: json.id,
    username: json.username,
    globalName: json.global_name ?? null,
  };
}

export function discordOfferReturnUrl(status?: string): string {
  const url = new URL("/offers", getSiteUrl());
  if (status) url.searchParams.set("discord", status);
  return url.toString();
}
