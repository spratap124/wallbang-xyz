import { servers } from "@/config/servers";
import { measureSourceServerLatency } from "@/lib/server-ping";

export const runtime = "nodejs";
/** Run next to India so ping reflects HYD players, not US regions. */
export const preferredRegion = ["bom1", "sin1"];

type LatencySuccess = { ok: true; latencyMs: number; region: string };
type LatencyFailure = { ok: false; error: string };

async function measureBestOf(
  host: string,
  port: number,
  attempts = 3,
): Promise<number> {
  const samples: number[] = [];

  for (let i = 0; i < attempts; i += 1) {
    try {
      samples.push(await measureSourceServerLatency(host, port));
    } catch {
      // keep trying remaining samples
    }
  }

  if (!samples.length) {
    throw new Error("All ping attempts failed");
  }

  return Math.min(...samples);
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get("host");
  const portValue = searchParams.get("port");
  const port = portValue ? Number(portValue) : NaN;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Response.json(
      { ok: false, error: "Invalid host or port." } satisfies LatencyFailure,
      { status: 400 },
    );
  }

  const allowed = servers.some(
    (server) => server.host === host && server.port === port,
  );

  if (!allowed) {
    return Response.json(
      { ok: false, error: "Server is not on the allowlist." } satisfies LatencyFailure,
      { status: 403 },
    );
  }

  try {
    const latencyMs = await measureBestOf(host, port);
    return Response.json(
      {
        ok: true,
        latencyMs,
        region: process.env.VERCEL_REGION ?? "unknown",
      } satisfies LatencySuccess,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { ok: false, error: "Unable to reach server." } satisfies LatencyFailure,
      { status: 504 },
    );
  }
}
