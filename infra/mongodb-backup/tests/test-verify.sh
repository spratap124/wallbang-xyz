#!/usr/bin/env bash
# Tests: verification script behaviour.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

seed_backup() {
  # seed_backup <dir-name> [age-days]
  _name="$1"
  _age="${2:-0}"
  _dir="$SANDBOX/backups/$_name"
  mkdir -p "$_dir"
  _file="$_dir/$_name.archive.gz"
  printf 'fake archive bytes' >"$_file"
  (cd "$_dir" && "$BIN/sha256sum" "$(basename "$_file")" >"$(basename "$_file").sha256")
  if [ "$_age" -gt 0 ]; then
    _stamp="$(date -u -v-"${_age}"d '+%Y%m%d%H%M' 2>/dev/null || printf '202001010000')"
    touch -t "$_stamp" "$_file" 2>/dev/null || true
  fi
}

test_start "missing backup directory fails"
write_config
rm -rf "$SANDBOX/backups"
run_script verify-backup.sh
assert_exit 6 "$RC" "exit code when no backups dir"

test_start "no local backups fails"
write_config
mkdir -p "$SANDBOX/backups"
run_script verify-backup.sh
assert_exit 6 "$RC" "exit code when no backups exist"

test_start "valid newest backup verifies"
write_config
seed_backup "mongodb-20260101-020000"
run_script verify-backup.sh --latest
assert_exit 0 "$RC" "exit code for healthy backup"
assert_contains "$OUTPUT" "OK  checksum" "checksum reported OK"

test_start "corrupted archive is detected"
write_config
printf 'tampered' >>"$SANDBOX/backups/mongodb-20260101-020000/mongodb-20260101-020000.archive.gz"
run_script verify-backup.sh --latest
assert_exit 6 "$RC" "exit code for bad checksum"
assert_contains "$OUTPUT" "BAD checksum" "checksum mismatch reported"

test_start "stale backups fail the age check"
rm -rf "$SANDBOX/backups"/*
write_config
seed_backup "mongodb-old" 90
run_script verify-backup.sh --latest --max-age-days 2
assert_exit 6 "$RC" "exit code for stale backup"
assert_contains "$OUTPUT" "older than" "staleness explained"

test_start "--all checks every backup"
rm -rf "$SANDBOX/backups"/*
write_config
seed_backup "mongodb-20260101-020000"
seed_backup "mongodb-20260102-020000"
run_script verify-backup.sh --all
assert_exit 0 "$RC" "exit code for --all"
assert_contains "$OUTPUT" "Verified 2 archive(s)" "counted both archives"

test_start "--remote reports unreachable remotes"
write_config
seed_backup "mongodb-20260103-020000"
FAIL_RCLONE=1 run_script verify-backup.sh --latest --remote
assert_exit 6 "$RC" "exit code when remote unreachable"

summary
