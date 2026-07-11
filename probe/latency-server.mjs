import http from "node:http";

/**
 * Tiny latency probe for the Oracle VPS (same machine / network as CS2).
 *
 * Run on the game server:
 *   node probe/latency-server.mjs
 *
 * Because the website is HTTPS, browsers cannot call http://IP (mixed content).
 * Expose this probe with TLS, e.g. Cloudflare Tunnel:
 *   npx cloudflared tunnel --url http://127.0.0.1:3410
 * Then set NEXT_PUBLIC_LATENCY_PROBE_URL to https://<tunnel>/ping
 *
 * Later: https://ping.wallbang.xyz → this service.
 */
const port = Number(process.env.PORT || 3410);
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url?.split("?")[0] ?? "/";

  if (req.method === "GET" && (path === "/ping" || path === "/")) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, t: Date.now() }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(port, host, () => {
  console.log(`WallBang latency probe listening on http://${host}:${port}/ping`);
});
