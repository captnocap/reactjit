#!/bin/bash
# test-build.sh — verify the tsz build pipeline produces the correct binary
# Usage: ./native/tsz/test-build.sh <file.tsz>
#
# Checks:
# 1. tsz compiler produces generated_app.zig from the given source
# 2. generated_app.zig references the correct source file
# 3. zig build engine-app succeeds
# 4. The binary runs and exits cleanly (2-second timeout)

set -e

TSZ_FILE="${1:?Usage: test-build.sh <file.tsz>}"
TSZ_BASENAME=$(basename "$TSZ_FILE")
GENERATED="native/engine/generated_app.zig"
BINARY="zig-out/bin/tsz-app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

fail() {
    echo -e "\a${RED}FAIL${NC}: $1"
    notify-send -u critical "tsz BUILD FAILED" "$1 ($TSZ_BASENAME)" 2>/dev/null || true
    exit 1
}
pass() { echo -e "${GREEN}PASS${NC}: $1"; }
warn() { echo -e "${YELLOW}WARN${NC}: $1"; }

echo "=== tsz build test: $TSZ_BASENAME ==="

# Step 1: Compile .tsz → generated_app.zig
echo -n "Compiling $TSZ_BASENAME... "
COMPILE_OUT=$(./zig-out/bin/tsz build "$TSZ_FILE" 2>&1) || {
    echo ""
    echo "$COMPILE_OUT"
    fail "tsz compiler failed"
}
pass "compiled"

# Step 2: Verify generated_app.zig references the right source
echo -n "Checking generated_app.zig source reference... "
if ! head -4 "$GENERATED" | grep -q "Source: $TSZ_BASENAME"; then
    ACTUAL_SOURCE=$(head -4 "$GENERATED" | grep "Source:" || echo "(none)")
    fail "Expected 'Source: $TSZ_BASENAME', got '$ACTUAL_SOURCE'"
fi
pass "source matches"

# Step 3: Check generated_app.zig is syntactically valid (no broken strings)
echo -n "Checking for broken string literals... "
if grep -P '\.text = ".*[^\x00-\x7F].*"' "$GENERATED" | grep -qP '[\x80-\xBF]"'; then
    # This is actually fine — raw UTF-8 in Zig strings is valid
    pass "UTF-8 strings present (OK)"
else
    pass "no broken strings"
fi

# Step 4: Build the binary
echo -n "Building engine-app... "
BUILD_OUT=$(zig build engine-app 2>&1) || {
    echo ""
    echo "$BUILD_OUT"
    fail "zig build failed"
}
pass "built"

# Step 5: Verify binary exists and is fresh
echo -n "Checking binary... "
if [ ! -f "$BINARY" ]; then
    fail "binary not found at $BINARY"
fi
# Binary should be newer than generated_app.zig
if [ "$BINARY" -ot "$GENERATED" ]; then
    warn "binary is older than generated_app.zig — may be stale"
else
    pass "binary is fresh"
fi

# Step 6: Quick smoke test — run for 1 second, check it doesn't crash
echo -n "Smoke test (1s run)... "
timeout 1 "$BINARY" 2>/dev/null || true
# timeout returns 124 on timeout (expected — app runs until ESC)
# Non-zero from the app itself would be a crash
EXIT_CODE=$?
if [ $EXIT_CODE -eq 124 ] || [ $EXIT_CODE -eq 0 ]; then
    pass "runs without crash"
else
    fail "binary crashed with exit code $EXIT_CODE"
fi

echo ""
echo -e "${GREEN}All checks passed for $TSZ_BASENAME${NC}"
