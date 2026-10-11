#!/usr/bin/env bash
# Tests: config handling and secret redaction.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

setup_sandbox
install_stub_tools
trap teardown_sandbox EXIT

test_start "missing config file fails with EX_CONFIG"
export WALLBANG_BACKUP_CONFIG="$SANDBOX/etc/does-not-exist.env"
run_script backup.sh --dry-run
assert_exit 1 "$RC" "exit code when config missing"
assert_contains "$OUTPUT" "Config file not found" "message points at the config path"

test_start "missing required values fail with EX_CONFIG"
write_config "MONGODB_URI=''" "RCLONE_CRYPT_REMOTE=''"
run_script backup.sh --dry-run
assert_exit 1 "$RC" "exit code when required values empty"
assert_contains "$OUTPUT" "MONGODB_URI" "names the missing key"
assert_contains "$OUTPUT" "RCLONE_CRYPT_REMOTE" "names the missing crypt remote"

test_start "invalid RETENTION_DAYS is rejected"
write_config "RETENTION_DAYS='thirty'"
run_script backup.sh --dry-run
assert_exit 1 "$RC" "exit code for bad retention"

test_start "unknown option shows usage"
write_config
run_script backup.sh --nope
assert_exit 1 "$RC" "exit code for unknown option"
assert_contains "$OUTPUT" "Unknown option" "usage error message"

test_start "secret redaction hides credentials"
. "$UTIL_DIR/lib/common.sh"
REDACTED="$(printf '%s\n' \
  'mongodb+srv://backupuser:SuperSecret123@cluster0.example.mongodb.net/?x=1' \
  'DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456/abcdef' \
  'B2_APPLICATION_KEY:K001abcdefg' | redact)"
assert_not_contains "$REDACTED" "SuperSecret123" "mongodb password redacted"
assert_not_contains "$REDACTED" "abcdef" "webhook token redacted"
assert_not_contains "$REDACTED" "K001abcdefg" "B2 key redacted"
assert_contains "$REDACTED" "mongodb+srv://***@" "keeps the URI shape for debugging"

summary
