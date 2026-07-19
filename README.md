# WallBang.xyz

Marketing site + live CS2 server status for the WallBang Counter-Strike 2 platform.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Docker Compose production stack: **Next.js · MongoDB · Redis · nginx** (+ optional Discord bot / Watchtower)
- Live server status via A2S UDP (`/api/servers`) with Mongo snapshot cache
- Host target: **Hostinger KVM2** alongside native `wallbang-cs2-server`

## Scripts

```bash
npm install
npm run dev          # staging retake 129.159.232.212
npm run build
npm run start
npm run lint
npm run typecheck
```

## Repository layout (production)

```text
wallbang-xyz/
├── app/                      # Next.js App Router (frontend + API)
├── Dockerfile                # multi-stage standalone build
├── docker-compose.prod.yml   # nextjs, db, nginx; optional redis/bot/watchtower profiles
├── .env.production.example   # copy to .env on the VPS
├── nginx/conf.d/             # reverse-proxy vhosts
├── scripts/                  # bootstrap, backup, restore
├── backups/                  # DB dumps (gitignored contents)
├── discord-bot/              # optional (Compose profile)
└── .github/workflows/ci.yml
```

On the VPS keep CS2 **outside** Compose:

```text
/home/wallbang/wallbang-cs2-server/   # native
/home/wallbang/wallbang-xyz/          # this repo
```

## Environment

### Local

```bash
cp .env.example .env.local
```

- Dev host for Retake #1 → staging `129.159.232.212:27015`
- Production builds → `200.97.169.27:27015`
- Override with `NEXT_PUBLIC_RETAKE_HOST`

### Production VPS

```bash
cp .env.production.example .env
# set MONGO_PASSWORD and matching password inside MONGODB_URI
```

## Deploy on Hostinger KVM2

Full guide: [docs/hostinger-deploy.md](docs/hostinger-deploy.md)

```bash
bash scripts/hostinger-bootstrap.sh
# or:
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

Update loop:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

### TLS

1. DNS A → VPS IP  
2. Place certs in `nginx/certs/wallbang.xyz/{fullchain.pem,privkey.pem}`  
3. `git checkout -- nginx/conf.d/wallbang.conf` (TLS vhost is the repo default)  
4. Reload nginx container  

### CI/CD

Push/merge to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml): build first, then SSH deploy only if build passes.  
Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

### Backups

```bash
./scripts/backup_db.sh
./scripts/restore_db.sh backups/db/mongo_YYYYMMDD_HHMMSS.archive.gz
```

## Live server status

- `GET /api/health` — liveness for Docker / uptime checks  
- `GET /api/servers` — A2S name/map/players + Mongo cache  

Hero card and `/servers` poll every 10s.

## Cosmetics catalog (skin changer)

CS2 `GenerateSkinDatabase` POSTs gun/knife/glove catalogs into Mongo:

- Ingest: `POST /api/v1/catalog/cosmetics` (`X-API-Key: PLUGIN_API_KEY`)
- Public UI: `GET /api/skins?weapon=ak47` (and knife/glove variants)

Details: [docs/cosmetics-catalog.md](docs/cosmetics-catalog.md). nginx allows **5m** request bodies for catalog ingest.


## Optional Compose profiles

| Profile | Purpose |
|---|---|
| `discord` | Discord bot container (`./discord-bot` + token) |
| `watchtower` | Auto-pull newer images |

```bash
docker compose -f docker-compose.prod.yml --profile watchtower --env-file .env up -d
```

## Security (host)

- UFW: 22, 80, 443, CS2 UDP 27015–27020  
- SSH keys only + Fail2Ban  
- Non-root Next.js container user `wallbang`  
- Never commit `.env`

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint, typecheck, and production build on PRs / pushes
- **Deploy** (same workflow): SSH to Hostinger only after a green build on `main` (or manual `workflow_dispatch`)

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (see [docs/hostinger-deploy.md](docs/hostinger-deploy.md)).

