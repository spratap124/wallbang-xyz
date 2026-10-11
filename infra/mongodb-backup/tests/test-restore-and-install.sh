#!/usr/bin/env bash
# Tests: restore safety guards and installer idempotency.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

test_start "restore requires --confirm"
write_config
printf 'bytes' >"$SANDBOX/archive.gz"
run_script restore.sh --archive "$SANDBOX/archive.gz" --target-uri 'mongodb://test:pass@localhost:27017/test'
assert_exit 8 "$RC" "exit code without --confirm"

test_start "restore requires a target URI"
run_script restore.sh --archive "$SANDBOX/archive.gz" --confirm
assert_exit 1 "$RC" "exit code without target"

test_start "restoring into the configured production URI needs --allow-production"
: >"$STUB_LOG"
run_script restore.sh --archive "$SANDBOX/archive.gz" \
  --target-uri 'mongodb+srv://backupuser:SuperSecret123@cluster0.example.mongodb.net/?retryWrites=false' --confirm
assert_exit 8 "$RC" "exit code for production target without override"
assert_contains "$OUTPUT" "allow-production" "override flag named"
assert_not_contains "$(cat "$STUB_LOG")" "mongorestore" "no restore attempted"

test_start "restore onto a test cluster works without --drop by default"
: >"$STUB_LOG"
write_config
run_script restore.sh --archive "$SANDBOX/archive.gz" \
  --target-uri 'mongodb://restoreuser:pass@test-cluster:27017/?authSource=admin' --confirm
assert_exit 0 "$RC" "exit code for confirmed test restore"
assert_contains "$(cat "$STUB_LOG")" "mongorestore" "mongorestore invoked"
assert_not_contains "$(cat "$STUB_LOG")" "--drop" "no --drop by default"

test_start "explicit --drop is passed through"
: >"$STUB_LOG"
run_script restore.sh --archive "$SANDBOX/archive.gz" \
  --target-uri 'mongodb://restoreuser:pass@test-cluster:27017/' --confirm --drop
assert_exit 0 "$RC" "exit code with --drop"
assert_contains "$(cat "$STUB_LOG")" "--drop" "--drop forwarded when requested"

test_start "installer is idempotent and preserves config and backups"
INSTALL="$UTIL_DIR/install.sh"
PREFIX="$SANDBOX/prefix"
export INSTALL_ROOT="$PREFIX/opt"
export CONFIG_DIR="$PREFIX/etc"
export CONFIG_FILE="$CONFIG_DIR/backup.env"
export UNIT_DIR="$PREFIX/systemd"
export LOGROTATE_DIR="$PREFIX/logrotate"
export BIN_LINK_DIR="$PREFIX/bin"
export BACKUP_DIR="$PREFIX/backups"
export LOG_DIR="$PREFIX/logs"
export RCLONE_CACHE_DIR="$PREFIX/cache"
WALLBANG_INSTALL_ALLOW_NONROOT=1 bash "$INSTALL" --no-deps >"$SANDBOX/install1.log" 2>&1 || {
  cat "$SANDBOX/install1.log"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: first install run failed\n'
}
# Operator secrets land in the config; a re-run must not touch them.
printf "MONGODB_URI='sentinel-secret'\n" >>"$CONFIG_FILE"
mkdir -p "$BACKUP_DIR/mongodb-preinstall"
printf 'keep me' >"$BACKUP_DIR/mongodb-preinstall/data"
WALLBANG_INSTALL_ALLOW_NONROOT=1 bash "$INSTALL" --no-deps >"$SANDBOX/install2.log" 2>&1 || true

assert_contains "$(cat "$CONFIG_FILE")" "sentinel-secret" "existing config preserved"
[ -f "$BACKUP_DIR/mongodb-preinstall/data" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: existing backups untouched by installer\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: installer deleted existing backups\n'
}
TIMER_COUNT=$(find "$UNIT_DIR" -maxdepth 1 -name 'wallbang-mongodb-backup.timer' | wc -l | tr -d ' ')
assert_eq "1" "$TIMER_COUNT" "timer installed exactly once"
for _cmd in wallbang-backup wallbang-backup-verify wallbang-backup-restore wallbang-backup-setup; do
  if [ -L "$BIN_LINK_DIR/$_cmd" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf '   ok: %s symlinked\n' "$_cmd"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf '   FAIL: %s symlink missing\n' "$_cmd"
  fi
done
assert_contains "$(cat "$SANDBOX/install2.log")" "unchanged" "second run detected no changes"

test_start "installer --dry-run changes nothing"
rm -rf "$PREFIX"
WALLBANG_INSTALL_ALLOW_NONROOT=1 bash "$INSTALL" --dry-run --no-deps >/dev/null 2>&1 || true
[ ! -d "$INSTALL_ROOT" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: dry-run created nothing\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: dry-run wrote to the filesystem\n'
}

summary
