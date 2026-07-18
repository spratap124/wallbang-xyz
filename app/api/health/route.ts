export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Docker HEALTHCHECK / uptime monitors.
 * Keep this cheap — no A2S or Mongo calls.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: "healthy",
      service: "wallbang-xyz",
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
