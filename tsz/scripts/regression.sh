#!/bin/bash
# Visual regression testing pipeline.
#
# For every cart that has a baseline screenshot in tsz/screenshots/,
# builds the cart, runs it with ZIGOS_SCREENSHOT=1, compares the
# captured frame against the baseline, and reports drift.
#
# Usage:
#   ./scripts/regression.sh                # test all carts with baselines
#   ./scripts/regression.sh d01 d12        # test specific carts (substring match)
#   ./scripts/regression.sh --update d01   # capture new baselines for matching carts
#
# Thresholds: PASS = <1% diff, DRIFT = 1-5% diff, FAIL = >5% diff
#
# Requires: ImageMagick (compare), SDL3 display

set -euo pipefail
cd "$(dirname "$0")/.."

SCREENSHOTS_DIR="screenshots"
TMP_DIR="/tmp/regression_$$"
TIMEOUT_SEC=30
UPDATE_MODE=0

# ── Parse args ──
FILTERS=()
for arg in "$@"; do
    case "$arg" in
        --update) UPDATE_MODE=1 ;;
        --help|-h)
            echo "Usage: scripts/regression.sh [--update] [cart-filter ...]"
            echo "  --update   Capture new baselines instead of comparing"
            echo "  filters    Substring match against screenshot names"
            exit 0
            ;;
        *) FILTERS+=("$arg") ;;
    esac
done

# ── Preflight ──
if ! command -v compare &>/dev/null; then
    echo "ERROR: ImageMagick 'compare' not found. Install with: sudo apt install imagemagick"
    exit 1
fi

mkdir -p "$TMP_DIR"
trap "rm -rf '$TMP_DIR'" EXIT

