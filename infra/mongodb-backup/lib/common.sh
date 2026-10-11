#!/usr/bin/env bash
# Shared helpers for the WallBang MongoDB backup utility.
#
# Design rules:
#   * POSIX-friendly bash 3.2+ (macOS for tests, Ubuntu for production).
#   * No hardcoded VPS paths beyond the documented defaults in the config.
#   * Never echo secrets (MongoDB URI, rclone/B2 credentials, Discord webhook).
#
# shellcheck shell=bash

WALLBANG_BACKUP_VERSION="1.0.0"

# --- exit codes (documented in README) ---------------------------------------
EX_OK=0
EX_CONFIG=1
EX_PREREQ=2
EX_DUMP=3
EX_VALIDATE=4
EX_UPLOAD=5
EX_VERIFY=6
EX_PRUNE=7
EX_CONFIRM=8
EX_SETUP=9
EX_LOCKED=75 # EX_TEMPFAIL

# --- logging -----------------------------------------------------------------
log_init() {
  # LOG_FILE may be empty (journald-only).
  LOG_FILE="${LOG_FILE:-}"
  if [ -n "$LOG_FILE" ]; then
    LOG_DIR="$(dirname "$LOG_FILE")"
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    touch "$LOG_FILE" 2>/dev/null || true
  fi
}

log() {
  # level message...
  _level="$1"
  shift
  _ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  _line="[$_ts] [$_level] $*"
  # stdout/stderr feed the systemd journal
  if [ "$_level" = "ERROR" ] || [ "$_level" = "WARN" ]; then
    printf '%s\n' "$_line" >&2
  else
    printf '%s\n' "$_line"
  fi
  if [ -n "${LOG_FILE:-}" ]; then
    printf '%s\n' "$_line" >>"$LOG_FILE" 2>/dev/null || true
  fi
}

log_info() { log INFO "$@"; }
log_warn() { log WARN "$@"; }
log_error() { log ERROR "$@"; }
log_debug() { [ "${DEBUG:-0}" = "1" ] && log DEBUG "$@" || true; }

die() {
  # die exit_code message...
  _code="$1"
  shift
  log_error "$@"
  exit "$_code"
}

require_cmd() {
  # require_cmd <absolute-path> <friendly-name>
  if [ ! -x "$1" ]; then
    die "$EX_PREREQ" "Missing executable $1 ($2). Install it before running."
  fi
}

# --- secret redaction --------------------------------------------------------
# Strips anything that looks like a credential from a string before logging.
redact() {
  sed -E \
    -e 's#(mongodb(\+srv)?://)[^@/[:space:]]*@#\1***@#g' \
    -e 's#(B2_APPLICATION_KEY|B2_ACCOUNT_KEY|RCLONE_CONFIG_PASS|DISCORD_WEBHOOK_URL)([=:])[^[:space:]]+#\1\2***#g' \
    -e 's#(webhook[^[:space:]]*/)[A-Za-z0-9_-]+#\1***#g'
}

# --- config ------------------------------------------------------------------
# Config file lives outside the repository: /etc/wallbang-backup/backup.env
DEFAULT_CONFIG_FILE="/etc/wallbang-backup/backup.env"

config_file_path() {
  printf '%s' "${WALLBANG_BACKUP_CONFIG:-$DEFAULT_CONFIG_FILE}"
}

load_config() {
  _cfg="$(config_file_path)"
  if [ ! -f "$_cfg" ]; then
    die "$EX_CONFIG" "Config file not found: $_cfg (copy config/backup.env.example and fill it in)."
  fi
  # shellcheck disable=SC1090
  . "$_cfg"
  apply_config_defaults
}

