#!/usr/bin/env bash
# WPT Flex Conformance Runner
# Compiles and builds each WPT flex test, reports pass/fail score.
#
# Usage: bash carts/wpt-flex/run_wpt.sh
#
# Requires: HTML tag support in the compiler (Phase 2 Step 1)

set -euo pipefail
cd "$(dirname "$0")/../.."

COMPILER="./zig-out/bin/zigos-compiler"
TIMEOUT=60
PASS=0
FAIL=0
SKIP=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

if [ ! -f "$COMPILER" ]; then
    echo "Compiler not found at $COMPILER — build with: zig build tsz-compiler"
    exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  WPT Flex Conformance Test Suite"
echo "═══════════════════════════════════════════════════"
echo ""

for tsz in carts/wpt-flex/[0-9]*.tsz; do
    name=$(basename "$tsz" .tsz)
    TOTAL=$((TOTAL + 1))
    printf "%-40s " "$name"

    # Step 1: Compile .tsz → .zig
    if ! timeout "$TIMEOUT" "$COMPILER" build "$tsz" > /tmp/wpt_compile_out.txt 2>&1; then
        printf "${RED}FAIL${NC} (compile error)\n"
        tail -3 /tmp/wpt_compile_out.txt | sed 's/^/    /'
        FAIL=$((FAIL + 1))
        continue
    fi

    # Step 2: Build .zig → binary
    if ! timeout "$TIMEOUT" zig build app 2> /tmp/wpt_build_out.txt; then
        printf "${RED}FAIL${NC} (zig build error)\n"
        tail -3 /tmp/wpt_build_out.txt | sed 's/^/    /'
        FAIL=$((FAIL + 1))
        continue
    fi

    printf "${GREEN}PASS${NC} (compile + build)\n"
    PASS=$((PASS + 1))
done

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  Score: ${GREEN}${PASS}${NC}/${TOTAL} pass, ${RED}${FAIL}${NC} fail, ${YELLOW}${SKIP}${NC} skip"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Note: PASS means compile+build succeeded."
echo "Visual runtime verification is still needed for full conformance."
