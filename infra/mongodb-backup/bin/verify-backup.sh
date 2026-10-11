#!/usr/bin/env bash
# Verify WallBang MongoDB backups (local files, checksums, remote presence).
#
# Usage:
#   wallbang-backup-verify [--latest] [--all] [--remote] [--max-age-days N]
#
# Exit codes: 0 ok, 1 config, 4 checksum/integrity failure, 6 missing or stale.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${WALLBANG_BACKUP_LIB_DIR:-$SCRIPT_DIR/../lib}"
# shellcheck source=../lib/common.sh
. "$LIB_DIR/common.sh"

usage() {
  cat <<'EOF'
WallBang backup verification

Usage: wallbang-backup-verify [options]

Options:
  --latest            Verify only the newest local backup (default).
  --all               Verify every local backup.
  --remote            Also list remote backups and confirm the newest exists.
  --max-age-days <n>  Fail if the newest backup is older than n days
                      (default: retention + 1).
  --help              Show this help.
EOF
}

MODE_LATEST=1
CHECK_REMOTE=0
MAX_AGE_DAYS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --latest) MODE_LATEST=1 ;;
    --all) MODE_LATEST=0 ;;
    --remote) CHECK_REMOTE=1 ;;
    --max-age-days)
      MAX_AGE_DAYS="${2:-}"
      shift
      ;;
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
log_init
[ -n "$MAX_AGE_DAYS" ] || MAX_AGE_DAYS=$((RETENTION_DAYS + 1))

[ -d "$LOCAL_BACKUP_DIR" ] || die "$EX_VERIFY" "Backup directory missing: $LOCAL_BACKUP_DIR"

FAILURES=0
CHECKED=0

verify_one() {
  _dir="$1"
  _archive="$(find "$_dir" -maxdepth 1 -name '*.archive.gz' | head -n1)"
  if [ -z "$_archive" ]; then
    log_error "No archive in $_dir"
    FAILURES=$((FAILURES + 1))
    return
  fi
  if [ ! -s "$_archive" ]; then
    log_error "Archive is empty: $_archive"
    FAILURES=$((FAILURES + 1))
    return
  fi
  _sidecar="$_archive.sha256"
  if [ -f "$_sidecar" ]; then
    if (cd "$(dirname "$_archive")" && "$SHA256_BIN" -c "$(basename "$_sidecar")") >/dev/null 2>&1; then
      log_info "OK  checksum  $(basename "$_archive")"
    else
      log_error "BAD checksum  $(basename "$_archive")"
      FAILURES=$((FAILURES + 1))
    fi
  else
    log_warn "No checksum sidecar for $(basename "$_archive")"
  fi
  CHECKED=$((CHECKED + 1))
  LATEST_ARCHIVE="$_archive"
}

if [ "$MODE_LATEST" -eq 1 ]; then
  _newest="$(find "$LOCAL_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "$BACKUP_PREFIX-*" \
    -print0 2>/dev/null | xargs -0 -r ls -1d 2>/dev/null | sort | tail -n1)"
  if [ -z "$_newest" ]; then
    die "$EX_VERIFY" "No local backups found in $LOCAL_BACKUP_DIR."
  fi
  verify_one "$_newest"
else
  while IFS= read -r _dir; do
    [ -n "$_dir" ] && verify_one "$_dir"
  done <<EOF
$(find "$LOCAL_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "$BACKUP_PREFIX-*" | sort)
EOF
fi

# Age check on the newest archive.
if [ -n "${LATEST_ARCHIVE:-}" ]; then
  _mtime="$(file_mtime_epoch "$LATEST_ARCHIVE")"
  _now="$(epoch_now)"
  _age_days=$(((_now - _mtime) / 86400))
  log_info "Newest backup age: ${_age_days} day(s) (max ${MAX_AGE_DAYS})."
  if [ "$_age_days" -gt "$MAX_AGE_DAYS" ]; then
    log_error "Newest backup is older than ${MAX_AGE_DAYS} days."
    FAILURES=$((FAILURES + 1))
  fi
fi

if [ "$CHECK_REMOTE" -eq 1 ]; then
  if [ -z "${RCLONE_CRYPT_REMOTE:-}" ]; then
    log_warn "RCLONE_CRYPT_REMOTE not configured; skipping remote check."
  elif ! rclone lsd "$(remote_root)" >/dev/null 2>&1; then
    log_error "Cannot list remote $(remote_root)."
    FAILURES=$((FAILURES + 1))
  else
    _remote_count="$(rclone lsf "$(remote_root)" 2>/dev/null | wc -l | tr -d ' ')"
    log_info "Remote backup directories: ${_remote_count}"
    if [ "${_remote_count:-0}" -eq 0 ]; then
      log_error "No remote backups found."
      FAILURES=$((FAILURES + 1))
    fi
  fi
fi

log_info "Verified ${CHECKED} archive(s); failures: ${FAILURES}."
[ "$FAILURES" -eq 0 ] || exit "$EX_VERIFY"
exit "$EX_OK"