apply_config_defaults() {
  : "${MONGODUMP_BIN:=/usr/bin/mongodump}"
  : "${MONGORESTORE_BIN:=/usr/bin/mongorestore}"
  : "${RCLONE_BIN:=/usr/bin/rclone}"
  : "${FLOCK_BIN:=/usr/bin/flock}"
  : "${GZIP_BIN:=/bin/gzip}"
  : "${SHA256_BIN:=/usr/bin/sha256sum}"
  : "${CURL_BIN:=/usr/bin/curl}"
  : "${LOCAL_BACKUP_DIR:=/var/backups/wallbang-mongodb}"
  : "${LOG_FILE:=/var/log/wallbang-backup/backup.log}"
  : "${RETENTION_DAYS:=30}"
  : "${MIN_FREE_DISK_MB:=512}"
  : "${BACKUP_PREFIX:=mongodb}"
  : "${RCLONE_REMOTE:=}"
  : "${RCLONE_PATH:=mongodb}"
  : "${RCLONE_CRYPT_REMOTE:=}"
  : "${DISCORD_WEBHOOK_URL:=}"
  : "${NOTIFY_ON_SUCCESS:=false}"
  : "${VALIDATE_ARCHIVE:=true}"
  : "${VERIFY_DOWNLOAD:=false}"
  : "${MONGODB_DATABASES:=}"
  : "${BACKUP_LOCK_FILE:=/var/lock/wallbang-mongodb-backup.lock}"
  : "${CURL_TIMEOUT_SECONDS:=15}"
  : "${RCLONE_CONFIG_PASS_COMMAND:=}"
  : "${RCLONE_CONFIG:=/etc/wallbang-backup/rclone.conf}"
  : "${RCLONE_CACHE_DIR:=/var/cache/wallbang-backup}"
  # Optional scripted rclone setup (wallbang-backup-setup).
  : "${B2_ACCOUNT_ID:=}"
  : "${B2_APPLICATION_KEY:=}"
  : "${B2_BUCKET:=wallbang-db-backups}"
  : "${B2_REMOTE:=wallbang-b2}"
  : "${CRYPT_PASSWORD:=}"
  : "${CRYPT_SALT:=}"
}

# MongoDB publishes no 7.0 apt repository for Ubuntu 24.04+, so pick a repo
# series that actually exists for the running codename.
mongodb_repo_series_for_codename() {
  case "${1:-}" in
    jammy | focal | bionic) printf '7.0' ;;
    *) printf '8.0' ;;
  esac
}

curl_fetch() {
  # curl_fetch <url> <dest>
  "$CURL_BIN" -fsSL --max-time "${CURL_TIMEOUT_SECONDS:-15}" -o "$2" "$1"
}

# Wrapper so the util works under systemd hardening (ProtectHome hides /root):
#   * uses an explicit config path outside $HOME
#   * keeps rclone's cache on a writable path
#   * can unlock an encrypted rclone.conf via a secret store
rclone() {
  _args=()
  if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "$RCLONE_CONFIG" ]; then
    _args+=(--config "$RCLONE_CONFIG")
  fi
  if [ -n "${RCLONE_CACHE_DIR:-}" ]; then
    _args+=(--cache-dir "$RCLONE_CACHE_DIR")
  fi
  if [ -n "${RCLONE_CONFIG_PASS_COMMAND:-}" ]; then
    _args+=(--password-command "$RCLONE_CONFIG_PASS_COMMAND")
  fi
  # bash 3.2-safe empty-array expansion.
  if [ "${#_args[@]}" -gt 0 ]; then
    "$RCLONE_BIN" "${_args[@]}" "$@"
  else
    "$RCLONE_BIN" "$@"
  fi
}

validate_config() {
  _missing=""
  [ -n "${MONGODB_URI:-}" ] || _missing="$_missing MONGODB_URI"
  if [ -z "${RCLONE_CRYPT_REMOTE:-}" ]; then
    _missing="$_missing RCLONE_CRYPT_REMOTE"
  fi
  if [ -n "$_missing" ]; then
    die "$EX_CONFIG" "Missing required config values:$_missing"
  fi
  case "$RETENTION_DAYS" in
    '' | *[!0-9]*) die "$EX_CONFIG" "RETENTION_DAYS must be a positive integer." ;;
  esac
  [ "$RETENTION_DAYS" -ge 1 ] || die "$EX_CONFIG" "RETENTION_DAYS must be >= 1."
}

# Remote archive directory: <crypt-remote>:<path>/<timestamp>
remote_dir_for() {
  printf '%s:%s/%s' "$RCLONE_CRYPT_REMOTE" "$RCLONE_PATH" "$1"
}

remote_root() {
  printf '%s:%s' "$RCLONE_CRYPT_REMOTE" "$RCLONE_PATH"
}

# --- time / fs ---------------------------------------------------------------
timestamp_utc() { date -u '+%Y%m%d-%H%M%S'; }

