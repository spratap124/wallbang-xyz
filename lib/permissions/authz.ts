import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getPluginApiKey } from "@/lib/permissions/constants";
import { hasPermission } from "@/lib/permissions/service";
import type { ApiResult } from "@/lib/api/waitlist";
import type { AuthUser } from "@/types/auth";
import type { PermissionCode } from "@/types/permissions";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data } satisfies ApiResult<T>, {
    status,
  });
}

export function jsonError(
  error: string,
  status = 400,
  fieldErrors?: Record<string, string[]>,
): NextResponse {
  return NextResponse.json(
    { ok: false, error, fieldErrors } satisfies ApiResult<never>,
    { status },
  );
}

export async function requireSession(): Promise<
  { user: AuthUser } | { response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { response: jsonError("Unauthorized.", 401) };
  }
  return { user };
}

export async function requirePermission(
  permission: PermissionCode,
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const session = await requireSession();
  if ("response" in session) return session;

  const allowed = await hasPermission({
    userId: session.user.id,
    permission,
  });
  if (!allowed) {
    return { response: jsonError("Forbidden.", 403) };
  }
  return session;
}

export function requirePluginApiKey(
  request: Request,
): { ok: true } | { response: NextResponse } {
  const expected = getPluginApiKey();
  if (!expected) {
    return {
      response: jsonError("Plugin API key is not configured.", 503),
    };
  }

  const provided =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!provided || provided !== expected) {
    return { response: jsonError("Unauthorized.", 401) };
  }
  return { ok: true };
}
