#!/usr/bin/env bash
# Bootstrap WallBang web stack on Hostinger KVM2 (alongside native CS2).
# Run as a sudo-capable user. CS2 server directory is left untouched.
#
# Expected layout:
#   /home/wallbang/wallbang-cs2-server/
#   /home/wallbang/wallbang-xyz/
#
# Environment overrides:
#   APP_DIR   target checkout (default /home/wallbang/wallbang-xyz)
#   REPO_URL / BRANCH
#   SKIP_BACKUP_SETUP=1   skip installing the MongoDB backup utility

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
  # Generate a mongo password if still placeholder and sync MONGODB_URI
  if grep -q 'CHANGE_ME_MONGO' .env 2>/dev/null || grep -q 'MONGO_PASSWORD=$' .env; then
    PW="$(openssl rand -base64 24 | tr -d '\n=/+' | cut -c1-24)"
    sed -i "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=${PW}|" .env || true
    sed -i "s|^MONGODB_URI=mongodb://wallbang:CHANGE_ME_MONGO@|MONGODB_URI=mongodb://wallbang:${PW}@|" .env || true
  fi
  echo "!! Created .env — review secrets before going public."
fi

if ! grep -qE '^MONGO_PASSWORD=.+' .env || grep -q 'CHANGE_ME_MONGO' .env; then
  echo "ERROR: Set a real MONGO_PASSWORD in ${APP_DIR}/.env before starting."
  exit 1
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

# Portable MongoDB backup utility (Atlas -> Backblaze B2). Installs scripts,
# config template, systemd units and logrotate. It is idempotent and never
# overwrites an existing config or deletes backups. The daily timer stays
# DISABLED until you configure credentials and enable it explicitly.
if [[ "${SKIP_BACKUP_SETUP:-0}" != "1" ]]; then
  echo "==> Installing the MongoDB backup utility…"
  if [[ -f "${APP_DIR}/infra/mongodb-backup/install.sh" ]]; then
    if sudo bash "${APP_DIR}/infra/mongodb-backup/install.sh"; then
      echo "Backup utility installed (timer not enabled yet)."
    else
      echo "WARN: backup utility install failed — re-run manually:"
      echo "      sudo bash ${APP_DIR}/infra/mongodb-backup/install.sh"
    fi
  else
    echo "WARN: ${APP_DIR}/infra/mongodb-backup/install.sh not found; skipping."
  fi
fi

cat <<EOF

Bootstrap complete.

Next:
  1. Review ${APP_DIR}/.env (MONGO_PASSWORD, NEXT_PUBLIC_*, Discord token if using bot)
  2. Point DNS A records for wallbang.xyz (+ www) at this VPS public IP
  3. Issue TLS certs into nginx/certs/wallbang.xyz/ then:
       git checkout -- nginx/conf.d/wallbang.conf   # restore TLS vhost from repo
       docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
       # Optional renew hook: sudo ln -sf ${APP_DIR}/scripts/renew-certs.sh /etc/letsencrypt/renewal-hooks/deploy/wallbang-nginx
  4. MongoDB backups (installed by this bootstrap):
       sudo nano /etc/wallbang-backup/backup.env          # MONGODB_URI + remote settings
       sudo rclone --config /etc/wallbang-backup/rclone.conf config create b2 wallbang-b2 type b2 account "<KEY_ID>" key "<APP_KEY>"
       sudo rclone --config /etc/wallbang-backup/rclone.conf config create wallbang-backup-crypt crypt remote wallbang-b2:wallbang-db-backups password "<CRYPT_PASSWORD>" password2 "<CRYPT_SALT>"
       sudo chmod 0600 /etc/wallbang-backup/rclone.conf
       sudo wallbang-backup-verify --remote                # validate, no dump
       sudo wallbang-backup                                # manual backup
       sudo systemctl enable --now wallbang-mongodb-backup.timer
       # Docs: ${APP_DIR}/infra/mongodb-backup/README.md
  5. Keep wallbang-cs2-server/ running natively (not managed by this Compose file)

EOF
