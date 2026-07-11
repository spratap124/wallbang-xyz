# Latency probe (true player ping)

Browsers cannot UDP-ping CS2 (`27015`). To show **your real ping** from the visitor’s device to Hyderabad, run this tiny HTTP probe **on the same Oracle VPS** as the game server, then expose it with **HTTPS**.

## 1. On the Oracle VPS

```bash
# copy probe/latency-server.mjs to the VPS, then:
node latency-server.mjs
# listens on :3410
```

Keep it running (systemd / pm2 / docker).

## 2. HTTPS in front (required)

Your site is HTTPS, so `http://129.159.232.212:3410` is blocked as mixed content.

### Quick test (Cloudflare Tunnel)

```bash
npx cloudflared tunnel --url http://127.0.0.1:3410
```

Copy the `https://….trycloudflare.com` URL and set:

```bash
NEXT_PUBLIC_LATENCY_PROBE_URL=https://….trycloudflare.com/ping
```

in Vercel → Project → Settings → Environment Variables, then redeploy.

### Production (after wallbang.xyz)

Point `ping.wallbang.xyz` at the VPS and terminate TLS with Caddy/Nginx, then:

```bash
NEXT_PUBLIC_LATENCY_PROBE_URL=https://ping.wallbang.xyz/ping
```

## 3. Open the firewall

If you expose `:3410` publicly (instead of tunnel-only), allow TCP **3410** in Oracle Security Lists / iptables.
