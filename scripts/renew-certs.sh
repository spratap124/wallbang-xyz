#!/usr/bin/env bash
# Renew Let's Encrypt certs and reload the nginx container.
# Intended for host cron / certbot deploy hook on the VPS.
#
# Usage:
#   APP_DIR=/home/ubuntu/wallbang-xyz ./scripts/renew-certs.sh
#   # or after certbot renew:
#   certbot renew --deploy-hook /home/ubuntu/wallbang-xyz/scripts/renew-certs.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/wallbang-xyz}"
DOMAIN="${DOMAIN:-wallbang.xyz}"
LIVE_DIR="${LIVE_DIR:-/etc/letsencrypt/live/${DOMAIN}}"
DEST_DIR="${APP_DIR}/nginx/certs/${DOMAIN}"

cd "${APP_DIR}"

if [[ -d "${LIVE_DIR}" ]]; then
  mkdir -p "${DEST_DIR}"
  # Prefer copying over symlink so the nginx container (read-only mount) always sees files.
  sudo cp -L "${LIVE_DIR}/fullchain.pem" "${DEST_DIR}/fullchain.pem"
  sudo cp -L "${LIVE_DIR}/privkey.pem" "${DEST_DIR}/privkey.pem"
  sudo chmod 644 "${DEST_DIR}/fullchain.pem"
  sudo chmod 600 "${DEST_DIR}/privkey.pem"
  # Match the user that owns the compose project when possible.
  sudo chown "${USER}:${USER}" "${DEST_DIR}/fullchain.pem" "${DEST_DIR}/privkey.pem" || true
fi

if [[ ! -f "${DEST_DIR}/fullchain.pem" || ! -f "${DEST_DIR}/privkey.pem" ]]; then
  echo "Missing certs at ${DEST_DIR} — nothing to reload."
  exit 1
fi

sudo docker compose -f docker-compose.prod.yml --env-file .env exec -T nginx nginx -t
sudo docker compose -f docker-compose.prod.yml --env-file .env exec -T nginx nginx -s reload
echo "nginx reloaded with certs from ${DEST_DIR}"
