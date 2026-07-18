#!/usr/bin/env bash
# Bootstrap / update WallBang on an Oracle Always Free Ubuntu app VM.
# Run as a sudo-capable user (e.g. ubuntu) from the repo root, or:
#   curl/clone the repo first, then: bash scripts/oracle-bootstrap.sh
#
# Env:
#   APP_DIR   — install path (default: $HOME/wallbang-xyz)
#   REPO_URL  — git remote (default: git@github.com:spratap124/wallbang-xyz.git)
#   BRANCH    — branch to deploy (default: main)

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/wallbang-xyz}"
REPO_URL="${REPO_URL:-git@github.com:spratap124/wallbang-xyz.git}"
BRANCH="${BRANCH:-main}"

echo "==> Installing packages (Docker, nginx, certbot, git, jq)…"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git jq nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-plugin || true
fi

echo "==> Syncing repo at ${APP_DIR} (branch ${BRANCH})…"
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
  echo "!! Created .env.production from example — edit MONGODB_URI before relying on cache."
fi

echo "==> Building and starting containers…"
docker compose --env-file .env.production up -d --build

echo "==> Installing nginx site…"
sudo mkdir -p /var/www/certbot
sudo cp nginx/wallbang.xyz.conf.example /etc/nginx/sites-available/wallbang.xyz
sudo ln -sf /etc/nginx/sites-available/wallbang.xyz /etc/nginx/sites-enabled/wallbang.xyz
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> Local smoke test…"
sleep 3
curl -fsS http://127.0.0.1:3000/api/servers | jq .

cat <<EOF

Bootstrap complete.

Next:
  1. Edit ${APP_DIR}/.env.production with your Atlas MONGODB_URI
  2. Point DNS A records for wallbang.xyz (+ www) at this VM's public IP
  3. Issue TLS:  sudo certbot --nginx -d wallbang.xyz -d www.wallbang.xyz
  4. On the prod game server, allow UDP 27015 from this VM's public IP

EOF
