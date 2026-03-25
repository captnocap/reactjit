#!/bin/bash
# Verify zscript conformance tests do NOT produce standalone .zig files.
# If the compiler emits a separate .zig file instead of embedding the
# zscript into generated_app.zig, the zscript pipeline is broken.
#
# Usage: ./verify_zscript.sh
# Run from the tsz/ directory.

set -euo pipefail

COMPILER="./zig-out/bin/zigos-compiler"
CONF_DIR="carts/conformance"
FAIL=0
PASS=0

for test_file in "$CONF_DIR"/d*b_*zscript*.tsz; do
    [ -f "$test_file" ] || continue
    base=$(basename "$test_file" .tsz)

    # Clean any pre-existing stray .zig files
    stray_pattern="${base%.tsz}"
    rm -f "${stray_pattern}"*.zig ./"${stray_pattern}"*.zig "$CONF_DIR/${stray_pattern}"*.zig 2>/dev/null

    # Also clean common output locations
    find . -maxdepth 1 -name "*${base}*" -name "*.zig" -delete 2>/dev/null

    echo -n "[$base] compiling... "

    # Compile the test
    $COMPILER build "$test_file" 2>&1 > /dev/null || true

    # Check for ANY new .zig file that matches this test name
    stray_files=$(find . -maxdepth 2 -name "*${base}*.zig" -o -name "*$(echo "$base" | sed 's/b_//' | sed 's/_zscript//')*.zig" 2>/dev/null | grep -v generated_app.zig | grep -v build.zig || true)

    # Also check for files named after the test without the d prefix
    short_name=$(echo "$base" | sed 's/^d[0-9]*b_//' | sed 's/_zscript$//')
    stray_short=$(find . -maxdepth 2 -name "*${short_name}*.zig" 2>/dev/null | grep -v generated_app.zig | grep -v build.zig | grep -v compiler/ | grep -v framework/ | grep -v carts/ || true)

    all_stray="$stray_files $stray_short"
    all_stray=$(echo "$all_stray" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

    if [ -n "$all_stray" ]; then
        echo "FAIL — standalone .zig file(s) created:"
        echo "$all_stray" | sed 's/^/    /'
        echo "    zscript must embed into generated_app.zig, not produce a separate file"
        FAIL=$((FAIL + 1))
    else
        # Verify the zscript content is actually IN generated_app.zig
        if [ -f "generated_app.zig" ]; then
            # Check for some marker that the script logic was embedded
            if grep -q "$short_name\|zscript\|timer\|array_methods\|string_ops\|json_parse\|math_derived\|state_machine" generated_app.zig 2>/dev/null; then
                echo "PASS — embedded in generated_app.zig"
                PASS=$((PASS + 1))
            else
                echo "FAIL — no zscript content found in generated_app.zig"
                FAIL=$((FAIL + 1))
            fi
        else
            echo "FAIL — no generated_app.zig produced"
            FAIL=$((FAIL + 1))
        fi
    fi
done

echo ""
echo "=== Results: $PASS pass, $FAIL fail ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
