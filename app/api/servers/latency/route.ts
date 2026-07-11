import { servers } from "@/config/servers";
import { measureSourceServerLatency } from "@/lib/server-ping";

export const runtime = "nodejs";

type LatencySuccess = { ok: true; latencyMs: number };
type LatencyFailure = { ok: false; error: string };

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
    const latencyMs = await measureSourceServerLatency(host, port);
    return Response.json({ ok: true, latencyMs } satisfies LatencySuccess, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: "Unable to reach server." } satisfies LatencyFailure,
      { status: 504 },
    );
  }
}
