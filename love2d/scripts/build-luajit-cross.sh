#!/usr/bin/env bash
# Cross-compile LuaJIT for any target using zig cc as the toolchain.
# No cross-compiler install required. Zig provides: cc, ar, objcopy.
#
# LuaJIT has a two-stage build:
#   Stage 1 (HOST): Build minilua + buildvm — must run on the build machine.
#   Stage 2 (TARGET): Use buildvm output to compile LuaJIT for the target.
#
# Usage:
#   scripts/build-luajit-cross.sh <zig-triple>     # cross-compile
#   scripts/build-luajit-cross.sh native            # native build (no zig cc)
#   scripts/build-luajit-cross.sh --clean <triple>  # wipe build dir and rebuild
#
# Supported triples:
#   x86_64-linux-gnu      → luajit (static binary)
#   aarch64-linux-gnu     → luajit (static binary)
#   x86_64-windows-gnu    → luajit.exe + lua51.dll
#   x86_64-macos          → luajit (static binary)
#   aarch64-macos         → luajit (static binary)
#
# Output: zig-out/luajit/<triple>/
#
# LuaJIT source is cloned to third_party/luajit/ (gitignored) on first run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LUAJIT_SRC="$REPO_ROOT/third_party/luajit"
LUAJIT_TAG="v2.1"

J=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# ── Argument parsing ─────────────────────────────────────────────────────────

CLEAN=0
if [[ "${1:-}" == "--clean" ]]; then
    CLEAN=1
    shift
fi

ZIG_TRIPLE="${1:?Usage: $0 [--clean] <zig-triple|native>}"

# ── Map zig triple to LuaJIT TARGET_SYS ──────────────────────────────────────

if [[ "$ZIG_TRIPLE" == "native" ]]; then
    TARGET_SYS="$(uname -s)"
    USE_ZIG=0
else
    USE_ZIG=1
    case "$ZIG_TRIPLE" in
        *-linux-*)   TARGET_SYS=Linux ;;
        *-windows-*) TARGET_SYS=Windows ;;
        *-macos*)    TARGET_SYS=Darwin ;;
        *) echo "Error: unsupported target: $ZIG_TRIPLE"; exit 1 ;;
    esac
fi

BUILD_DIR="/tmp/rjit-luajit-build/$ZIG_TRIPLE"
OUT_DIR="$REPO_ROOT/zig-out/luajit/$ZIG_TRIPLE"

if [[ "$CLEAN" == 1 ]]; then
    echo "=== Cleaning build dir: $BUILD_DIR ==="
    rm -rf "$BUILD_DIR"
fi

# ── Clone LuaJIT source ─────────────────────────────────────────────────────

if [ ! -d "$LUAJIT_SRC/.git" ]; then
    echo "=== Cloning LuaJIT ($LUAJIT_TAG) ==="
    git clone --depth=1 --branch "$LUAJIT_TAG" \
        https://github.com/LuaJIT/LuaJIT.git "$LUAJIT_SRC"
fi

# ── Copy source to build dir (LuaJIT builds in-source) ──────────────────────
# Each target gets its own copy so multiple targets can build without conflicts.

mkdir -p "$BUILD_DIR"
if [ ! -f "$BUILD_DIR/src/Makefile" ]; then
    echo "=== Copying LuaJIT source to $BUILD_DIR ==="
    cp -a "$LUAJIT_SRC/." "$BUILD_DIR/"
fi

# Always clean before building to avoid stale objects from a different target
cd "$BUILD_DIR/src"
make clean 2>/dev/null || true

# ── Toolchain wrappers ──────────────────────────────────────────────────────

if [[ "$USE_ZIG" == 1 ]]; then
    WRAP_DIR="$BUILD_DIR/toolchain"
    mkdir -p "$WRAP_DIR"

    # zig cc wrapper — passes target flag, strips unsupported GNU ld flags
    cat > "$WRAP_DIR/zig-cc" <<'WRAPEOF'
#!/bin/bash
args=()
for arg in "$@"; do
    case "$arg" in
        "-Wl,--pic-executable"*) ;;  # GNU ld only, not supported by zig/lld
        *) args+=("$arg") ;;
    esac
done
exec zig cc -target TARGET "${args[@]}"
WRAPEOF
    # macOS sed requires -i '' (empty backup ext); GNU sed uses -i without arg
    if [[ "$(uname -s)" == "Darwin" ]]; then
        sed -i '' "s/TARGET/$ZIG_TRIPLE/" "$WRAP_DIR/zig-cc"
    else
        sed -i "s/TARGET/$ZIG_TRIPLE/" "$WRAP_DIR/zig-cc"
    fi

    cat > "$WRAP_DIR/zig-ar" <<'EOF'
#!/bin/sh
exec zig ar "$@"
EOF

    cat > "$WRAP_DIR/zig-ranlib" <<'EOF'
#!/bin/sh
exec zig ranlib "$@"
EOF

    # zig strip — wraps zig objcopy for in-place stripping.
    # LuaJIT's Makefile calls: $(TARGET_STRIP) <file>
    # On Windows it also appends --strip-unneeded (GNU strip flag, not valid for zig).
    # zig objcopy requires explicit output and only handles ELF, not PE/DLL.
    # For PE targets, stripping is skipped (graceful no-op).
    cat > "$WRAP_DIR/zig-strip" <<'EOF'
