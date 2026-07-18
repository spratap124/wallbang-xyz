# WallBang.xyz

Marketing site + live CS2 server status for the WallBang Counter-Strike 2 platform.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript (strict)
- Tailwind CSS · shadcn/ui · Framer Motion (minimal)
- MongoDB Atlas (optional cache for live A2S server status)
- `output: "standalone"` for Docker / Oracle Always Free

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Environment

### Local development

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `NEXT_PUBLIC_DISCORD_URL` | Discord invite |
| `NEXT_PUBLIC_RETAKE_HOST` | Optional host override |
| `MONGODB_URI` | Atlas URI (optional locally — falls back to direct A2S) |
| `MONGODB_DB` | Defaults to `wallbang` |
| `SERVER_STATUS_TTL_SECONDS` | Snapshot freshness (default `15`) |
| `SERVER_STATUS_DOC_TTL_SECONDS` | Atlas TTL expiry (default `120`) |

**Retake #1 host (env-driven):**

- `npm run dev` → staging `129.159.232.212:27015`
- production build / Docker (`NODE_ENV=production`) → `200.97.169.27:27015`
- override either with `NEXT_PUBLIC_RETAKE_HOST`

### Production (Oracle VM)

Copy `.env.production.example` → `.env.production` on the app VM and fill secrets (see Deploy below). Never commit `.env.production`.

## Live server status

`GET /api/servers` A2S-queries configured CS2 servers over UDP, caches snapshots in MongoDB Atlas, and returns:

`id`, `name`, `ip`, `region`, `mode`, `online`, `map`, `players`, `maxPlayers`, `pingUrl`, `lastSeen`, `backendPingMs` (diagnostic only).

The home hero card and `/servers` list poll this endpoint every 10 seconds.

## Deploy (primary) — Oracle Always Free + Docker + nginx

Full Next.js app (SSR + API) runs in Docker on a dedicated Oracle Always Free VM. nginx on the host terminates TLS and proxies to `127.0.0.1:3000`. **Vercel is not required** after DNS cutover.

### 1. Provision the app VM

- Ubuntu 22.04/24.04 Always Free (`VM.Standard.A1.Flex` preferred)
- Public IP = `APP_VM_IP`
- Ingress: TCP **22** (admin), **80**, **443**
- Install: Docker Engine + Compose plugin, nginx, certbot, git

### 2. Open UDP on the game server(s)

On prod retake `200.97.169.27` (and any additional servers): allow **inbound UDP 27015** from `APP_VM_IP` (preferred) or `0.0.0.0/0`, including the OS firewall. Without this, `/api/servers` reports `online: false`.

### 3. MongoDB Atlas

- Database `wallbang`, least-privilege `readWrite` user
- Network Access: allow `APP_VM_IP`
- Put the URI in `.env.production` on the app VM

### 4. Run the app

One-shot bootstrap (installs Docker/nginx/certbot, clones/pulls, compose up, nginx site):

```bash
git clone git@github.com:spratap124/wallbang-xyz.git
cd wallbang-xyz
bash scripts/oracle-bootstrap.sh
# then edit .env.production with MONGODB_URI and rebuild:
# docker compose --env-file .env.production up -d --build
```

Manual equivalent:

```bash
git clone git@github.com:spratap124/wallbang-xyz.git
cd wallbang-xyz
cp .env.production.example .env.production
# edit .env.production — set MONGODB_URI and confirm NEXT_PUBLIC_* values

docker compose --env-file .env.production up -d --build
```

Smoke test on the VM (before DNS cutover):

```bash
curl -s http://127.0.0.1:3000/api/servers | jq
# expect ip "200.97.169.27:27015", maxPlayers 10
```

### 5. nginx + TLS

```bash
sudo cp nginx/wallbang.xyz.conf.example /etc/nginx/sites-available/wallbang.xyz
sudo ln -sf /etc/nginx/sites-available/wallbang.xyz /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

Point DNS A records for `wallbang.xyz` and `www` at `APP_VM_IP`, then:

```bash
sudo certbot --nginx -d wallbang.xyz -d www.wallbang.xyz
```

### 6. DNS cutover

1. A `wallbang.xyz` (+ `www`) → `APP_VM_IP`
2. Remove previous Vercel DNS records
3. Verify HTTPS, `/api/servers`, and the live UI
4. Pause or delete the Vercel project when stable

### Update loop

```bash
git pull
docker compose --env-file .env.production up -d --build
```

### Verification checklist

- [ ] `https://wallbang.xyz` and `/servers` load
- [ ] `/api/servers` → `online: true`, prod IP, `maxPlayers: 10`
- [ ] Hero card + list show live map/players
- [ ] `steam://connect/200.97.169.27:27015` works
- [ ] Atlas `serverStatus` collection + TTL index on `lastPolled`
- [ ] Container restarts after reboot (`restart: unless-stopped`)
- [ ] Local `npm run dev` still targets staging

## Legacy — Vercel (optional)

Previously used for hosting. Prefer Oracle Docker for this project so A2S UDP works on a real Node runtime next to the game servers.

```bash
npx vercel login
npx vercel --prod
```

If you still use Vercel temporarily, set `MONGODB_URI` and the `NEXT_PUBLIC_*` vars in the Vercel project settings. Pinning to `bom1` via `vercel.json` only applies on Vercel.

## Architecture notes

- Marketing routes live under `app/(marketing)`
- Live status: `lib/a2s.ts`, `lib/mongo.ts`, `lib/servers/status.ts`, `app/api/servers/route.ts`
- Static server definitions: `config/servers.ts`
- Feature flags in `config/features.flags.ts` for future auth/dashboard modules
- SEO helpers in `seo/`