# ── Find cart .tsz file for a screenshot name ──
# Searches carts/ recursively. Returns first match.
find_cart() {
    local name="$1"
    # Try exact match in carts/ tree (non-script, non-cls variants)
    local found
    found=$(find carts/ -name "${name}.tsz" -not -name "*.script.tsz" -not -name "*.cls.tsz" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        echo "$found"
        return
    fi
    # Try .tsz
    found=$(find carts/ -name "${name}.tsz" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        echo "$found"
        return
    fi
    echo ""
}

# ── Build a cart, return 0 on success ──
build_cart() {
    local cart="$1"
    local name="$2"
    # Clean old generated files to ensure fresh build
    rm -rf "generated_${name}" "generated_${name}.zig" 2>/dev/null
    # Use --debug for speed (visual regression doesn't need optimization)
    ./scripts/build "$cart" --debug >"$TMP_DIR/build_${name}.log" 2>&1
    return $?
}

# ── Run cart with screenshot capture ──
# Returns 0 if screenshot was captured, 1 otherwise
run_screenshot() {
    local name="$1"
    local output="$2"
    local binary="zig-out/bin/${name}"

    if [ ! -x "$binary" ]; then
        echo "  binary not found: $binary" >&2
        return 1
    fi

    # Delete saved window geometry so app opens at default 1280x800
    rm -f "/tmp/tsz-geometry-${name}.dat"

    # Run with screenshot mode. App renders 60 frames then exits.
    ZIGOS_SCREENSHOT=1 \
    ZIGOS_SCREENSHOT_OUTPUT="$output" \
    timeout "$TIMEOUT_SEC" "$binary" >"$TMP_DIR/run_${name}.log" 2>&1 || true

    if [ -f "$output" ]; then
        return 0
    else
        return 1
    fi
}

# ── Compare two images, return diff percentage ──
compare_images() {
    local baseline="$1"
    local capture="$2"
    local diff_img="$3"

    # Get image dimensions — resize capture to match baseline if needed
    local base_dims cap_dims
    base_dims=$(identify -format "%wx%h" "$baseline" 2>/dev/null || echo "0x0")
    cap_dims=$(identify -format "%wx%h" "$capture" 2>/dev/null || echo "0x0")

    if [ "$base_dims" != "$cap_dims" ]; then
        # Resize capture to baseline dimensions for fair comparison
        convert "$capture" -resize "${base_dims}!" "$capture" 2>/dev/null || true
    fi

    # Use ImageMagick compare with AE (absolute error) metric
    # compare prints the metric to stderr
    local total_pixels diff_pixels pct
    total_pixels=$(identify -format "%[fx:w*h]" "$baseline" 2>/dev/null || echo "1")
    diff_pixels=$(compare -metric AE "$baseline" "$capture" "$diff_img" 2>&1 >/dev/null || true)
    diff_pixels=$(echo "$diff_pixels" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
    diff_pixels="${diff_pixels:-$total_pixels}"

    if [ -z "$diff_pixels" ] || [ "$total_pixels" = "0" ]; then
        echo "100.00"
        return
    fi

    pct=$(python3 -c "print(f'{float($diff_pixels) / float($total_pixels) * 100:.2f}')" 2>/dev/null || echo "100.00")
    echo "$pct"
}

# ── Classify result ──
classify() {
    local pct="$1"
    local int_pct
    int_pct=$(python3 -c "print(int(float('$pct')))" 2>/dev/null || echo "100")
    if [ "$int_pct" -lt 1 ]; then
        echo "PASS"
    elif [ "$int_pct" -lt 5 ]; then
        echo "DRIFT"
    else
        echo "FAIL"
    fi
}

# ── Main loop ──
echo "=== Visual Regression Testing ==="
echo ""

# Collect results for summary
declare -a RESULT_NAMES=()
declare -a RESULT_STATUS=()
declare -a RESULT_DIFF=()

pass_count=0
drift_count=0
fail_count=0
build_fail_count=0
skip_count=0
total=0

for screenshot in "$SCREENSHOTS_DIR"/*.png; do
    [ -f "$screenshot" ] || continue

    ss_name=$(basename "$screenshot" .png)

    # Apply filters if any
    if [ ${#FILTERS[@]} -gt 0 ]; then
        matched=0
        for f in "${FILTERS[@]}"; do
            if [[ "$ss_name" == *"$f"* ]]; then
                matched=1
                break
            fi
        done
        [ "$matched" -eq 0 ] && continue
    fi

    total=$((total + 1))

    # Find the cart
    cart=$(find_cart "$ss_name")
    if [ -z "$cart" ]; then
        echo "[$ss_name] SKIP — no matching .tsz found"
        RESULT_NAMES+=("$ss_name")
        RESULT_STATUS+=("SKIP")
        RESULT_DIFF+=("-")
        skip_count=$((skip_count + 1))
        continue
    fi

    echo -n "[$ss_name] building... "

    # Build
    if ! build_cart "$cart" "$ss_name"; then
        echo "BUILD_FAIL"
        RESULT_NAMES+=("$ss_name")
        RESULT_STATUS+=("BUILD_FAIL")
        RESULT_DIFF+=("-")
        build_fail_count=$((build_fail_count + 1))
        continue
    fi

    if [ "$UPDATE_MODE" -eq 1 ]; then
        # Update mode: capture new baseline
        echo -n "capturing baseline... "
        if run_screenshot "$ss_name" "$SCREENSHOTS_DIR/${ss_name}.png"; then
            echo "UPDATED"
            RESULT_NAMES+=("$ss_name")
            RESULT_STATUS+=("UPDATED")
            RESULT_DIFF+=("-")
        else
            echo "CAPTURE_FAIL"
            RESULT_NAMES+=("$ss_name")
            RESULT_STATUS+=("CAPTURE_FAIL")
            RESULT_DIFF+=("-")
        fi
    else
        # Compare mode: capture and diff
        echo -n "running... "
        capture_path="$TMP_DIR/${ss_name}_capture.png"
        diff_path="$TMP_DIR/${ss_name}_diff.png"

        if ! run_screenshot "$ss_name" "$capture_path"; then
            echo "RUN_FAIL"
            RESULT_NAMES+=("$ss_name")
            RESULT_STATUS+=("RUN_FAIL")
            RESULT_DIFF+=("-")
            fail_count=$((fail_count + 1))
            continue
        fi

        echo -n "comparing... "
        diff_pct=$(compare_images "$screenshot" "$capture_path" "$diff_path")
        status=$(classify "$diff_pct")

        echo "$status ($diff_pct%)"
        RESULT_NAMES+=("$ss_name")
        RESULT_STATUS+=("$status")
        RESULT_DIFF+=("$diff_pct%")

        case "$status" in
            PASS) pass_count=$((pass_count + 1)) ;;
            DRIFT) drift_count=$((drift_count + 1)) ;;
            FAIL) fail_count=$((fail_count + 1)) ;;
        esac
    fi

    # Clean up binary to save space
    rm -f "zig-out/bin/${ss_name}"
done

# ── Summary ──
echo ""
echo "=== Summary ==="
echo ""
printf "%-45s %-12s %s\n" "Cart" "Status" "Diff"
printf "%-45s %-12s %s\n" "----" "------" "----"
for i in "${!RESULT_NAMES[@]}"; do
    printf "%-45s %-12s %s\n" "${RESULT_NAMES[$i]}" "${RESULT_STATUS[$i]}" "${RESULT_DIFF[$i]}"
done
echo ""
echo "Total: $total | Pass: $pass_count | Drift: $drift_count | Fail: $fail_count | Build fail: $build_fail_count | Skip: $skip_count"

# Exit code: 0 if no FAILs, 1 otherwise
if [ "$fail_count" -gt 0 ] || [ "$build_fail_count" -gt 0 ]; then
    exit 1
fi
exit 0
