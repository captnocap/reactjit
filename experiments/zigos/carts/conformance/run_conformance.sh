#!/bin/bash
# Conformance test runner for the zigos TSX compiler
#
# 1. Verify checksums (test files are immutable — fix the compiler, not the tests)
# 2. Compile each entry point with zigos-compiler build
# 3. Report pass/fail
#
# Entry points are auto-discovered: any .tsz file that is NOT a _cls, .script, or .mod file.
#
# Usage: bash carts/conformance/run_conformance.sh

set -euo pipefail
cd "$(dirname "$0")"

COMPILER="../../zig-out/bin/zigos-compiler"
PASS=0
FAIL=0
TOTAL=0
FAILURES=""

echo "═══════════════════════════════════════════════════"
echo "  CONFORMANCE TEST SUITE"
echo "═══════════════════════════════════════════════════"
echo ""

# Step 1: Verify checksums
echo "[1/2] Verifying file integrity..."
if [ ! -f CHECKSUMS.sha256 ]; then
    echo "  No CHECKSUMS.sha256 found. Run: sha256sum *.tsz > CHECKSUMS.sha256"
    exit 1
fi
if sha256sum -c CHECKSUMS.sha256 --quiet 2>/dev/null; then
    FILE_COUNT=$(wc -l < CHECKSUMS.sha256)
    echo "  All ${FILE_COUNT} files match checksums."
else
    echo "  CHECKSUM MISMATCH — test files have been modified!"
    echo "  The spec is the spec. Fix the compiler, not the tests."
    sha256sum -c CHECKSUMS.sha256 2>/dev/null | grep FAILED || true
    exit 1
fi
echo ""

# Step 2: Auto-discover entry points
# Entry points = .tsz files that are NOT _cls, .script, _c, _cmod, _clsmod, .mod
ENTRIES=()
for f in *.tsz; do
    case "$f" in
        *_cls.tsz|*.script.tsz|*_c.tsz|*_cmod.tsz|*_clsmod.tsz|*.mod.tsz)
            continue ;;
        *)
            ENTRIES+=("$f") ;;
    esac
done

echo "[2/2] Building ${#ENTRIES[@]} test carts..."
echo ""

for entry in "${ENTRIES[@]}"; do
    name="${entry%.tsz}"
    printf "  %-40s" "$name"
    TOTAL=$((TOTAL + 1))

    # Run compiler with 30s timeout
    if timeout 30 "$COMPILER" build "$entry" > /tmp/conformance_${name}.log 2>&1; then
        echo "PASS"
        PASS=$((PASS + 1))
    else
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            echo "FAIL (timeout)"
        elif [ $EXIT_CODE -eq 139 ]; then
            echo "FAIL (segfault)"
        else
            echo "FAIL (exit $EXIT_CODE)"
        fi
        FAIL=$((FAIL + 1))
        FAILURES="${FAILURES}\n  ${name}: $(tail -1 /tmp/conformance_${name}.log 2>/dev/null)"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  RESULTS: ${PASS} passed, ${FAIL} failed (${TOTAL} total)"
echo "═══════════════════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
    echo ""
    echo "  Failures:"
    echo -e "$FAILURES"
    echo ""
    exit 1
else
    echo ""
    echo "  All conformance tests passed."
    echo ""
fi
