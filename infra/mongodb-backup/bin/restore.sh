#!/usr/bin/env bash
# Restore a WallBang MongoDB backup into a target MongoDB deployment.
#
# Safety model:
#   * A target URI is REQUIRED and must be passed explicitly (never defaults to
#     the production MONGODB_URI).
#   * Restoring into the configured production URI additionally requires
#     --allow-production.
#   * --drop is never used unless explicitly requested.
#   * --confirm is always required; there is no unattended restore path.
#
# Usage:
#   wallbang-backup-restore --archive <file|remote/path> --target-uri <uri> \
#     [--ns-from <db>] [--ns-to <db>] [--drop] [--dry-run] \
#     [--allow-production] --confirm
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
WallBang MongoDB restore (manual, explicitly confirmed)

Usage: wallbang-backup-restore --archive <source> --target-uri <uri> --confirm [options]
       wallbang-backup-restore --latest [--remote] --target-uri <uri> --confirm [options]

Options:
  --archive <path>     Local archive file, or a remote path
                       (e.g. wallbang-b2-crypt:wallbang-db-backups/mongodb/<stamp>/mongodb-<stamp>.archive.gz)
  --latest             Resolve the newest backup automatically instead of
                       passing --archive. Local by default; combine with
                       --remote to use the newest off-site copy.
  --remote             With --latest: pick the newest archive on the rclone remote.
  --target-uri <uri>   Target MongoDB connection string (required).
  --ns-from <db>       Source namespace pattern for renaming (default: unchanged).
  --ns-to <db>         Destination namespace pattern (default: unchanged).
  --drop               DROP existing collections in the target namespaces.
                       Never used by default.
  --dry-run            Pass --dryRun to mongorestore (no writes).
  --allow-production   Required when --target-uri equals the configured MONGODB_URI.
  --confirm            Acknowledge that this writes data. Required.
  --help               Show this help.

Exit codes: 0 ok, 1 config, 2 prereq, 3 restore, 8 missing confirmation.
EOF
}

ARCHIVE=""
TARGET_URI=""
NS_FROM=""
NS_TO=""
DROP=0
DRY_RUN=0
ALLOW_PRODUCTION=0
CONFIRMED=0
LATEST=0
USE_REMOTE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --archive)
      ARCHIVE="${2:-}"
      shift
      ;;
    --target-uri)
      TARGET_URI="${2:-}"
      shift
      ;;
    --ns-from)
      NS_FROM="${2:-}"
      shift
      ;;
    --ns-to)
      NS_TO="${2:-}"
      shift
      ;;
    --drop) DROP=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --allow-production) ALLOW_PRODUCTION=1 ;;
    --confirm) CONFIRMED=1 ;;
    --latest) LATEST=1 ;;
    --remote) USE_REMOTE=1 ;;
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

if [ "$USE_REMOTE" -eq 1 ] && [ "$LATEST" -eq 0 ]; then
  die "$EX_CONFIG" "--remote is only meaningful together with --latest."
fi
if [ "$LATEST" -eq 1 ] && [ -n "$ARCHIVE" ]; then
  die "$EX_CONFIG" "Use either --archive or --latest, not both."
fi
if [ "$LATEST" -eq 0 ] && [ -z "$ARCHIVE" ]; then
  usage >&2
  die "$EX_CONFIG" "--archive (or --latest) is required."
fi
[ -n "$TARGET_URI" ] || {
  usage >&2
  die "$EX_CONFIG" "--target-uri is required (restores never default to production)."
}
[ "$CONFIRMED" -eq 1 ] || die "$EX_CONFIRM" "Refusing to restore without --confirm."

# Config is optional here (a fresh VPS may restore before configuring backups),
# but load it when present so MONGODB_URI can be compared for the safety check.
if [ -f "$(config_file_path)" ]; then
  # shellcheck disable=SC1090
  . "$(config_file_path)"
  apply_config_defaults
else
  apply_config_defaults
fi
log_init

require_cmd "$MONGORESTORE_BIN" "mongorestore (mongodb-database-tools)"

# --- resolve --latest --------------------------------------------------------
latest_local_archive() {
  _dir="$(find "$LOCAL_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "$BACKUP_PREFIX-*" 2>/dev/null | sort | tail -n1)"
  [ -n "$_dir" ] || return 1
  printf '%s/%s.archive.gz' "$_dir" "$(basename "$_dir")"
}

latest_remote_archive() {
  [ -n "${RCLONE_CRYPT_REMOTE:-}" ] || return 1
  _dirs="$(rclone lsf "$(remote_root)" 2>/dev/null | grep -E "^${BACKUP_PREFIX}-[0-9]{8}-[0-9]{6}/$" | sort)"
  _dir="$(printf '%s\n' "$_dirs" | tail -n1)"
  [ -n "$_dir" ] || return 1
  _name="${_dir%/}"
  printf '%s/%s/%s.archive.gz' "$(remote_root)" "$_name" "$_name"
}

