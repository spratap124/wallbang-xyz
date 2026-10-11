#!/usr/bin/env bash
# Create the Backblaze B2 + rclone crypt remotes from values in backup.env.
#
# One-time, idempotent, non-interactive. Secrets are read from the config file
# and written to the rclone config (crypt values obscured); they are never
# printed and never appear in logs.
#
# Usage:
#   sudo wallbang-backup-setup [--force] [--dry-run] [--assume-obscured] [--help]
#
# After this succeeds, rclone.conf holds the operational credentials and the
# B2_*/CRYPT_* values in backup.env are only needed to rebuild a new VPS.
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
WallBang backup: create the rclone remotes from backup.env

Usage: wallbang-backup-setup [options]

Options:
  --force             Recreate/update remotes even if they already exist.
  --dry-run           Show what would be created; call rclone only for reads.
  --assume-obscured   Treat CRYPT_PASSWORD/CRYPT_SALT as already-obscured
                      rclone values instead of plaintext.
  --help              Show this help.

Required config values (in /etc/wallbang-backup/backup.env):
  B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET,
  RCLONE_CRYPT_REMOTE, CRYPT_PASSWORD, CRYPT_SALT

Exit codes: 0 ok, 1 config, 2 prereq, 9 setup failure.
EOF
}

FORCE=0
DRY_RUN=0
ASSUME_OBSCURED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --assume-obscured) ASSUME_OBSCURED=1 ;;
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

CONFIG_PATH="${RCLONE_CONFIG:-/etc/wallbang-backup/rclone.conf}"

require_cmd "$RCLONE_BIN" "rclone"

# Backwards compatibility: B2_KEY_ID was briefly named B2_ACCOUNT_ID.
if [ -z "${B2_KEY_ID:-}" ] && [ -n "${B2_ACCOUNT_ID:-}" ]; then
  log_warn "B2_ACCOUNT_ID is deprecated; rename it to B2_KEY_ID."
  B2_KEY_ID="$B2_ACCOUNT_ID"
fi

missing=""
for _var in B2_KEY_ID B2_APPLICATION_KEY B2_BUCKET RCLONE_CRYPT_REMOTE CRYPT_PASSWORD CRYPT_SALT; do
  eval "_value=\${$_var:-}"
  if [ -z "$_value" ]; then missing="$missing $_var"; fi
done
if [ -n "$missing" ]; then
  die "$EX_CONFIG" "Missing required config values:$missing (see config/backup.env.example)."
fi

if [ "$DRY_RUN" -eq 0 ]; then
  _cfg_dir="$(dirname "$CONFIG_PATH")"
  if [ ! -d "$_cfg_dir" ] && ! mkdir -p "$_cfg_dir" 2>/dev/null; then
    die "$EX_PREREQ" "Cannot create $_cfg_dir — run as root (sudo)."
  fi
  if [ ! -w "$_cfg_dir" ] || { [ -e "$CONFIG_PATH" ] && [ ! -w "$CONFIG_PATH" ]; }; then
    die "$EX_PREREQ" "No write access to $CONFIG_PATH — run as root (sudo)."
  fi
fi

remote_exists() {
  [ -f "$CONFIG_PATH" ] || return 1
  grep -qE "^\[$(printf '%s' "$1" | sed 's/[^A-Za-z0-9_.-]/\\&/g')\]" "$CONFIG_PATH"
}

log_info "rclone config: $CONFIG_PATH"
log_info "B2 remote: $B2_REMOTE   bucket: $B2_BUCKET   crypt remote: $RCLONE_CRYPT_REMOTE"

if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$(dirname "$CONFIG_PATH")"
  (umask 077 && : >>"$CONFIG_PATH")
  chmod 0600 "$CONFIG_PATH" 2>/dev/null || true
fi

# --- B2 remote ---------------------------------------------------------------
if remote_exists "$B2_REMOTE" && [ "$FORCE" -eq 0 ]; then
  log_info "B2 remote '$B2_REMOTE' already exists; leaving it (use --force to recreate)."
else
  log_info "Creating B2 remote '$B2_REMOTE'."
  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] rclone config create $B2_REMOTE b2 account=<redacted> key=<redacted>"
  elif ! rclone config create "$B2_REMOTE" b2 \
    account "$B2_KEY_ID" key "$B2_APPLICATION_KEY"; then
    die "$EX_SETUP" "Could not create the B2 remote. Check the key ID/secret."
  fi
fi

# --- crypt remote ------------------------------------------------------------
if remote_exists "$RCLONE_CRYPT_REMOTE" && [ "$FORCE" -eq 0 ]; then
  log_info "Crypt remote '$RCLONE_CRYPT_REMOTE' already exists; leaving it (use --force to recreate)."
else
  if [ "$ASSUME_OBSCURED" -eq 1 ]; then
    OBSCURED_PW="$CRYPT_PASSWORD"
    OBSCURED_SALT="$CRYPT_SALT"
  else
    # rclone stores/expects the obscured form; plaintext would fail to reveal.
    OBSCURED_PW="$(rclone obscure "$CRYPT_PASSWORD")"
    OBSCURED_SALT="$(rclone obscure "$CRYPT_SALT")"
  fi

  log_info "Creating crypt remote '$RCLONE_CRYPT_REMOTE' -> $B2_REMOTE:$B2_BUCKET."
  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] rclone config create $RCLONE_CRYPT_REMOTE crypt remote=$B2_REMOTE:$B2_BUCKET password=<obscured> password2=<obscured>"
  elif ! rclone config create "$RCLONE_CRYPT_REMOTE" crypt \
    remote "$B2_REMOTE:$B2_BUCKET" \
    filename_encryption standard \
    directory_name_encryption true \
    password "$OBSCURED_PW" \
    password2 "$OBSCURED_SALT"; then
    die "$EX_SETUP" "Could not create the crypt remote."
  fi
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Skipping connectivity check."
  exit "$EX_OK"
fi

chmod 0600 "$CONFIG_PATH"
log_info "Remotes configured. Verifying access…"

if ! rclone lsd "$RCLONE_CRYPT_REMOTE:" >>"${LOG_FILE:-/dev/null}" 2>&1; then
  die "$EX_SETUP" "Remote created but listing failed. Check the bucket name, key permissions, and that the key can read $B2_BUCKET."
fi

log_info "OK: $RCLONE_CRYPT_REMOTE: is reachable."
cat <<EOF

Setup complete.

Next:
  1. Validate without dumping:  sudo wallbang-backup-verify --remote
  2. Manual backup:             sudo wallbang-backup
  3. Enable the daily timer:    sudo systemctl enable --now wallbang-mongodb-backup.timer

Secret handling:
  * rclone.conf now holds the (obscured) B2 key and crypt password/salt.
  * Keep a copy of the PLAINTEXT crypt password + salt in your password
    manager — without them the uploaded archives cannot be decrypted.
  * You may blank B2_APPLICATION_KEY/CRYPT_PASSWORD/CRYPT_SALT in
    /etc/wallbang-backup/backup.env now, or keep them to rebuild a future
    VPS. Either way they are 0600 root-only.
EOF
