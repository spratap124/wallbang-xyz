import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import {
  authConfig,
  getAuthSecret,
  isSteamAuthConfigured,
} from "@/lib/auth/config";
import type { AuthUser, SessionPayload } from "@/types/auth";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    steamId: user.steamId,
    personaName: user.personaName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
  } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${authConfig.sessionMaxAgeSeconds}s`)
    .sign(secretKey());
}

export async function readSessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const steamId =
      typeof payload.steamId === "string" ? payload.steamId : null;
    const personaName =
      typeof payload.personaName === "string" ? payload.personaName : null;
    const avatarUrl =
      typeof payload.avatarUrl === "string" ? payload.avatarUrl : null;
    const profileUrl =
      typeof payload.profileUrl === "string" ? payload.profileUrl : null;

    if (!sub || !steamId || !personaName || avatarUrl === null || !profileUrl) {
      return null;
    }

    return { sub, steamId, personaName, avatarUrl, profileUrl };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = authConfig.sessionMaxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(authConfig.sessionCookie, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(authConfig.sessionCookie, "", sessionCookieOptions(0));
}

export async function getSession(): Promise<AuthUser | null> {
  if (!isSteamAuthConfigured()) return null;

  const jar = await cookies();
  const token = jar.get(authConfig.sessionCookie)?.value;
  if (!token) return null;

  const payload = await readSessionToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    steamId: payload.steamId,
    personaName: payload.personaName,
    avatarUrl: payload.avatarUrl,
    profileUrl: payload.profileUrl,
  };
}
