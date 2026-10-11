#!/usr/bin/env bash
# Tests: interactive `--pick` restore (credentials from config, replace by default).
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

seed_local_backup() {
  _stamp="$1"
  _dir="$SANDBOX/backups/mongodb-$_stamp"
  mkdir -p "$_dir"
  printf 'archive-%s' "$_stamp" >"$_dir/mongodb-$_stamp.archive.gz"
  (cd "$_dir" && "$BIN/sha256sum" "mongodb-$_stamp.archive.gz" >"mongodb-$_stamp.archive.gz.sha256")
}

seed_local_backup 20260101-020000
seed_local_backup 20260105-020000

write_config "MONGODB_DATABASES='wallbang'"
MONGODB_URI_VALUE='mongodb+srv://appuser:SuperSecret@wallbang.lpn8iur.mongodb.net/?retryWrites=false'
printf "MONGODB_URI='%s'\n" "$MONGODB_URI_VALUE" >>"$SANDBOX/etc/backup.env"

# rclone stub: lsf lists restore points; copyto mirrors the seeded bytes.
make_stub rclone 'sub=""
while [ $# -gt 0 ]; do
  case "$1" in
    lsf) sub="lsf"; shift; break;;
    copyto) sub="copyto"; shift; _src="$1"; _dst="$2"; break;;
    --config|--cache-dir|--password-command) shift 2; continue;;
    *) shift;;
  esac
done
case "$sub" in
  lsf) printf "mongodb-20260101-020000/\nmongodb-20260105-020000/\n";;
  copyto)
    _base="$(basename "$_src")"
    _stamp="$(basename "$(dirname "$_src")")"
    case "$_base" in
      *.sha256) [ -f "$SANDBOX/backups/$_stamp/$_stamp.archive.gz.sha256" ] && cp "$SANDBOX/backups/$_stamp/$_stamp.archive.gz.sha256" "$_dst" || exit 1;;
      *) [ -f "$SANDBOX/backups/$_stamp/$_stamp.archive.gz" ] && cp "$SANDBOX/backups/$_stamp/$_stamp.archive.gz" "$_dst" || exit 1;;
    esac
    ;;
  *) : ;;
esac' >/dev/null

run_pick() {
  # run_pick <stdin> [extra args...]
  _input="$1"
  shift
  set +e
  OUTPUT="$(printf '%s' "$_input" | "$UTIL_DIR/bin/restore.sh" --pick --dry-run "$@" 2>&1)"
  RC=$?
  set -e
}

test_start "--pick REPLACES by default so the restore point wins"
: >"$STUB_LOG"
run_pick "2
restore
"
assert_exit 0 "$RC" "interactive restore exit code"
assert_contains "$OUTPUT" "Available restore points on B2" "restore points listed"
assert_contains "$OUTPUT" "1) 2026-01-05" "newest listed first"
assert_contains "$OUTPUT" "2) 2026-01-01" "older listed second"
assert_contains "$OUTPUT" "20260101-020000" "selected (older) restore point announced"
assert_contains "$OUTPUT" "REPLACE" "replace mode announced"
LOG="$(cat "$STUB_LOG")"
assert_contains "$LOG" "copyto test-crypt:mongodb/mongodb-20260101-020000/mongodb-20260101-020000.archive.gz" "chosen archive downloaded"
assert_contains "$LOG" "mongorestore" "restore invoked"
assert_contains "$LOG" "--drop" "collections dropped for a true point-in-time restore"

test_start "--pick never exposes the MongoDB password"
assert_not_contains "$OUTPUT" "SuperSecret" "password absent from output"
assert_not_contains "$LOG" "SuperSecret" "password absent from process args"
assert_not_contains "$OUTPUT" "appuser" "user absent from output"

test_start "--pick --merge inserts only"
: >"$STUB_LOG"
run_pick "1
restore
" --merge
assert_exit 0 "$RC" "merge exit code"
assert_contains "$OUTPUT" "MERGE" "merge mode announced"
assert_not_contains "$(cat "$STUB_LOG")" "--drop" "merge never drops"

test_start "--pick takes the default (newest) restore point on empty input"
: >"$STUB_LOG"
run_pick "
restore
"
assert_exit 0 "$RC" "default selection exit code"
assert_contains "$OUTPUT" "20260105-020000" "newest chosen by default"

test_start "--pick aborts unless the confirmation word is typed"
: >"$STUB_LOG"
run_pick "1
nope
"
assert_exit 8 "$RC" "wrong confirmation word aborts"
assert_contains "$OUTPUT" "did not match 'restore'" "abort explains the mismatch"
assert_contains "$OUTPUT" "got 'nope'" "abort echoes what was typed"
assert_not_contains "$(cat "$STUB_LOG")" "mongorestore" "no restore performed"

test_start "--pick tolerates surrounding whitespace and upper case"
: >"$STUB_LOG"
run_pick "1
   RESTORE  
"
assert_exit 0 "$RC" "padded/uppercase confirmation accepted"
assert_contains "$(cat "$STUB_LOG")" "mongorestore" "restore performed"

test_start "--pick tolerates a carriage return (pasted text)"
: >"$STUB_LOG"
run_pick "1
restore$(printf '\r')
"
assert_exit 0 "$RC" "CR-terminated confirmation accepted"
assert_contains "$(cat "$STUB_LOG")" "mongorestore" "restore performed"

test_start "--pick trims whitespace around the restore-point number"
: >"$STUB_LOG"
run_pick "  2  
restore
"
assert_exit 0 "$RC" "padded selection accepted"
assert_contains "$OUTPUT" "20260101-020000" "padded number resolved to the right point"

test_start "--pick rejects an out-of-range selection"
run_pick "9
restore
"
assert_exit 1 "$RC" "invalid selection exit code"
assert_contains "$OUTPUT" "No restore point number 9" "range error explained"

test_start "--pick refuses to run without MONGODB_URI in the config"
grep -v '^MONGODB_URI=' "$SANDBOX/etc/backup.env" >"$SANDBOX/etc/no-uri.env"
set +e
OUTPUT="$(printf '1\nrestore\n' | WALLBANG_BACKUP_CONFIG="$SANDBOX/etc/no-uri.env" "$UTIL_DIR/bin/restore.sh" --pick --dry-run 2>&1)"
RC=$?
set -e
assert_exit 1 "$RC" "missing URI exit code"
assert_contains "$OUTPUT" "needs MONGODB_URI" "guidance shown"

test_start "--pick cannot be combined with --archive"
run_pick "1
restore
" --archive /tmp/x
assert_exit 1 "$RC" "conflicting flags rejected"
assert_contains "$OUTPUT" "cannot be combined" "conflict explained"

test_start "scripted --replace maps to --drop"
write_config
make_stub mongorestore 'if [ "${FAIL_MONGORESTORE:-0}" = "1" ]; then exit 1; fi'
printf 'bytes' >"$SANDBOX/archive.gz"
set +e
OUTPUT="$("$UTIL_DIR/bin/restore.sh" --archive "$SANDBOX/archive.gz" \
  --target-uri "mongodb://u:p@test-cluster:27017/" --replace --confirm 2>&1)"
RC=$?
set -e
assert_exit 0 "$RC" "scripted replace exit code"
assert_contains "$(cat "$STUB_LOG")" "--drop" "replace maps to --drop for scripted runs"

summary