#!/bin/bash
# Filter out GNU strip flags that zig objcopy doesn't understand
files=()
for arg in "$@"; do
    case "$arg" in
        --strip-unneeded|-x) ;;  # GNU strip flags — zig objcopy uses --strip-all
        -*) ;;                   # skip other flags
        *) files+=("$arg") ;;
    esac
done
for f in "${files[@]}"; do
    tmp="${f}.strip.tmp"
    # zig objcopy only handles ELF; silently skip PE/Mach-O files
    if zig objcopy --strip-all "$f" "$tmp" 2>/dev/null; then
        mv "$tmp" "$f"
    else
        rm -f "$tmp"
    fi
done
EOF

    chmod +x "$WRAP_DIR/zig-cc" "$WRAP_DIR/zig-ar" "$WRAP_DIR/zig-ranlib" "$WRAP_DIR/zig-strip"

    # Override all target toolchain variables.
    # HOST_CC stays as native 'cc' — minilua and buildvm must run on the host.
    # CC is NOT set (it would override HOST_CC default). Instead we override
    # STATIC_CC, DYNAMIC_CC, TARGET_LD, TARGET_AR, TARGET_STRIP directly.
    MAKE_CROSS_ARGS=(
        "HOST_CC=cc"
        "STATIC_CC=$WRAP_DIR/zig-cc"
        "DYNAMIC_CC=$WRAP_DIR/zig-cc -fPIC"
        "TARGET_LD=$WRAP_DIR/zig-cc"
        "TARGET_AR=$WRAP_DIR/zig-ar rcus"
        "TARGET_STRIP=$WRAP_DIR/zig-strip"
        "TARGET_SYS=$TARGET_SYS"
        "CROSS="
    )

    # Override TARGET_XCFLAGS to pre-set LUAJIT_UNWIND_EXTERNAL (required on x64)
    # and skip the Makefile's eh_frame probe (line 341) which pipes code through
    # stdin. Also link -lunwind — zig bundles LLVM's libunwind which provides
    # __register_frame, _Unwind_RaiseException, etc. that GCC normally supplies
    # via libgcc_s.
    if [[ "$TARGET_SYS" != "Windows" ]]; then
        MAKE_CROSS_ARGS+=("TARGET_XCFLAGS=-D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE -U_FORTIFY_SOURCE -fno-stack-protector -DLUAJIT_UNWIND_EXTERNAL")
        MAKE_CROSS_ARGS+=("TARGET_LIBS=-lunwind")
    fi

    # macOS requires MACOSX_DEPLOYMENT_TARGET
    if [[ "$TARGET_SYS" == "Darwin" ]]; then
        export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-11.0}"
    fi
else
    MAKE_CROSS_ARGS=()
    # Native macOS builds also require MACOSX_DEPLOYMENT_TARGET
    if [[ "$(uname -s)" == "Darwin" ]]; then
        export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-11.0}"
    fi
fi

# ── Build ────────────────────────────────────────────────────────────────────

echo "=== Building LuaJIT for $ZIG_TRIPLE (TARGET_SYS=$TARGET_SYS) ==="
echo "    Build dir: $BUILD_DIR/src"
echo "    Output:    $OUT_DIR"
echo ""

cd "$BUILD_DIR/src"
make -j"$J" "${MAKE_CROSS_ARGS[@]}" Q=

# ── Collect output ───────────────────────────────────────────────────────────

mkdir -p "$OUT_DIR"

if [[ "$TARGET_SYS" == "Windows" ]]; then
    # Windows produces luajit.exe + lua51.dll (dynamic mode forced by Makefile)
    cp "$BUILD_DIR/src/luajit.exe" "$OUT_DIR/"
    cp "$BUILD_DIR/src/lua51.dll" "$OUT_DIR/"
    echo ""
    echo "=== Done: $OUT_DIR/luajit.exe + lua51.dll ==="
    echo "  luajit.exe: $(du -h "$OUT_DIR/luajit.exe" | cut -f1)"
    echo "  lua51.dll:  $(du -h "$OUT_DIR/lua51.dll" | cut -f1)"
elif [[ "$TARGET_SYS" == "Darwin" ]]; then
    cp "$BUILD_DIR/src/luajit" "$OUT_DIR/"
    echo ""
    echo "=== Done: $OUT_DIR/luajit ==="
    echo "  Size: $(du -h "$OUT_DIR/luajit" | cut -f1)"
else
    # Linux — copy binary
    cp "$BUILD_DIR/src/luajit" "$OUT_DIR/"
    echo ""
    echo "=== Done: $OUT_DIR/luajit ==="
    echo "  Size: $(du -h "$OUT_DIR/luajit" | cut -f1)"
fi

# Also copy jit/ library (required for LuaJIT bytecode operations)
if [ -d "$BUILD_DIR/src/jit" ]; then
    cp -r "$BUILD_DIR/src/jit" "$OUT_DIR/"
fi

echo "  Target: $(file "$OUT_DIR/luajit"* | head -1)"
