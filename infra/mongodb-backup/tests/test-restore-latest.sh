#!/usr/bin/env bash
# Tests: --latest archive resolution for restore, and portable checksums.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

seed_local_backup() {
  # seed_local_backup <stamp>  → mongodb-<stamp>/mongodb-<stamp>.archive.gz (+ sidecar)
  _stamp="$1"
  _dir="$SANDBOX/backups/mongodb-$_stamp"
  mkdir -p "$_dir"
  printf 'archive-%s' "$_stamp" >"$_dir/mongodb-$_stamp.archive.gz"
  (cd "$_dir" && "$BIN/sha256sum" "mongodb-$_stamp.archive.gz" >"mongodb-$_stamp.archive.gz.sha256")
}

# rclone stub: lsf lists remote backup dirs, copyto mirrors the seeded local
# archive/sidecar bytes (so the staged remote copy verifies like the original).
# The CLI wrapper injects --config/--cache-dir, so scan for the subcommand.
update_rclone_stub() {
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
  lsf) printf "mongodb-20260101-020000/\nmongodb-20260103-020000/\nmongodb-20260102-020000/\n";;
  copyto)
    _base="$(basename "$_src")"
    _stamp="$(basename "$(dirname "$_src")")"   # already includes the mongodb- prefix
    case "$_base" in
      *.sha256)
        _sidecar="$SANDBOX/backups/$_stamp/$_stamp.archive.gz.sha256"
        [ -f "$_sidecar" ] || { echo "stub: missing remote sidecar" >&2; exit 1; }
        cp "$_sidecar" "$_dst"
        ;;
      *)
        _archive="$SANDBOX/backups/$_stamp/$_stamp.archive.gz"
        [ -f "$_archive" ] || { echo "stub: missing remote archive" >&2; exit 1; }
        cp "$_archive" "$_dst"
        ;;
    esac
    ;;
  *) : ;;
esac' >/dev/null
}

write_config "MONGODB_DATABASES='wallbang'"
TARGET="mongodb://restoreuser:pass@test-cluster:27017/"

test_start "--latest picks the newest LOCAL backup"
seed_local_backup 20260101-020000
seed_local_backup 20260103-020000
seed_local_backup 20260102-020000
: >"$STUB_LOG"
run_script restore.sh --latest --target-uri "$TARGET" --dry-run --confirm
assert_exit 0 "$RC" "restore --latest exit code"
assert_contains "$OUTPUT" "Latest local archive: mongodb-20260103-020000.archive.gz" "newest stamp chosen"

test_start "--latest --remote picks the newest REMOTE backup"
update_rclone_stub
: >"$STUB_LOG"
run_script restore.sh --latest --remote --target-uri "$TARGET" --dry-run --confirm
assert_exit 0 "$RC" "restore --latest --remote exit code"
assert_contains "$OUTPUT" "Latest off-site archive" "announced remote selection"
assert_contains "$(cat "$STUB_LOG")" "mongodb-20260103-020000/mongodb-20260103-020000.archive.gz" "newest remote stamp chosen"
assert_contains "$(cat "$STUB_LOG")" "mongodb-20260103-020000.archive.gz.sha256" "checksum sidecar fetched too"

test_start "--archive and --latest are mutually exclusive"
run_script restore.sh --archive /tmp/x --latest --target-uri "$TARGET" --confirm
assert_exit 1 "$RC" "conflicting options rejected"
assert_contains "$OUTPUT" "not both" "conflict explained"

test_start "--remote without --latest is rejected"
run_script restore.sh --remote --target-uri "$TARGET" --confirm
assert_exit 1 "$RC" "orphan --remote rejected"
assert_contains "$OUTPUT" "--remote is only meaningful" "orphan flag explained"

test_start "no local backups fails cleanly"
rm -rf "$SANDBOX/backups"/*
run_script restore.sh --latest --target-uri "$TARGET" --confirm
assert_exit 1 "$RC" "exit code with no local backups"
assert_contains "$OUTPUT" "No local backups found" "state explained"

test_start "sidecar with an ABSOLUTE path still verifies (hash comparison)"
seed_local_backup 20260104-020000
_ARCHIVE="$SANDBOX/backups/mongodb-20260104-020000/mongodb-20260104-020000.archive.gz"
(umask 077 && "$BIN/sha256sum" "$_ARCHIVE" >"$_ARCHIVE.sha256")   # absolute-path style
: >"$STUB_LOG"
run_script restore.sh --latest --target-uri "$TARGET" --dry-run --confirm
assert_exit 0 "$RC" "restore with absolute-path sidecar"
assert_contains "$OUTPUT" "Checksum OK" "legacy sidecar verified"

test_start "tampered archive is rejected even with a sidecar"
printf 'tampered' >>"$_ARCHIVE"
run_script restore.sh --latest --target-uri "$TARGET" --dry-run --confirm
assert_exit 4 "$RC" "checksum mismatch aborts"
assert_contains "$OUTPUT" "Checksum mismatch" "mismatch reported"

test_start "verify-backup accepts both sidecar formats"
rm -rf "$SANDBOX/backups"/*
seed_local_backup 20260105-020000
_ABS="$SANDBOX/backups/mongodb-20260105-020000/mongodb-20260105-020000.archive.gz"
(umask 077 && "$BIN/sha256sum" "$_ABS" >"$_ABS.sha256")
run_script verify-backup.sh --latest
assert_exit 0 "$RC" "absolute-path sidecar verifies"

test_start "new sidecars are written with a relative file name"
rm -rf "$SANDBOX/backups"/*
write_config
run_script backup.sh --dry-run
_single="$(find "$SANDBOX/backups" -name '*.archive.gz.sha256' | head -n1)"
_sidecar_body="$(cat "$_single")"
assert_contains "$_sidecar_body" "mongodb-" "sidecar names the archive"
assert_not_contains "$_sidecar_body" "$SANDBOX" "sidecar does not embed an absolute path"

summary
