#!/usr/bin/env bash
# Tests: wallbang-backup-setup creates rclone remotes from backup.env.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

# rclone stub that understands `obscure` and `config create`/`listremotes`.
install_rclone_setup_stubs() {
  make_stub rclone 'sub=""
for a in "$@"; do
  case "$a" in obscure|config|lsd|listremotes) sub="$a"; break;; esac
done
case "$sub" in
  obscure) printf "OBSCURED-VALUE\n";;
  config)
    for a in "$@"; do
      case "$a" in create) printf "CREATE\n";; show) printf "[%s]\n" "$3";; esac
    done
    ;;
  lsd) printf "keep\t-1\t2000-01-01 00:00:00\n";;
  listremotes) printf "wallbang-b2:\nwallbang-backup-crypt:\n";;
esac' >/dev/null
}

config_with_rclone() {
  write_config \
    "RCLONE_CRYPT_REMOTE='wallbang-backup-crypt'" \
    "B2_ACCOUNT_ID='keyid-123'" \
    "B2_APPLICATION_KEY='appkey-456'" \
    "B2_BUCKET='wallbang-db-backups'" \
    "B2_REMOTE='wallbang-b2'" \
    "CRYPT_PASSWORD='cryptPass-789'" \
    "CRYPT_SALT='cryptSalt-000'" \
    "RCLONE_CONFIG='$SANDBOX/etc/rclone.conf'"
}

test_start "missing B2/crypt values fail before touching rclone"
: >"$STUB_LOG"
write_config "RCLONE_CONFIG='$SANDBOX/etc/rclone.conf'"
# config template now defaults MONGODB_DATABASES etc; B2_* are unset here.
run_script setup-rclone.sh
assert_exit 1 "$RC" "exit code when B2/crypt values are missing"
assert_contains "$OUTPUT" "B2_ACCOUNT_ID" "names a missing value"
assert_not_contains "$(cat "$STUB_LOG")" "config" "no rclone config call attempted"

test_start "creates both remotes and obscures the crypt secrets"
install_rclone_setup_stubs
: >"$STUB_LOG"
config_with_rclone
run_script setup-rclone.sh
assert_exit 0 "$RC" "setup exit code"
LOG="$(cat "$STUB_LOG")"
assert_contains "$LOG" "config create wallbang-b2 b2" "B2 remote created"
assert_contains "$LOG" "config create wallbang-backup-crypt crypt" "crypt remote created"
assert_contains "$LOG" "obscure cryptPass-789" "crypt password passed through rclone obscure"
assert_contains "$LOG" "obscure cryptSalt-000" "crypt salt passed through rclone obscure"
assert_contains "$LOG" "lsd wallbang-backup-crypt:" "connectivity verified"

# The crypt remote must receive the obscuring output, never the plaintext.
CRYPT_CREATE_LINE="$(printf '%s\n' "$LOG" | grep 'config create wallbang-backup-crypt crypt' | head -n1)"
assert_contains "$CRYPT_CREATE_LINE" "password OBSCURED-VALUE" "obscured password stored"
assert_not_contains "$CRYPT_CREATE_LINE" "cryptPass-789" "plaintext password not stored"
assert_not_contains "$CRYPT_CREATE_LINE" "cryptSalt-000" "plaintext salt not stored"

test_start "plaintext crypt secrets never reach stdout or logs"
assert_not_contains "$OUTPUT" "cryptPass-789" "stdout free of crypt password"
assert_not_contains "$OUTPUT" "cryptSalt-000" "stdout free of crypt salt"
assert_not_contains "$OUTPUT" "appkey-456" "stdout free of B2 app key"
assert_not_contains "$(cat "$SANDBOX/logs/backup.log" 2>/dev/null || true)" "cryptPass-789" "log free of crypt password"

test_start "rclone.conf is created with restrictive permissions"
PERMS="$(stat -c '%a' "$SANDBOX/etc/rclone.conf" 2>/dev/null || stat -f '%Lp' "$SANDBOX/etc/rclone.conf")"
assert_eq "600" "$PERMS" "rclone.conf mode"

test_start "re-running is a no-op while the remotes exist"
cat >"$SANDBOX/etc/rclone.conf" <<'EOF'
[wallbang-b2]
type = b2

[wallbang-backup-crypt]
type = crypt
EOF
: >"$STUB_LOG"
run_script setup-rclone.sh
assert_exit 0 "$RC" "second run exit code"
assert_not_contains "$(cat "$STUB_LOG")" "config create" "existing remotes left untouched"
assert_contains "$OUTPUT" "already exists" "idempotency explained"

test_start "--force recreates the remotes"
: >"$STUB_LOG"
run_script setup-rclone.sh --force
assert_exit 0 "$RC" "forced run exit code"
assert_contains "$(cat "$STUB_LOG")" "config create wallbang-b2 b2" "B2 remote recreated"

test_start "--dry-run calls rclone only for reads"
rm -f "$SANDBOX/etc/rclone.conf"
: >"$STUB_LOG"
run_script setup-rclone.sh --dry-run
assert_exit 0 "$RC" "dry-run exit code"
assert_not_contains "$(cat "$STUB_LOG")" "config create" "dry-run creates nothing"
assert_contains "$OUTPUT" "[dry-run]" "dry-run explained"

test_start "unsupported option shows usage"
run_script setup-rclone.sh --nope
assert_exit 1 "$RC" "exit code for unknown option"

summary
