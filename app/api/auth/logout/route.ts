import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";
import { sessionCookieOptions } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authConfig.sessionCookie, "", sessionCookieOptions(0));
  return response;
}
