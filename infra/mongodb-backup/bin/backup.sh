#!/usr/bin/env bash
# WallBang MongoDB -> Backblaze B2 (rclone crypt) daily backup.
#
# Usage:
#   wallbang-backup [--dry-run] [--no-prune] [--help]
#
# Exit codes: 0 ok, 1 config, 2 prereq, 3 dump, 4 validate, 5 upload,
#             6 verify, 7 prune, 75 another run holds the lock.
set -euo pipefail

# Resolve symlinks so /usr/local/bin/wallbang-backup* links work: BASH_SOURCE
# points at the symlink, not the installed script, unless we follow it.
_backend_self="${BASH_SOURCE[0]}"
while [ -L "$_backend_self" ]; do
  _backend_dir="$(cd -P "$(dirname "$_backend_self")" && pwd)"
  _backend_self="$(readlink "$_backend_self")"
  case "$_backend_self" in
    /*) ;;
    *) _backend_self="$_backend_dir/$_backend_self" ;;
  esac
done
SCRIPT_DIR="$(cd -P "$(dirname "$_backend_self")" && pwd)"
unset _backend_self _backend_dir
LIB_DIR="${WALLBANG_BACKUP_LIB_DIR:-$SCRIPT_DIR/../lib}"
# shellcheck source=../lib/common.sh
. "$LIB_DIR/common.sh"

usage() {
  cat <<'EOF'
WallBang MongoDB backup

Usage: wallbang-backup [options]

Options:
  --dry-run     Dump + validate locally, skip upload/prune.
  --no-prune    Skip retention pruning (upload still runs).
  --force       Ignore a missing checksum sidecar on verification.
  --help        Show this help.

Configuration: /etc/wallbang-backup/backup.env
Override path with WALLBANG_BACKUP_CONFIG=/path/to/file
EOF
}

DRY_RUN=0
DO_PRUNE=1
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-prune) DO_PRUNE=0 ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "$EX_CONFIG" "Unknown option: $1"
      ;;
  esac
  shift
done

load_config
validate_config
log_init

RUN_STAMP="$(timestamp_utc)"
WORK_DIR="$LOCAL_BACKUP_DIR/$BACKUP_PREFIX-$RUN_STAMP"
ARCHIVE_NAME="$BACKUP_PREFIX-$RUN_STAMP.archive.gz"
ARCHIVE_PATH="$WORK_DIR/$ARCHIVE_NAME"
CHECKSUM_PATH="$ARCHIVE_PATH.sha256"
REMOTE_DIR="$(remote_dir_for "$BACKUP_PREFIX-$RUN_STAMP")"

cleanup() {
  rm -f "$WORK_DIR/.mongodump-options.yaml" 2>/dev/null || true
  # A failed run must not leave a partial archive that could be mistaken for a
  # valid backup; the log and journal keep the diagnostics.
  if [ "${FAILED:-0}" -eq 1 ] && [ -d "$WORK_DIR" ]; then
    rm -rf "$WORK_DIR" 2>/dev/null || true
  fi
  release_lock "${BACKUP_LOCK_FILE:-}"
}
trap cleanup EXIT

fail() {
  # fail <exit-code> <message>
  _code="$1"
  shift
  FAILED=1
  log_error "$*"
  notify_discord "❌ WallBang MongoDB backup failed: $*"
  exit "$_code"
}

log_info "WallBang MongoDB backup starting (v$WALLBANG_BACKUP_VERSION, $RUN_STAMP)."

# --- preflight ---------------------------------------------------------------
require_cmd "$MONGODUMP_BIN" "mongodump (mongodb-database-tools)"
require_cmd "$RCLONE_BIN" "rclone"
require_cmd "$SHA256_BIN" "sha256sum"
if [ "$VALIDATE_ARCHIVE" = "true" ]; then
  require_cmd "$MONGORESTORE_BIN" "mongorestore (mongodb-database-tools)"
fi

if ! acquire_lock "$BACKUP_LOCK_FILE"; then
  log_warn "Another backup run is already in progress (lock: $BACKUP_LOCK_FILE)."
  exit "$EX_LOCKED"
fi

mkdir -p "$LOCAL_BACKUP_DIR" || die "$EX_PREREQ" "Cannot create $LOCAL_BACKUP_DIR."
[ -w "$LOCAL_BACKUP_DIR" ] || die "$EX_PREREQ" "Backup directory not writable: $LOCAL_BACKUP_DIR."
mkdir -p "$WORK_DIR" || die "$EX_PREREQ" "Cannot create work dir $WORK_DIR."
mkdir -p "${RCLONE_CACHE_DIR:-/var/cache/wallbang-backup}" 2>/dev/null || \
  log_warn "Could not create rclone cache dir; rclone will use its default."

check_free_disk "$LOCAL_BACKUP_DIR"

if [ -n "$MONGODB_DATABASES" ]; then
  log_info "Databases in scope: $MONGODB_DATABASES"
else
  log_info "Databases in scope: all reachable by the configured Atlas user."
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Skipping remote connectivity check."
else
  if ! rclone lsd "$(remote_root)" >/dev/null 2>&1; then
    fail "$EX_PREREQ" "Cannot reach remote $(remote_root). Check rclone config/credentials."
  fi
fi

# --- dump --------------------------------------------------------------------
DUMP_CONFIG="$(make_dump_config "$WORK_DIR")"
DUMP_BASE=(--config="$DUMP_CONFIG" --archive="$ARCHIVE_PATH" --gzip)

log_info "Running mongodump -> $ARCHIVE_PATH"
if [ -n "$MONGODB_DATABASES" ]; then
  # mongodump appends to an existing archive, so one call per database keeps
  # a single timestamped archive for the selected databases.
  for _db in $MONGODB_DATABASES; do
    log_info "  dumping database: $_db"
    if ! "$MONGODUMP_BIN" "${DUMP_BASE[@]}" --db="$_db" >>"${LOG_FILE:-/dev/null}" 2>&1; then
      fail "$EX_DUMP" "mongodump failed for database $_db (see logs; connection string redacted)."
    fi
  done
else
  if ! "$MONGODUMP_BIN" "${DUMP_BASE[@]}" >>"${LOG_FILE:-/dev/null}" 2>&1; then
    fail "$EX_DUMP" "mongodump failed (see logs; connection string redacted)."
  fi
fi
rm -f "$DUMP_CONFIG"

if [ ! -s "$ARCHIVE_PATH" ]; then
  fail "$EX_DUMP" "mongodump produced an empty archive."
fi

ARCHIVE_BYTES="$(wc -c <"$ARCHIVE_PATH" | tr -d ' ')"
log_info "Archive size: ${ARCHIVE_BYTES} bytes."

# --- validate + checksum -----------------------------------------------------
if [ "$VALIDATE_ARCHIVE" = "true" ]; then
  log_info "Validating archive structure with mongorestore --dryRun."
  VALIDATE_CONFIG="$(make_dump_config "$WORK_DIR")"
  if ! "$MONGORESTORE_BIN" --config="$VALIDATE_CONFIG" --archive="$ARCHIVE_PATH" --gzip --dryRun \
    >>"${LOG_FILE:-/dev/null}" 2>&1; then
    rm -f "$VALIDATE_CONFIG"
    fail "$EX_VALIDATE" "Archive validation failed (mongorestore --dryRun)."
  fi
  rm -f "$VALIDATE_CONFIG"
  log_info "Archive validation passed."
fi

(umask 077 && cd "$WORK_DIR" && "$SHA256_BIN" "$ARCHIVE_NAME" >"$ARCHIVE_NAME.sha256")
log_info "SHA-256 written to $CHECKSUM_PATH"

# --- upload ------------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Skipping upload/prune."
  log_info "WallBang MongoDB backup finished (dry-run)."
  exit "$EX_OK"
fi

log_info "Uploading to $REMOTE_DIR"
if ! rclone copy "$ARCHIVE_PATH" "$REMOTE_DIR/" --stats-one-line >>"${LOG_FILE:-/dev/null}" 2>&1; then
  fail "$EX_UPLOAD" "Upload failed for $ARCHIVE_NAME."
fi
if ! rclone copy "$CHECKSUM_PATH" "$REMOTE_DIR/" >>"${LOG_FILE:-/dev/null}" 2>&1; then
  fail "$EX_UPLOAD" "Checksum upload failed for $(basename "$CHECKSUM_PATH")."
fi

# --- verify remote -----------------------------------------------------------
log_info "Verifying uploaded archive."
REMOTE_JSON="$(rclone lsjson "$REMOTE_DIR/$ARCHIVE_NAME" 2>/dev/null || printf '')"
if [ -z "$REMOTE_JSON" ] || ! printf '%s' "$REMOTE_JSON" | grep -q '"Size"'; then
  fail "$EX_VERIFY" "Uploaded archive not found on remote."
fi
REMOTE_SIZE="$(printf '%s' "$REMOTE_JSON" | sed -n 's/.*"Size":\([0-9]*\).*/\1/p' | head -n1)"
if [ -z "$REMOTE_SIZE" ] || [ "$REMOTE_SIZE" != "$ARCHIVE_BYTES" ]; then
  fail "$EX_VERIFY" "Remote size mismatch (local $ARCHIVE_BYTES, remote ${REMOTE_SIZE:-unknown})."
