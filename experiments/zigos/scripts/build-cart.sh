#!/bin/bash
# Atomic build validation — a build is only valid if the repo signature
# at build start matches the repo signature at build end.
#
# Usage:
#   bash scripts/build-cart.sh carts/conformance/d12_kanban_evil.tsz
#   bash scripts/build-cart.sh --check          # check all stamps
#   bash scripts/build-cart.sh --check d12      # check one binary
#
# A build is INVALID if:
#   - HEAD changed during the build (someone committed)
#   - Working tree became dirty during the build (someone edited)
#   - The binary was built at a different HEAD than current (stale)

set -euo pipefail
cd "$(dirname "$0")/.."

REPO_ROOT="../.."
STAMP_DIR=".build-stamps"
mkdir -p "$STAMP_DIR"

get_signature() {
    local head=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
    local dirty="clean"
    if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
        dirty="dirty"
    fi
    local compiler_mtime=$(stat -c %Y zig-out/bin/zigos-compiler 2>/dev/null || echo "0")
    echo "${head}:${dirty}:${compiler_mtime}"
}

# --check mode
if [ "${1:-}" = "--check" ]; then
    CURRENT_SIG=$(get_signature)
    CURRENT_HEAD=$(echo "$CURRENT_SIG" | cut -d: -f1)
    CURRENT_DIRTY=$(echo "$CURRENT_SIG" | cut -d: -f2)
    FILTER="${2:-}"
    STALE=0
    TOTAL=0

    for stamp in "$STAMP_DIR"/*.stamp; do
        [ -f "$stamp" ] || continue
        NAME=$(basename "$stamp" .stamp)
        [ -n "$FILTER" ] && [[ "$NAME" != *"$FILTER"* ]] && continue
        TOTAL=$((TOTAL + 1))

        BUILT_SIG=$(cat "$stamp")
        BUILT_HEAD=$(echo "$BUILT_SIG" | cut -d: -f1)
        BUILT_DIRTY=$(echo "$BUILT_SIG" | cut -d: -f2)
        BUILT_COMPILER=$(echo "$BUILT_SIG" | cut -d: -f3)
        CURRENT_COMPILER=$(echo "$CURRENT_SIG" | cut -d: -f3)

        REASONS=""
        if [ "$BUILT_HEAD" != "$CURRENT_HEAD" ]; then
            REASONS="${REASONS} HEAD:${BUILT_HEAD:0:7}→${CURRENT_HEAD:0:7}"
        fi
        if [ "$BUILT_DIRTY" = "dirty" ]; then
            REASONS="${REASONS} built-on-dirty-tree"
        fi
        if [ "$BUILT_COMPILER" != "$CURRENT_COMPILER" ]; then
            REASONS="${REASONS} compiler-changed"
        fi

        if [ -n "$REASONS" ]; then
            echo "STALE: $NAME —$REASONS"
            STALE=$((STALE + 1))
        fi
    done

    if [ $TOTAL -eq 0 ]; then
        echo "No build stamps found."
    elif [ $STALE -eq 0 ]; then
        echo "All $TOTAL binaries valid at ${CURRENT_HEAD:0:7} ($CURRENT_DIRTY)."
    else
        echo ""
        echo "$STALE/$TOTAL stale — rebuild before claiming results."
    fi
    exit 0
fi

# Build mode
CART="$1"
if [ -z "$CART" ]; then
    echo "Usage: build-cart.sh <cart.tsz> | --check [filter]"
    exit 1
fi

NAME=$(basename "$CART" .tsz)

# Capture signature BEFORE build
SIG_BEFORE=$(get_signature)
HEAD_BEFORE=$(echo "$SIG_BEFORE" | cut -d: -f1)
DIRTY_BEFORE=$(echo "$SIG_BEFORE" | cut -d: -f2)

echo "Building $NAME at ${HEAD_BEFORE:0:7} ($DIRTY_BEFORE)..."

# Unlock generated files for compiler to write
chmod u+w generated_app.zig _gen_*.zig 2>/dev/null || true

# Build
./zig-out/bin/zigos-compiler build "$CART"

# Lock generated files — nobody touches these by hand
chmod a-w generated_app.zig _gen_*.zig 2>/dev/null || true

# Capture signature AFTER build
SIG_AFTER=$(get_signature)
HEAD_AFTER=$(echo "$SIG_AFTER" | cut -d: -f1)
DIRTY_AFTER=$(echo "$SIG_AFTER" | cut -d: -f2)

# Validate
if [ "$HEAD_BEFORE" != "$HEAD_AFTER" ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo "  INVALID BUILD: repo changed during build"
    echo "  started: ${HEAD_BEFORE:0:7} → finished: ${HEAD_AFTER:0:7}"
    echo "  DO NOT trust this binary. Rebuild."
    echo "══════════════════════════════════════════════════════════"
    echo ""
    rm -f "$STAMP_DIR/$NAME.stamp"
    exit 1
fi

if [ "$DIRTY_BEFORE" != "$DIRTY_AFTER" ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo "  WARNING: working tree state changed during build"
    echo "  was: $DIRTY_BEFORE → now: $DIRTY_AFTER"
    echo "  Binary may not represent current code."
    echo "══════════════════════════════════════════════════════════"
    echo ""
fi

# Stamp
echo "$SIG_AFTER" > "$STAMP_DIR/$NAME.stamp"
echo "Valid build: $NAME at ${HEAD_AFTER:0:7} ($DIRTY_AFTER)"
