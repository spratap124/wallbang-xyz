#!/usr/bin/env bash
# Restore a mongodump archive created by scripts/backup_db.sh
# Usage: ./scripts/restore_db.sh backups/db/mongo_YYYYMMDD_HHMMSS.archive.gz

set -euo pipefail

ARCHIVE="${1:-}"
CONTAINER="${CONTAINER:-wallbang-db}"

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: $0 <mongo_*.archive.gz>" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running." >&2
  exit 1
fi

echo "Restoring $ARCHIVE into $CONTAINER …"
docker exec -i "$CONTAINER" sh -c 'mongorestore --archive --gzip --drop -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  < "$ARCHIVE"

echo "Restore complete."
