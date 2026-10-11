#!/usr/bin/env bash
# Tests: retention pruning (local + remote) with mocked storage.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

test_start "prunes backups older than retention, keeps recent ones"
write_config "RETENTION_DAYS=30"
mkdir -p "$SANDBOX/backups/mongodb-old/old-dir"
mkdir -p "$SANDBOX/backups/mongodb-20200101-000000"
printf 'old' >"$SANDBOX/backups/mongodb-20200101-000000/mongodb-20200101-000000.archive.gz"
# Backdate the old dir beyond retention (touch -t is POSIX on macOS + Linux).
touch -t 202001010000 "$SANDBOX/backups/mongodb-20200101-000000"
touch -t 202001010000 "$SANDBOX/backups/mongodb-old"

run_script backup.sh
assert_exit 0 "$RC" "backup exit code"
[ ! -d "$SANDBOX/backups/mongodb-20200101-000000" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: expired local backup removed\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: expired local backup not removed\n'
}
assert_contains "$(cat "$STUB_LOG")" " delete " "remote retention applied"
assert_contains "$(cat "$STUB_LOG")" "--min-age 30d" "remote retention window passed to rclone"

test_start "new backup itself is never pruned"
NEW_DIR="$(find "$SANDBOX/backups" -maxdepth 1 -type d -name 'mongodb-*' | sort | tail -n1)"
[ -d "$NEW_DIR" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: newest backup kept (%s)\n' "$(basename "$NEW_DIR")"
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: newest backup missing after prune\n'
}

test_start "--no-prune keeps expired backups"
mkdir -p "$SANDBOX/backups/mongodb-ancient"
touch -t 202001010000 "$SANDBOX/backups/mongodb-ancient"
run_script backup.sh --no-prune
assert_exit 0 "$RC" "exit code with --no-prune"
[ -d "$SANDBOX/backups/mongodb-ancient" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: backup retained when pruning disabled\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: --no-prune still deleted a backup\n'
}

test_start "remote prune failure does not fail the run"
write_config "RETENTION_DAYS=30"
FAIL_RCLONE_DELETE=1 run_script backup.sh
assert_exit 0 "$RC" "remote prune errors are non-fatal"
assert_contains "$OUTPUT" "Remote prune failed" "prune failure warned about"

summary
