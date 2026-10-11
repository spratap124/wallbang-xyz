#!/usr/bin/env bash
# Shared test harness for the WallBang MongoDB backup utility.
# Deliberately dependency-free: runs without root, mongodump, rclone or flock.
#
# shellcheck shell=bash

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTIL_DIR="$(cd "$TESTS_DIR/.." && pwd)"

PASS_COUNT=0
FAIL_COUNT=0
CURRENT_TEST=""

setup_sandbox() {
  # Creates an isolated tree + command stubs, exports paths for the scripts.
  SANDBOX="$(mktemp -d "${TMPDIR:-/tmp}/wallbang-backup-test.XXXXXX")"
  export SANDBOX
  BIN="$SANDBOX/bin"
  mkdir -p "$BIN" "$SANDBOX/backups" "$SANDBOX/logs" "$SANDBOX/etc" "$SANDBOX/lock"
  STUB_LOG="$SANDBOX/stub.log"
  : >"$STUB_LOG"

  # sha256sum-compatible tool (macOS ships shasum, not sha256sum).
  if command -v sha256sum >/dev/null 2>&1; then
    SHA_TOOL="$(command -v sha256sum)"
    SHA_STUB_BODY="exec $SHA_TOOL \"\$@\""
  else
    SHA_TOOL="$(command -v shasum)"
    SHA_STUB_BODY="exec $SHA_TOOL -a 256 \"\$@\""
  fi
  [ -n "$SHA_TOOL" ] || {
    echo "No sha256 tool available" >&2
    exit 1
  }
  # Always provide a stub so SHA256_BIN is stable across platforms.
  make_stub sha256sum "$SHA_STUB_BODY" >/dev/null
}

# make_stub <name> [body]
# Body runs with $@ = args and must exit 0 unless FAIL_<NAME_UPPER>=1.
make_stub() {
  _name="$1"
  _body="${2:-}"
  _path="$BIN/$_name"
  {
    echo '#!/usr/bin/env bash'
    echo "printf '%s %s\\n' '$_name' \"\$*\" >>'$STUB_LOG'"
    if [ -n "$_body" ]; then
      printf '%s\n' "$_body"
    fi
    echo 'exit 0'
  } >"$_path"
  chmod +x "$_path"
  printf '%s' "$_path"
}

# Failing stubs: honour env flags so tests can simulate tool failures.
make_failing_stub() {
  _name="$1"
  _flag="$2"
  make_stub "$_name" "if [ \"\${$_flag:-0}\" = \"1\" ]; then printf '%s simulated failure\n' \"$_name\" >&2; exit 1; fi"
}

write_config() {
  # write_config [extra lines...]
  CONFIG="$SANDBOX/etc/backup.env"
  {
    echo "MONGODB_URI='mongodb+srv://backupuser:SuperSecret123@cluster0.example.mongodb.net/?retryWrites=false'"
    echo "MONGODB_DATABASES=''"
    echo "RCLONE_CRYPT_REMOTE='test-crypt'"
    echo "RCLONE_PATH='mongodb'"
    echo "RETENTION_DAYS=30"
    echo "MIN_FREE_DISK_MB=1"
    echo "MONGODUMP_BIN='$BIN/mongodump'"
    echo "MONGORESTORE_BIN='$BIN/mongorestore'"
    echo "RCLONE_BIN='$BIN/rclone'"
    echo "SHA256_BIN='$BIN/sha256sum'"
    echo "FLOCK_BIN='$BIN/flock-missing'"
    echo "CURL_BIN='$BIN/curl'"
    echo "LOCAL_BACKUP_DIR='$SANDBOX/backups'"
    echo "LOG_FILE='$SANDBOX/logs/backup.log'"
    echo "BACKUP_LOCK_FILE='$SANDBOX/lock/backup.lock'"
    for _line in "$@"; do echo "$_line"; done
  } >"$CONFIG"
  export WALLBANG_BACKUP_CONFIG="$CONFIG"
}

