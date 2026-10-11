#!/usr/bin/env bash
# Tests: pure helpers in lib/common.sh (no root, no tools).
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-test-harness.sh"

. "$UTIL_DIR/lib/common.sh"

test_start "MongoDB apt repo series is chosen per Ubuntu codename"
assert_eq "8.0" "$(mongodb_repo_series_for_codename noble)" "noble (24.04) uses 8.0"
assert_eq "8.0" "$(mongodb_repo_series_for_codename oracular)" "oracular uses 8.0"
assert_eq "7.0" "$(mongodb_repo_series_for_codename jammy)" "jammy (22.04) uses 7.0"
assert_eq "7.0" "$(mongodb_repo_series_for_codename focal)" "focal (20.04) uses 7.0"
assert_eq "8.0" "$(mongodb_repo_series_for_codename unknown-release)" "unknown falls back to 8.0"

summary
