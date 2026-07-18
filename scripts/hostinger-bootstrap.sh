#!/usr/bin/env bash
# Bootstrap WallBang web stack on Hostinger KVM2 (alongside native CS2).
# Run as a sudo-capable user. CS2 server directory is left untouched.
#
# Expected layout:
#   /home/wallbang/wallbang-cs2-server/
#   /home/wallbang/wallbang-xyz/

set -euo pipefail

APP_DIR="${APP_DIR:-/home/wallbang/wallbang-xyz}"
REPO_URL="${REPO_URL:-git@github.com:spratap124/wallbang-xyz.git}"
BRANCH="${BRANCH:-main}"

echo "==> Installing Docker, Compose plugin, git, curl, jq…"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git jq ufw fail2ban

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
sudo apt-get install -y docker-compose-plugin || true

echo "==> Basic host firewall (SSH/HTTP/HTTPS + CS2 UDP)…"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 27015:27020/udp || true
sudo ufw --force enable || true

echo "==> Syncing repo at ${APP_DIR}…"
sudo mkdir -p "$(dirname "$APP_DIR")"
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  sudo git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  sudo chown -R "$USER:$USER" "${APP_DIR}"
fi

cd "${APP_DIR}"
mkdir -p backups/db logs nginx/certs

# First boot without certs: use HTTP-only nginx so ACME + health checks work.
if [[ ! -f nginx/certs/wallbang.xyz/fullchain.pem ]]; then
  cp nginx/conf.d/wallbang.http.conf.example nginx/conf.d/wallbang.conf
fi

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  # Generate a mongo password if still placeholder
  if grep -q 'CHANGE_ME_MONGO' .env 2>/dev/null || grep -q 'MONGO_PASSWORD=$' .env; then
    PW="$(openssl rand -base64 24 | tr -d '\n=/+' | cut -c1-24)"
    sed -i "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=${PW}|" .env || true
  fi
  echo "!! Created .env — review secrets before going public."
fi

echo "==> Starting production compose stack…"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "==> Waiting for health…"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo "Health OK"
    curl -fsS http://127.0.0.1:3000/api/servers | jq . || true
    break
  fi
  sleep 3
done

cat <<EOF

Bootstrap complete.

Next:
  1. Review ${APP_DIR}/.env (MONGO_PASSWORD, NEXT_PUBLIC_*, Discord token if using bot)
  2. Point DNS A records for wallbang.xyz (+ www) at this VPS public IP
  3. Issue TLS certs into nginx/certs/wallbang.xyz/ then:
       git checkout -- nginx/conf.d/wallbang.conf   # restore TLS vhost from repo
       docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
  4. Optional daily DB backup:
       sudo ln -sf ${APP_DIR}/scripts/backup_db.sh /etc/cron.daily/wallbang-db-backup
  5. Keep wallbang-cs2-server/ running natively (not managed by this Compose file)

EOF
