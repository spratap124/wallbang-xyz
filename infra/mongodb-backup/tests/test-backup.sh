#!/usr/bin/env bash
# Tests: end-to-end backup flow with mocked tools (no production access).
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

test_start "successful backup uploads and verifies"
write_config
run_script backup.sh
assert_exit 0 "$RC" "backup exit code"
assert_contains "$OUTPUT" "backup complete" "completion message"
LOCAL_ARCHIVE="$(find "$SANDBOX/backups" -name '*.archive.gz' | head -n1)"
[ -n "$LOCAL_ARCHIVE" ] || { echo "   FAIL: no local archive produced"; exit 1; }
PASS_COUNT=$((PASS_COUNT + 1))
printf '   ok: local archive written (%s)\n' "$(basename "$LOCAL_ARCHIVE")"
[ -f "$LOCAL_ARCHIVE.sha256" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: checksum sidecar written\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: checksum sidecar missing\n'
}
assert_contains "$(cat "$STUB_LOG")" " copy " "rclone copy invoked"
assert_contains "$(cat "$STUB_LOG")" " lsjson " "uploaded file verified"

test_start "connection string never reaches the log or stdout"
assert_not_contains "$(cat "$SANDBOX/logs/backup.log" 2>/dev/null || true)" "SuperSecret123" "log free of mongo password"
assert_not_contains "$OUTPUT" "SuperSecret123" "stdout free of mongo password"
assert_not_contains "$(cat "$STUB_LOG")" "SuperSecret123" "no secret in process args"

test_start "dry-run skips upload and prune"
: >"$STUB_LOG"
write_config
run_script backup.sh --dry-run
assert_exit 0 "$RC" "dry-run exit code"
assert_not_contains "$(cat "$STUB_LOG")" "rclone copy" "no upload during dry-run"
assert_not_contains "$(cat "$STUB_LOG")" "rclone delete" "no prune during dry-run"

test_start "upload failure is reported and older backups survive"
rm -rf "$SANDBOX/backups"/* 2>/dev/null || true
mkdir -p "$SANDBOX/backups/mongodb-20200101-000000"
printf 'old backup' >"$SANDBOX/backups/mongodb-20200101-000000/mongodb-20200101-000000.archive.gz"
write_config
FAIL_RCLONE_COPY=1 run_script backup.sh
assert_exit 5 "$RC" "exit code on upload failure"
assert_contains "$OUTPUT" "Upload failed" "upload failure surfaced"
[ -d "$SANDBOX/backups/mongodb-20200101-000000" ] && {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '   ok: pre-existing backup retained after failure\n'
} || {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '   FAIL: old backup was removed on failure\n'
}

test_start "mongodump failure aborts before upload"
: >"$STUB_LOG"
write_config
FAIL_MONGODUMP=1 run_script backup.sh
assert_exit 3 "$RC" "exit code on dump failure"
assert_not_contains "$(cat "$STUB_LOG")" "rclone copy" "no upload after dump failure"

test_start "mongorestore validation failure aborts before upload"
: >"$STUB_LOG"
write_config
FAIL_MONGORESTORE=1 run_script backup.sh
assert_exit 4 "$RC" "exit code on validation failure"
assert_not_contains "$(cat "$STUB_LOG")" "rclone copy" "no upload after failed validation"

test_start "concurrent run is refused while the lock is held"
write_config
mkdir -p "$SANDBOX/lock/backup.lock.d"
printf '%s\n' "$$" >"$SANDBOX/lock/backup.lock.d/pid"
run_script backup.sh
assert_exit 75 "$RC" "exit code when locked"
assert_contains "$OUTPUT" "already in progress" "lock contention message"

summary
