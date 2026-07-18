import "server-only";

import { siteConfig } from "@/config/site";

const SESSION_COOKIE = "wb_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need ≥32 characters).",
    );
  }
  return secret;
}

export function getSteamApiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new Error("STEAM_API_KEY is not set.");
  }
  return key;
}

/** True when Steam login can run (secret + API key present). */
export function isSteamAuthConfigured(): boolean {
  const secret = process.env.AUTH_SECRET;
  const key = process.env.STEAM_API_KEY;
  return Boolean(secret && secret.length >= 32 && key);
}

export function getSiteUrl(): string {
  return siteConfig.url.replace(/\/$/, "");
}

export const authConfig = {
  sessionCookie: SESSION_COOKIE,
  sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS,
  steamOpenIdEndpoint: "https://steamcommunity.com/openid/login",
  steamIdClaimPrefix: "https://steamcommunity.com/openid/id/",
} as const;
