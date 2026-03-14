#!/usr/bin/env bash
# run_host.sh — Run sandbox tests on the host (Option A)
# No QEMU needed. Runs in <1 second.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "  CartridgeOS Sandbox Tests (host)"
echo "  Running with: $(which luajit) $(luajit -v 2>&1 | head -1)"
echo ""

luajit tests/test_sandbox_host.lua
EXIT=$?

if [ $EXIT -eq 0 ]; then
  echo "  Host tests: ALL PASSED"
else
  echo "  Host tests: FAILED (exit $EXIT)"
fi
echo ""
exit $EXIT
