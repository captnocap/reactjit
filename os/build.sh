#!/usr/bin/env bash
# CartridgeOS build.sh — minimal kernel + busybox + QuickJS
#
# No GPU drivers, no Mesa, no LLVM, no fonts, no SDL2.
# Rendering happens in WASM. This is just the kernel + shell + JS runtime.
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, curl
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
PARTS="$DIST_DIR/parts"
CACHE_DIR="$DIST_DIR/cache"
QJS_SRC="$REPO_ROOT/love2d/quickjs"

ALPINE_VERSION="v3.21"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo ""
echo "  CartridgeOS build (kernel + busybox + QuickJS)"
echo "  No GPU. No display. Rendering is WASM's job."
echo ""

mkdir -p "$DIST_DIR" "$STAGING" "$PARTS" "$CACHE_DIR"

# ── Step 1: Compile init.zig (static musl PID 1) ──────────────────────
echo "  [1/5] Compiling init.zig..."
zig build-exe \
    "$SCRIPT_DIR/init.zig" \
    -target x86_64-linux-musl \
    -OReleaseFast \
    --name init \
    -femit-bin="$DIST_DIR/init" \
    2>&1
chmod +x "$DIST_DIR/init"
echo "        init: $(du -sh "$DIST_DIR/init" | cut -f1)"
echo ""

# ── Step 2: Build QuickJS (static musl binary) ────────────────────────
echo "  [2/5] Building QuickJS..."
QJS_SRCS=(
    "$QJS_SRC/quickjs.c"
    "$QJS_SRC/quickjs-libc.c"
    "$QJS_SRC/cutils.c"
    "$QJS_SRC/dtoa.c"
    "$QJS_SRC/libregexp.c"
    "$QJS_SRC/libunicode.c"
    "$QJS_SRC/qjs.c"
    "$QJS_SRC/gen/repl.c"
    "$QJS_SRC/gen/standalone.c"
)

zig cc -target x86_64-linux-musl -O2 -static \
    -D_GNU_SOURCE -DQUICKJS_NG_BUILD \
    -I"$QJS_SRC" \
    "${QJS_SRCS[@]}" \
    -lm \
    -o "$DIST_DIR/qjs" \
    2>&1
chmod +x "$DIST_DIR/qjs"
echo "        qjs: $(du -sh "$DIST_DIR/qjs" | cut -f1)"
echo ""

# ── Step 3: Download apk.static (cached) ──────────────────────────────
APK_STATIC="$CACHE_DIR/apk.static"
if [ ! -x "$APK_STATIC" ]; then
    echo "  [3/5] Downloading apk-tools-static..."
    APK_INDEX=$(curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/" \
        | grep -o "apk-tools-static-[^\"]*\.apk" | head -1)
    curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/$APK_INDEX" \
        -o "$CACHE_DIR/apk-tools-static.apk"
    (cd "$CACHE_DIR" && tar xzf apk-tools-static.apk sbin/apk.static 2>/dev/null \
        && mv sbin/apk.static . && rmdir sbin)
    chmod +x "$APK_STATIC"
    echo "        apk.static: $($APK_STATIC --version)"
else
    echo "  [3/5] apk.static cached"
fi
echo ""

# ── Step 4: Install minimal Alpine packages ───────────────────────────
# Only: busybox (shell + coreutils), musl (libc), kernel
echo "  [4/5] Installing minimal Alpine packages..."
rm -rf "$PARTS"
mkdir -p "$PARTS"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -U --allow-untrusted \
    --root "$PARTS" \
    --initdb \
    --arch "$ALPINE_ARCH" \
    --no-scripts \
    --no-cache \
    busybox \
    linux-virt \
    2>&1 | grep -E "^(\(|OK:)" || true

PARTS_SIZE=$(du -sm "$PARTS" | cut -f1)
echo "        parts bin: ${PARTS_SIZE}M (throwaway)"
echo ""

# ── Extract kernel ──
echo "        extracting kernel..."
cp "$PARTS/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# ── Build staging tree ──
echo "  [5/5] Building staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app,run}
mkdir -p "$STAGING"/{bin,lib,usr/bin}

# Binaries
cp "$PARTS/bin/busybox"  "$STAGING/bin/busybox"
cp "$DIST_DIR/qjs"       "$STAGING/usr/bin/qjs"
chmod +x "$STAGING/bin/busybox" "$STAGING/usr/bin/qjs"

# musl libc (busybox is static but qjs links dynamically? no — both static)
# For a fully static setup we don't need libc .so files at all.
# But include musl just in case anything needs the dynamic linker.
MUSL=$(find "$PARTS/lib" -name 'ld-musl-x86_64.so*' -type f 2>/dev/null | head -1)
if [ -n "$MUSL" ]; then
    cp "$MUSL" "$STAGING/lib/ld-musl-x86_64.so.1"
    ln -sf /lib/ld-musl-x86_64.so.1 "$STAGING/lib/libc.musl-x86_64.so.1"
fi

# /init (Zig PID 1)
cp "$DIST_DIR/init" "$STAGING/init"

# Default app
cat > "$STAGING/app/main.js" << 'MAINJS'
// CartridgeOS — QuickJS on bare Linux kernel
print('');
print('  CartridgeOS (kernel mode)');
print('  QuickJS on bare Alpine kernel');
print('  Rendering: WASM (not here)');
print('');
print('  Kernel is running.');
print('');
MAINJS

echo ""

# ── Report ──
echo "        === staging manifest ==="
echo "          $(du -sh "$STAGING/bin/busybox" | cut -f1)  /bin/busybox"
echo "          $(du -sh "$STAGING/usr/bin/qjs" | cut -f1)  /usr/bin/qjs"
echo "          $(du -sh "$STAGING/init" | cut -f1)  /init"

STAGING_SIZE=$(du -sm "$STAGING" | cut -f1)
echo ""
echo "        staging total: ${STAGING_SIZE}M"
echo ""

# ── Package initramfs ──────────────────────────────────────────────────
echo "  Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

# ── Cleanup ──
rm -rf "$PARTS"

echo "  Done!"
echo "  Boot: bash os/run.sh"
echo ""
