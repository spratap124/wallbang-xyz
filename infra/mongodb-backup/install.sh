#!/usr/bin/env bash
# Idempotent installer for the WallBang MongoDB backup utility.
#
# Safe to re-run:
#   * never overwrites /etc/wallbang-backup/backup.env
#   * never deletes backups or logs
#   * only rewrites installed files when their content changed
#
# Usage:
#   sudo ./install.sh [--dry-run] [--no-deps] [--enable] [--uninstall-units]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

# Paths are overridable so the installer stays portable and testable.
INSTALL_ROOT="${INSTALL_ROOT:-/opt/wallbang-backup}"
CONFIG_DIR="${CONFIG_DIR:-/etc/wallbang-backup}"
CONFIG_FILE="${CONFIG_FILE:-$CONFIG_DIR/backup.env}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
LOGROTATE_DIR="${LOGROTATE_DIR:-/etc/logrotate.d}"
BIN_LINK_DIR="${BIN_LINK_DIR:-/usr/local/bin}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wallbang-mongodb}"
LOG_DIR="${LOG_DIR:-/var/log/wallbang-backup}"

DRY_RUN=0
INSTALL_DEPS=1
ENABLE_TIMER=0
REMOVE_UNITS=0

usage() {
  cat <<'EOF'
WallBang MongoDB backup installer

Usage: sudo ./install.sh [options]

Options:
  --dry-run          Show what would change; touch nothing.
  --no-deps          Skip apt package installation.
  --enable           Enable + start the daily timer after installing (optional;
                     enabling is normally a separate, explicit step).
  --uninstall-units  Disable and remove systemd units, keeping config,
                     scripts, and all backups.
  --help             Show this help.

The installer is idempotent: re-running it will not duplicate systemd
configuration and will never overwrite an existing config file or delete
backups.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-deps) INSTALL_DEPS=0 ;;
    --enable) ENABLE_TIMER=1 ;;
    --uninstall-units) REMOVE_UNITS=1 ;;
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

if [ "$(id -u)" -ne 0 ] && [ "$DRY_RUN" -eq 0 ] && [ "${WALLBANG_INSTALL_ALLOW_NONROOT:-0}" != "1" ]; then
  die "$EX_PREREQ" "Run as root (sudo). Use --dry-run to preview without root."
fi

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

install_file_if_changed() {
  # install_file_if_changed <src> <dest> <mode>
  _src="$1"
  _dest="$2"
  _mode="$3"
  if [ -f "$_dest" ] && cmp -s "$_src" "$_dest"; then
    log_info "unchanged: $_dest"
    return 0
  fi
  log_info "installing: $_dest"
  run install -m "$_mode" "$_src" "$_dest"
}

ensure_dir() {
  _dir="$1"
  _mode="$2"
  if [ -d "$_dir" ]; then
    log_info "exists: $_dir"
  else
    log_info "creating: $_dir"
    run install -d -m "$_mode" "$_dir"
  fi
}

# --- preflight ---------------------------------------------------------------
if [ "$(uname -s)" != "Linux" ] && [ "$DRY_RUN" -eq 0 ] && [ "${WALLBANG_INSTALL_ALLOW_NONROOT:-0}" != "1" ]; then
  die "$EX_PREREQ" "This installer targets Ubuntu 22.04/24.04 (GNU/Linux)."
fi

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}${VERSION_ID:-}" in
    ubuntu22.04 | ubuntu24.04) log_info "Detected ${PRETTY_NAME:-Ubuntu}." ;;
    ubuntu*)
      log_warn "Untested Ubuntu release: ${PRETTY_NAME:-unknown}. Continuing."
      ;;
    *)
      log_warn "Untested distribution: ${PRETTY_NAME:-unknown}. Continuing."
      ;;
  esac
fi

log_info "WallBang MongoDB backup installer v$WALLBANG_BACKUP_VERSION"

if [ "$REMOVE_UNITS" -eq 1 ]; then
  log_info "Removing systemd units (config, scripts and backups are kept)."
  run systemctl disable --now wallbang-mongodb-backup.timer 2>/dev/null || true
  run rm -f "$UNIT_DIR/wallbang-mongodb-backup.timer" "$UNIT_DIR/wallbang-mongodb-backup.service"
  run systemctl daemon-reload || true
  log_info "Units removed. Backups in $BACKUP_DIR are untouched."
  exit 0
fi

# --- packages ----------------------------------------------------------------
need_pkg() { ! command -v "$1" >/dev/null 2>&1; }

if [ "$INSTALL_DEPS" -eq 1 ]; then
  if need_pkg rclone || need_pkg curl || need_pkg flock; then
    log_info "Installing base packages (rclone, curl, util-linux, ca-certificates, logrotate)."
    run apt-get update -y
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl rclone util-linux logrotate gnupg
  else
    log_info "Base packages already present."
  fi

  if [ ! -x /usr/bin/mongodump ] && [ ! -x /usr/local/bin/mongodump ]; then
    log_info "Installing MongoDB Database Tools."
    _codename="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-jammy}")"
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[dry-run] install mongodb-database-tools for %s\n' "$_codename"
    else
      apt-get install -y --no-install-recommends mongodb-database-tools 2>/dev/null || {
        log_warn "Package mongodb-database-tools not in apt; adding the MongoDB repository."
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
          | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${_codename}/mongodb-org/7.0 multiverse" \
          >/etc/apt/sources.list.d/mongodb-org-7.0.list
        apt-get update -y
        apt-get install -y --no-install-recommends mongodb-database-tools
      }
    fi
  else
    log_info "MongoDB Database Tools already present."
  fi