if [ "$LATEST" -eq 1 ]; then
  require_cmd "$RCLONE_BIN" "rclone" # only when --latest needs the remote
  if [ "$USE_REMOTE" -eq 1 ]; then
    ARCHIVE="$(latest_remote_archive)" || die "$EX_CONFIG" "No remote backups found under $(remote_root)."
    log_info "Latest off-site archive: $(basename "$(dirname "$ARCHIVE")")/$(basename "$ARCHIVE")"
  else
    ARCHIVE="$(latest_local_archive)" || die "$EX_CONFIG" "No local backups found in $LOCAL_BACKUP_DIR."
    log_info "Latest local archive: $(basename "$ARCHIVE")"
  fi
fi

if [ -x "$RCLONE_BIN" ] && printf '%s' "$ARCHIVE" | grep -q ':'; then
  RESOLVE_WITH_RCLONE=1
else
  RESOLVE_WITH_RCLONE=0
fi

if [ -n "${MONGODB_URI:-}" ] && [ "$TARGET_URI" = "$MONGODB_URI" ]; then
  if [ "$ALLOW_PRODUCTION" -ne 1 ]; then
    die "$EX_CONFIRM" "Target URI equals the configured production MONGODB_URI. Re-run with --allow-production to override."
  fi
  log_warn "Restoring into the PRODUCTION database (explicitly allowed)."
fi

STAGE_DIR=""
cleanup() {
  [ -n "$STAGE_DIR" ] && rm -rf "$STAGE_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if [ "$RESOLVE_WITH_RCLONE" -eq 1 ]; then
  STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wallbang-restore.XXXXXX")"
  # Stage under the original file name so the checksum sidecar matches.
  STAGED_NAME="$(basename "$ARCHIVE")"
  log_info "Fetching archive from remote (redacted path)."
  if ! rclone copyto "$ARCHIVE" "$STAGE_DIR/$STAGED_NAME"; then
    die "$EX_UPLOAD" "Could not download archive from remote."
  fi
  # Best-effort: bring the checksum sidecar along so integrity is verified.
  if rclone copyto "$ARCHIVE.sha256" "$STAGE_DIR/$STAGED_NAME.sha256" 2>/dev/null; then
    log_info "Downloaded checksum sidecar."
  else
    log_warn "No checksum sidecar on the remote; skipping integrity verification."
  fi
  LOCAL_ARCHIVE="$STAGE_DIR/$STAGED_NAME"
else
  LOCAL_ARCHIVE="$ARCHIVE"
fi

[ -f "$LOCAL_ARCHIVE" ] || die "$EX_CONFIG" "Archive not found: $LOCAL_ARCHIVE"

# Verify the SHA-256 by comparing hashes rather than `sha256sum -c`, so sidecars
# written with an absolute path (older releases) still verify after a move.
SIDECAR="$LOCAL_ARCHIVE.sha256"
if [ -f "$SIDECAR" ] && [ -x "$SHA256_BIN" ]; then
  log_info "Verifying SHA-256 checksum."
  EXPECTED_HASH="$(awk '{print $1; exit}' "$SIDECAR" 2>/dev/null)"
  ACTUAL_HASH="$("$SHA256_BIN" "$LOCAL_ARCHIVE" | awk '{print $1; exit}')"
  if [ -z "$EXPECTED_HASH" ] || [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
    die "$EX_VALIDATE" "Checksum mismatch for $LOCAL_ARCHIVE (expected ${EXPECTED_HASH:-none}, got ${ACTUAL_HASH:-none})."
  fi
  log_info "Checksum OK."
else
  log_warn "No checksum sidecar found; skipping integrity verification."
fi

RESTORE_CONFIG="$(mktemp "${TMPDIR:-/tmp}/wallbang-restore-options.XXXXXX")"
(umask 077 && printf 'uri: "%s"\n' "$TARGET_URI" >"$RESTORE_CONFIG")
trap 'rm -f "$RESTORE_CONFIG"; cleanup' EXIT

RESTORE_ARGS=(--config="$RESTORE_CONFIG" --archive="$LOCAL_ARCHIVE" --gzip)
[ "$DROP" -eq 1 ] && RESTORE_ARGS+=(--drop)
[ "$DRY_RUN" -eq 1 ] && RESTORE_ARGS+=(--dryRun)
[ -n "$NS_FROM" ] && RESTORE_ARGS+=(--nsFrom="$NS_FROM")
[ -n "$NS_TO" ] && RESTORE_ARGS+=(--nsTo="$NS_TO")

log_info "Restoring archive into target (namespace renames: ${NS_FROM:-none} -> ${NS_TO:-none})."
if [ "$DROP" -eq 1 ]; then
  log_warn "--drop was requested: existing collections in scope will be replaced."
fi

if ! "$MONGORESTORE_BIN" "${RESTORE_ARGS[@]}"; then
  die "$EX_DUMP" "mongorestore failed."
fi

log_info "Restore complete."
