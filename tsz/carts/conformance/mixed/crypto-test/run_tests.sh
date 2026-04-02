#!/usr/bin/env bash
# Run crypto + privacy Zig test blocks.
# Usage: cd tsz && bash carts/crypto-test/run_tests.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== framework/crypto.zig tests ==="
zig test framework/crypto.zig 2>&1 || { echo "FAIL: crypto.zig"; exit 1; }

if [[ -f framework/privacy.zig ]]; then
  echo ""
  echo "=== framework/privacy.zig tests ==="
  zig test framework/privacy.zig 2>&1 || { echo "FAIL: privacy.zig"; exit 1; }
fi

echo ""
echo "All crypto tests passed."
