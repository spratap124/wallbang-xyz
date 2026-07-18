#!/usr/bin/env bash
# Daily MongoDB backup for the wallbang-db container.
# Install on VPS: sudo ln -sf "$(pwd)/scripts/backup_db.sh" /etc/cron.daily/wallbang-db-backup

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/db}"
CONTAINER="${CONTAINER:-wallbang-db}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running; skipping backup." >&2
  exit 0
fi

OUT="$BACKUP_DIR/mongo_${TIMESTAMP}.archive.gz"
docker exec "$CONTAINER" sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "$OUT"

# Keep 7 days
find "$BACKUP_DIR" -type f -name 'mongo_*.archive.gz' -mtime +7 -delete

echo "Wrote $OUT"