else
  log_info "Skipping dependency installation (--no-deps)."
fi

# --- directories -------------------------------------------------------------
ensure_dir "$INSTALL_ROOT" 0755
ensure_dir "$INSTALL_ROOT/bin" 0755
ensure_dir "$INSTALL_ROOT/lib" 0755
ensure_dir "$CONFIG_DIR" 0750
ensure_dir "$BACKUP_DIR" 0700
ensure_dir "$LOG_DIR" 0750
ensure_dir "${RCLONE_CACHE_DIR:-/var/cache/wallbang-backup}" 0750

# --- files -------------------------------------------------------------------
for _f in backup.sh restore.sh verify-backup.sh; do
  install_file_if_changed "$SCRIPT_DIR/bin/$_f" "$INSTALL_ROOT/bin/$_f" 0755
done
install_file_if_changed "$SCRIPT_DIR/lib/common.sh" "$INSTALL_ROOT/lib/common.sh" 0644
install_file_if_changed "$SCRIPT_DIR/README.md" "$INSTALL_ROOT/README.md" 0644
run install -d -m 0755 "$INSTALL_ROOT/config"
install_file_if_changed "$SCRIPT_DIR/config/backup.env.example" "$INSTALL_ROOT/config/backup.env.example" 0644

# Convenience commands (relative links stay valid if /opt is relocated).
ensure_dir "$BIN_LINK_DIR" 0755
for _c in backup:wallbang-backup verify-backup:wallbang-backup-verify restore:wallbang-backup-restore; do
  _src="${_c%%:*}"
  _dst="${_c##*:}"
  if [ -L "$BIN_LINK_DIR/$_dst" ] || [ ! -e "$BIN_LINK_DIR/$_dst" ]; then
    run ln -sfn "$INSTALL_ROOT/bin/$_src.sh" "$BIN_LINK_DIR/$_dst"
  else
    log_warn "$BIN_LINK_DIR/$_dst exists and is not a symlink; leaving it alone."
  fi
done

# --- config (never overwritten) ---------------------------------------------
if [ -f "$CONFIG_FILE" ]; then
  log_info "Config already present, left untouched: $CONFIG_FILE"
else
  log_info "Creating config from template: $CONFIG_FILE"
  run install -m 0600 "$SCRIPT_DIR/config/backup.env.example" "$CONFIG_FILE"
fi
run chown root:root "$CONFIG_DIR" 2>/dev/null || true
run chmod 0750 "$CONFIG_DIR" 2>/dev/null || true
run chown root:root "$CONFIG_FILE" 2>/dev/null || true
run chmod 0600 "$CONFIG_FILE" 2>/dev/null || true

# --- systemd -----------------------------------------------------------------
ensure_dir "$UNIT_DIR" 0755
install_file_if_changed "$SCRIPT_DIR/systemd/wallbang-mongodb-backup.service" \
  "$UNIT_DIR/wallbang-mongodb-backup.service" 0644
install_file_if_changed "$SCRIPT_DIR/systemd/wallbang-mongodb-backup.timer" \
  "$UNIT_DIR/wallbang-mongodb-backup.timer" 0644
run systemctl daemon-reload || true

# --- logrotate ---------------------------------------------------------------
ensure_dir "$LOGROTATE_DIR" 0755
install_file_if_changed "$SCRIPT_DIR/logrotate/wallbang-backup" \
  "$LOGROTATE_DIR/wallbang-backup" 0644

if [ "$ENABLE_TIMER" -eq 1 ]; then
  log_info "Enabling and starting the daily timer."
  run systemctl enable --now wallbang-mongodb-backup.timer || true
else
  log_info "Timer installed but NOT enabled. Enable it explicitly with:"
  log_info "  sudo systemctl enable --now wallbang-mongodb-backup.timer"
fi

cat <<EOF

Installation summary
--------------------
  Scripts     : $INSTALL_ROOT/bin (symlinked as wallbang-backup, wallbang-backup-verify, wallbang-backup-restore)
  Config      : $CONFIG_FILE   (edit this; mode 0600)
  Local store : $BACKUP_DIR
  Logs        : ${LOG_FILE:-$LOG_DIR/backup.log} (journald: journalctl -u wallbang-mongodb-backup)

Next steps
----------
  1. Edit $CONFIG_FILE (MongoDB URI, rclone crypt remote, retention).
  2. Configure rclone + the crypt remote (see README, "First-time setup").
  3. Validate without dumping:  sudo wallbang-backup-verify --remote
  4. Manual backup:             sudo wallbang-backup
  5. Enable the schedule:       sudo systemctl enable --now wallbang-mongodb-backup.timer
EOF
