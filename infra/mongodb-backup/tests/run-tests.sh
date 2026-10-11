#!/usr/bin/env bash
# Runs every test file in this directory. No root, no external services.
#
# Usage: infra/mongodb-backup/tests/run-tests.sh
set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED_FILES=0
TOTAL_FILES=0

for _test in "$TESTS_DIR"/test-*.sh; do
  [ -f "$_test" ] || continue
  TOTAL_FILES=$((TOTAL_FILES + 1))
  printf '\n=== %s ===\n' "$(basename "$_test")"
  if ! bash "$_test"; then
    FAILED_FILES=$((FAILED_FILES + 1))
  fi
done

printf '\n-------------------------------------------\n'
if [ "$FAILED_FILES" -eq 0 ]; then
  printf 'All %d test files passed.\n' "$TOTAL_FILES"
  exit 0
fi
printf '%d of %d test files failed.\n' "$FAILED_FILES" "$TOTAL_FILES"
exit 1