# Standard stubs used by most tests.
install_stub_tools() {
  # mongodump writes the archive path it is given.
  make_stub mongodump 'for a in "$@"; do case "$a" in --archive=*) printf "ARCHIVE" >"${a#--archive=}";; esac; done; if [ "${FAIL_MONGODUMP:-0}" = "1" ]; then echo "mongodump boom" >&2; exit 1; fi' >/dev/null
  make_stub mongorestore 'if [ "${FAIL_MONGORESTORE:-0}" = "1" ]; then echo "mongorestore boom" >&2; exit 1; fi' >/dev/null
  make_stub rclone 'if [ "${FAIL_RCLONE:-0}" = "1" ]; then echo "rclone boom" >&2; exit 1; fi
sub=""
for a in "$@"; do
  case "$a" in copy|copyto|delete|lsjson|lsd|lsf) sub="$a"; break;; esac
done
if [ "${FAIL_RCLONE_COPY:-0}" = "1" ] && { [ "$sub" = "copy" ] || [ "$sub" = "copyto" ]; }; then echo "rclone copy boom" >&2; exit 1; fi
if [ "${FAIL_RCLONE_DELETE:-0}" = "1" ] && [ "$sub" = "delete" ]; then echo "rclone delete boom" >&2; exit 1; fi
case "$sub" in lsjson) printf "{\"Size\":7}\n";; lsd|lsf) printf "keep\t-1\t2000-01-01 00:00:00\n";; esac' >/dev/null
  make_stub curl >/dev/null
}

test_start() {
  CURRENT_TEST="$1"
  printf '\n-- %s\n' "$CURRENT_TEST"
}

assert_eq() {
  _expected="$1"
  _actual="$2"
  _msg="${3:-}"
  if [ "$_expected" = "$_actual" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf '   ok: %s\n' "${_msg:-$_expected == $_actual}"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf '   FAIL: %s (expected [%s], got [%s])\n' "${_msg:-}" "$_expected" "$_actual"
  fi
}

assert_contains() {
  _haystack="$1"
  _needle="$2"
  _msg="${3:-}"
  case "$_haystack" in
    *"$_needle"*) PASS_COUNT=$((PASS_COUNT + 1)); printf '   ok: %s\n' "${_msg:-contains $_needle}" ;;
    *)
      FAIL_COUNT=$((FAIL_COUNT + 1))
      printf '   FAIL: %s (missing [%s])\n' "${_msg:-}" "$_needle"
      ;;
  esac
}

assert_not_contains() {
  _haystack="$1"
  _needle="$2"
  _msg="${3:-}"
  case "$_haystack" in
    *"$_needle"*)
      FAIL_COUNT=$((FAIL_COUNT + 1))
      printf '   FAIL: %s (unexpected [%s])\n' "${_msg:-}" "$_needle"
      ;;
    *) PASS_COUNT=$((PASS_COUNT + 1)); printf '   ok: %s\n' "${_msg:-does not contain $_needle}" ;;
  esac
}

assert_exit() {
  _expected="$1"
  _actual="$2"
  _msg="${3:-}"
  assert_eq "$_expected" "$_actual" "${_msg:-exit code}"
}

run_script() {
  # run_script <script> [args...]  -> sets RC and OUTPUT (used by callers)
  _script="$1"
  shift
  set +e
  # shellcheck disable=SC2034 # consumed by the sourcing test file
  OUTPUT="$("$UTIL_DIR/bin/$_script" "$@" 2>&1)"
  # shellcheck disable=SC2034 # consumed by the sourcing test file
  RC=$?
  set -e
}

teardown_sandbox() {
  [ -n "${SANDBOX:-}" ] && rm -rf "$SANDBOX" || true
  unset WALLBANG_BACKUP_CONFIG SANDBOX BIN STUB_LOG CONFIG 2>/dev/null || true
}

summary() {
  printf '\n%s: %d passed, %d failed\n' "${0##*/}" "$PASS_COUNT" "$FAIL_COUNT"
  [ "$FAIL_COUNT" -eq 0 ] || exit 1
  exit 0
}
