import { getLiveServers } from "@/lib/servers/status";
import type { ServersResponse } from "@/lib/servers/types";
import { rateLimit, sweepRateLimitBuckets } from "@/lib/rate-limit";

// dgram (A2S over UDP) needs the Node.js runtime; Edge has no UDP sockets.
export const runtime = "nodejs";
// Freshness is controlled via the Mongo snapshot, never the CDN.
export const dynamic = "force-dynamic";

const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000; // per minute per IP

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: Request): Promise<Response> {
  sweepRateLimitBuckets();

  const limit = rateLimit(clientIp(request), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return Response.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(limit.limit),
          "RateLimit-Remaining": String(limit.remaining),
        },
      },
    );
  }

  try {
    const servers = await getLiveServers();
    const body: ServersResponse = { servers, count: servers.length };

    return Response.json(body, {
      headers: {
        "Cache-Control": "no-store",
        "RateLimit-Limit": String(limit.limit),
        "RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to load server status." },
      { status: 500 },
    );
  }
}
