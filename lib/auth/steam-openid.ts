import "server-only";

import { authConfig, getSiteUrl } from "@/lib/auth/config";

const OPENID_NS = "http://specs.openid.net/auth/2.0";

/**
 * Build the Steam OpenID 2.0 redirect URL.
 * Steam is a fixed identity provider — no client secret on the redirect step.
 */
export function buildSteamLoginUrl(returnTo: string): string {
  const siteUrl = getSiteUrl();
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": siteUrl,
    "openid.identity": `${OPENID_NS}/identifier_select`,
    "openid.claimed_id": `${OPENID_NS}/identifier_select`,
  });

  return `${authConfig.steamOpenIdEndpoint}?${params.toString()}`;
}

/**
 * Ask Steam to confirm the signed assertion from the browser redirect.
 * Must POST every openid.* param with mode forced to check_authentication.
 */
export async function verifySteamOpenIdAssertion(
  searchParams: URLSearchParams,
): Promise<string> {
  const mode = searchParams.get("openid.mode");
  if (mode !== "id_res") {
    throw new Error("Invalid OpenID mode.");
  }

  const claimedId = searchParams.get("openid.claimed_id");
  if (!claimedId?.startsWith(authConfig.steamIdClaimPrefix)) {
    throw new Error("Invalid Steam claimed_id.");
  }

  const returnTo = searchParams.get("openid.return_to");
  const expectedCallback = `${getSiteUrl()}/api/auth/steam/callback`;
  if (!returnTo || !returnTo.startsWith(expectedCallback)) {
    throw new Error("OpenID return_to mismatch.");
  }

  const body = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("openid.")) continue;
    if (key === "openid.mode") {
      body.set(key, "check_authentication");
    } else {
      body.set(key, value);
    }
  }

  const response = await fetch(authConfig.steamOpenIdEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Steam OpenID verify failed (${response.status}).`);
  }

  const text = await response.text();
  if (!text.includes("is_valid:true")) {
    throw new Error("Steam OpenID assertion rejected.");
  }

  const steamId = claimedId.slice(authConfig.steamIdClaimPrefix.length);
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("Invalid SteamID64.");
  }

  return steamId;
}

/**
 * Only allow same-origin relative paths as post-login redirects.
 * Blocks protocol-relative and absolute URLs (open redirect).
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.includes("\\") || raw.includes("@")) return "/";
  return raw;
}
