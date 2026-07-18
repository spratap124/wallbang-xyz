import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import type { ApiResult } from "@/lib/api/waitlist";
import type { AuthUser } from "@/types/auth";

export async function GET(): Promise<Response> {
  const user = await getSession();

  if (!user) {
    return NextResponse.json(
      { ok: true, data: null } satisfies ApiResult<AuthUser | null>,
    );
  }

  return NextResponse.json({
    ok: true,
    data: user,
  } satisfies ApiResult<AuthUser>);
}