fi
log_info "Remote size matches local archive."

if [ "$VERIFY_DOWNLOAD" = "true" ]; then
  log_info "Download-verify enabled: comparing uploaded bytes."
  VERIFY_TMP="$WORK_DIR/.verify-download.gz"
  if ! rclone copyto "$REMOTE_DIR/$ARCHIVE_NAME" "$VERIFY_TMP"; then
    fail "$EX_VERIFY" "Could not download archive for verification."
  fi
  if ! "$SHA256_BIN" -c "$CHECKSUM_PATH" >/dev/null 2>&1 && \
     ! cmp -s "$ARCHIVE_PATH" "$VERIFY_TMP"; then
    rm -f "$VERIFY_TMP"
    fail "$EX_VERIFY" "Downloaded archive does not match local checksum."
  fi
  rm -f "$VERIFY_TMP"
  log_info "Download-verify passed."
fi

# --- prune (only after a verified upload) ------------------------------------
if [ "$DO_PRUNE" -eq 1 ]; then
  log_info "Pruning local backups older than ${RETENTION_DAYS} days."
  find "$LOCAL_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name "$BACKUP_PREFIX-*" -mtime "+$RETENTION_DAYS" -print0 \
    | while IFS= read -r -d '' _dir; do
      case "$_dir" in
        "$WORK_DIR") continue ;;
      esac
      log_info "Removing old local backup $_dir"
      rm -rf "$_dir"
    done || log_warn "Local prune encountered errors (non-fatal)."

  log_info "Pruning remote backups older than ${RETENTION_DAYS}d."
  if ! rclone delete "$(remote_root)" --min-age "${RETENTION_DAYS}d" --rmdirs \
    >>"${LOG_FILE:-/dev/null}" 2>&1; then
    log_warn "Remote prune failed (non-fatal); retention may need attention."
  fi
fi

SIZE_HUMAN="$(awk -v b="$ARCHIVE_BYTES" 'BEGIN { printf "%.1f MB", b/1048576 }')"
log_info "WallBang MongoDB backup complete: $ARCHIVE_NAME ($SIZE_HUMAN)."
if [ "$NOTIFY_ON_SUCCESS" = "true" ]; then
  notify_discord "✅ WallBang MongoDB backup uploaded: $ARCHIVE_NAME ($SIZE_HUMAN)."
fi
exit "$EX_OK"