epoch_now() { date -u '+%s'; }

file_mtime_epoch() {
  # GNU stat, then BSD stat.
  stat -c '%Y' "$1" 2>/dev/null || stat -f '%m' "$1" 2>/dev/null || printf '0'
}

free_disk_mb() {
  # free_disk_mb <dir>
  df -Pk "$1" 2>/dev/null | awk 'NR==2 {print int($4/1024)}'
}

check_free_disk() {
  _dir="$1"
  _free="$(free_disk_mb "$_dir")"
  if [ -z "$_free" ]; then
    log_warn "Could not determine free disk space for $_dir; skipping check."
    return 0
  fi
  if [ "$_free" -lt "$MIN_FREE_DISK_MB" ]; then
    die "$EX_PREREQ" "Insufficient disk space in $_dir: ${_free}MB free, ${MIN_FREE_DISK_MB}MB required."
  fi
  log_info "Free disk space in $_dir: ${_free}MB (minimum ${MIN_FREE_DISK_MB}MB)."
}

# --- locking -----------------------------------------------------------------
# Uses flock when available (production), falls back to an atomic mkdir lock
# (portable/test-friendly). Stale mkdir locks older than LOCK_STALE_SECONDS are
# reclaimed.
LOCK_STALE_SECONDS="${LOCK_STALE_SECONDS:-21600}" # 6h

acquire_lock() {
  _lock="$1"
  mkdir -p "$(dirname "$_lock")" 2>/dev/null || true

  if [ -x "$FLOCK_BIN" ]; then
    # Keep the fd open for the process lifetime.
    exec 9>"$_lock"
    if ! "$FLOCK_BIN" -n 9; then
      return 1
    fi
    LOCK_MECHANISM="flock"
    printf '%s\n' "$$" >&9
    return 0
  fi

  _dir_lock="${_lock}.d"
  if mkdir "$_dir_lock" 2>/dev/null; then
    LOCK_MECHANISM="mkdir"
    printf '%s\n' "$$" >"$_dir_lock/pid"
    return 0
  fi
  # Reclaim a stale lock.
  _pid="$(cat "$_dir_lock/pid" 2>/dev/null || printf '')"
  _mtime="$(file_mtime_epoch "$_dir_lock")"
  _now="$(epoch_now)"
  if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null; then
    return 1
  fi
  if [ "$_mtime" -gt 0 ] && [ $((_now - _mtime)) -gt "$LOCK_STALE_SECONDS" ]; then
    log_warn "Reclaiming stale lock $_dir_lock (age $((_now - _mtime))s)."
    rm -rf "$_dir_lock"
    mkdir "$_dir_lock" 2>/dev/null || return 1
    printf '%s\n' "$$" >"$_dir_lock/pid"
    LOCK_MECHANISM="mkdir"
    return 0
  fi
  return 1
}

release_lock() {
  _lock="${1:-}"
  [ -n "$_lock" ] || return 0
  if [ "${LOCK_MECHANISM:-}" = "mkdir" ]; then
    rm -rf "${_lock}.d"
  fi
  LOCK_MECHANISM=""
}

# --- notifications -----------------------------------------------------------
notify_discord() {
  # notify_discord <message>
  [ -n "${DISCORD_WEBHOOK_URL:-}" ] || return 0
  _msg="$1"
  if [ ! -x "$CURL_BIN" ]; then
    log_warn "curl not available; skipping Discord notification."
    return 0
  fi
  # Escaped JSON payload; the webhook URL itself is never logged.
  _payload="$(printf '%s' "$_msg" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' ')"
  if ! "$CURL_BIN" -fsS --max-time "$CURL_TIMEOUT_SECONDS" \
    -H 'Content-Type: application/json' \
    -d "{\"content\":\"$_payload\"}" \
    "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1; then
    log_warn "Discord notification failed (non-fatal)."
  fi
}

# --- mongodump/restore credential handling -----------------------------------
# Credentials are passed through a 0600 temp options file via --config so the
# connection string never appears in the process list.
make_dump_config() {
  _dir="$1"
  _file="$_dir/.mongodump-options.yaml"
  (umask 077 && printf 'uri: "%s"\n' "$MONGODB_URI" >"$_file")
  printf '%s' "$_file"
}
