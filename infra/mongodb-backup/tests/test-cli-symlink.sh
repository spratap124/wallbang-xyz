#!/usr/bin/env bash
# Tests: the CLI works when invoked through the /usr/local/bin symlinks.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

write_config
LINK_DIR="$SANDBOX/links"
mkdir -p "$LINK_DIR"
for cmd in backup:wallbang-backup verify-backup:wallbang-backup-verify restore:wallbang-backup-restore setup-rclone:wallbang-backup-setup; do
  src="${cmd%%:*}"
  dst="${cmd##*:}"
  ln -sfn "$UTIL_DIR/bin/$src.sh" "$LINK_DIR/$dst"
done

run_link() {
  # run_link <name> [args...]
  _name="$1"
  shift
  set +e
  OUTPUT="$("$LINK_DIR/$_name" "$@" 2>&1)"
  RC=$?
  set -e
}

test_start "symlinked verify CLI resolves its library and runs"
run_link wallbang-backup-verify --latest
assert_exit 6 "$RC" "exit code with no backups yet"
assert_not_contains "$OUTPUT" "common.sh: No such file" "library resolved through the symlink"
assert_contains "$OUTPUT" "No local backups" "verify ran and reported state"

test_start "symlinked backup CLI resolves its library and runs"
: >"$STUB_LOG"
run_link wallbang-backup --dry-run
assert_exit 0 "$RC" "symlinked backup exit code"
assert_not_contains "$OUTPUT" "common.sh: No such file" "library resolved through the symlink"
assert_contains "$OUTPUT" "backup starting" "backup ran"

test_start "symlinked verify passes once a backup exists"
run_link wallbang-backup-verify --latest
assert_exit 0 "$RC" "symlinked verify exit code"
assert_contains "$OUTPUT" "OK  checksum" "archive verified through the symlink"

test_start "symlinked restore CLI honours its safety guards"
run_link wallbang-backup-restore --archive /nonexistent --confirm
assert_exit 1 "$RC" "missing target URI rejected"
assert_not_contains "$OUTPUT" "common.sh: No such file" "library resolved through the symlink"

test_start "symlinked setup CLI resolves its library"
run_link wallbang-backup-setup --dry-run
assert_exit 1 "$RC" "missing B2 values rejected"
assert_not_contains "$OUTPUT" "common.sh: No such file" "library resolved through the symlink"
assert_contains "$OUTPUT" "Missing required config values" "setup validated config"

test_start "--help works through a symlink without any config"
NO_CONFIG_LINK="$LINK_DIR/wallbang-backup-help"
ln -sfn "$UTIL_DIR/bin/verify-backup.sh" "$NO_CONFIG_LINK"
set +e
OUTPUT="$(WALLBANG_BACKUP_CONFIG="$SANDBOX/etc/absent.env" "$NO_CONFIG_LINK" --help 2>&1)"
RC=$?
set -e
assert_exit 0 "$RC" "--help exits 0 before config loading"
assert_contains "$OUTPUT" "WallBang backup verification" "usage shown"

summary
