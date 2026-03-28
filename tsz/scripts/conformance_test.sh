#!/bin/bash
# Run full conformance suite: forge → zig build app on every cart
# Skip .script.tsz (library targets) and .cls.tsz (style-only)
# Reports real pass/fail with error categorization
set -o pipefail
cd "$(dirname "$0")/.."

PASS=0
PREFLIGHT_BLOCKED=0
FORGE_FAIL=0
ZIG_FAIL=0
TOTAL=0
SKIPPED=0

PREFLIGHT_LOG=""
FORGE_LOG=""
ZIG_LOG=""

for f in carts/conformance/*.tsz; do
    NAME=$(basename "$f" .tsz)

    # Skip library targets and style files — they don't build as standalone apps
    case "$NAME" in
        *.script|*.cls) SKIPPED=$((SKIPPED+1)); continue ;;
    esac

    TOTAL=$((TOTAL+1))
    GEN="generated_${NAME}.zig"

    # Clean stale output
    rm -f "$GEN"

    # Step 1: forge (smith compile: .tsz → .zig) — use --single for monolithic output
    OUT=$(./zig-out/bin/forge build --single "$f" 2>&1)
    if [ $? -ne 0 ]; then
        FORGE_FAIL=$((FORGE_FAIL+1))
        FORGE_LOG="${FORGE_LOG}  ${NAME}\n"
        continue
    fi

    # Check if preflight blocked
    if grep -q "PREFLIGHT BLOCKED" "$GEN" 2>/dev/null; then
        PREFLIGHT_BLOCKED=$((PREFLIGHT_BLOCKED+1))
        REASON=$(grep "FATAL:\|WARN:" "$GEN" 2>/dev/null | head -5 | sed 's/^\/\/! /  /')
        PREFLIGHT_LOG="${PREFLIGHT_LOG}  ${NAME}:\n${REASON}\n"
        continue
    fi

    # Step 2: zig build app (full compile + link)
    ZBUILD=$(zig build app -Dapp-name="$NAME" -Dapp-source="$GEN" -Doptimize=ReleaseFast 2>&1)
    if [ $? -ne 0 ]; then
        ZIG_FAIL=$((ZIG_FAIL+1))
        # Categorize the error
        ERRMSG=$(echo "$ZBUILD" | grep "error:" | head -3)
        ZIG_LOG="${ZIG_LOG}  ${NAME}: ${ERRMSG}\n"
    else
        PASS=$((PASS+1))
    fi
done

echo "=== CONFORMANCE RESULTS ==="
echo "Total app carts tested: $TOTAL"
echo "Skipped (.script/.cls): $SKIPPED"
echo "PASS (forge + zig compile): $PASS"
echo "PREFLIGHT BLOCKED: $PREFLIGHT_BLOCKED"
echo "FORGE FAIL: $FORGE_FAIL"
echo "ZIG COMPILE FAIL: $ZIG_FAIL"
echo

if [ $PREFLIGHT_BLOCKED -gt 0 ]; then
    echo "--- PREFLIGHT BLOCKS (check for false positives) ---"
    echo -e "$PREFLIGHT_LOG"
fi
if [ $FORGE_FAIL -gt 0 ]; then
    echo "--- FORGE FAILURES ---"
    echo -e "$FORGE_LOG"
fi
if [ $ZIG_FAIL -gt 0 ]; then
    echo "--- ZIG COMPILE FAILURES ---"
    echo -e "$ZIG_LOG"
fi
