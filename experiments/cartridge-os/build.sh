#!/usr/bin/env bash
# CartridgeOS build.sh — zero Docker, zero gcc
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, curl
# Everything else is fetched or cross-compiled.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
CACHE_DIR="$DIST_DIR/cache"

ALPINE_VERSION="v3.21"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo "" && echo "  CartridgeOS build (no Docker)" && echo "  repo: $REPO_ROOT" && echo ""

mkdir -p "$DIST_DIR" "$STAGING" "$CACHE_DIR"

# ── Step 1: Compile init + ft_helper via zig build ───────────────────────
# zig cross-compiles both to x86_64-linux-musl from any host.
# init.c → static musl binary (PID 1)
# ft_helper.c + FreeType 2.13.3 (bundled) → shared musl library
echo "  [1/5] Compiling native artifacts (zig build)..."
(cd "$REPO_ROOT" && zig build cartridge ft-helper \
    -Dtarget=x86_64-linux-musl \
    -Doptimize=ReleaseFast 2>&1)
cp "$REPO_ROOT/zig-out/cartridge/init" "$DIST_DIR/init"
chmod +x "$DIST_DIR/init"
echo "        init:      $(du -sh "$DIST_DIR/init" | cut -f1)"
echo "        ft_helper: $(du -sh "$REPO_ROOT/zig-out/lib/libft_helper.so" | cut -f1)"
echo ""

# ── Step 2: Bootstrap Alpine rootfs via apk.static ──────────────────────
# Downloads apk-tools-static once (cached), then installs packages directly
# into the staging tree. No Docker, no chroot, no root required.
APK_STATIC="$CACHE_DIR/apk.static"
if [ ! -x "$APK_STATIC" ]; then
    echo "  [2/5] Downloading apk-tools-static..."
    APK_INDEX=$(curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/" \
        | grep -o "apk-tools-static-[^\"]*\.apk" | head -1)
    curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/$APK_INDEX" \
        -o "$CACHE_DIR/apk-tools-static.apk"
    (cd "$CACHE_DIR" && tar xzf apk-tools-static.apk sbin/apk.static 2>/dev/null \
        && mv sbin/apk.static . && rmdir sbin)
    chmod +x "$APK_STATIC"
    echo "        apk.static: $($APK_STATIC --version)"
else
    echo "  [2/5] apk.static cached"
fi
echo ""

echo "  [3/5] Installing Alpine packages into staging..."
rm -rf "$STAGING"
mkdir -p "$STAGING"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/community" \
    -U --allow-untrusted \
    --root "$STAGING" \
    --initdb \
    --arch "$ALPINE_ARCH" \
    --no-scripts \
    --no-cache \
    busybox \
    luajit \
    sdl2 \
    mesa-dri-gallium \
    mesa-egl \
    mesa-gbm \
    mesa-gl \
    libdrm \
    freetype \
    libstdc++ \
    libgcc \
    font-liberation \
    linux-virt \
    eudev-libs \
    strace \
    2>&1 | grep -E "^(\(|OK:)" || true
echo ""

# ── Step 4: Assemble final staging tree ──────────────────────────────────
echo "  [4/5] Assembling initramfs..."

# Extract kernel from the installed linux-virt package
cp "$STAGING/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# Remove boot/ from staging (kernel goes to QEMU -kernel, not initramfs)
rm -rf "$STAGING/boot"

# Remove apk metadata (not needed at runtime)
rm -rf "$STAGING/etc/apk" "$STAGING/lib/apk" "$STAGING/var"

# Create required mount points
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app}

# /init — zig-built static musl binary
cp "$DIST_DIR/init" "$STAGING/init"

# ft_helper.so — zig-built, musl-linked, FreeType bundled from source
cp "$REPO_ROOT/zig-out/lib/libft_helper.so" "$STAGING/app/ft_helper.so"

# App Lua files
cp "$SCRIPT_DIR/app/main.lua"   "$STAGING/app/"
cp "$SCRIPT_DIR/app/gl.lua"     "$STAGING/app/"
cp "$SCRIPT_DIR/app/font.lua"   "$STAGING/app/"
cp "$SCRIPT_DIR/app/probe.lua"  "$STAGING/app/" 2>/dev/null || true

# GBM's DRI loader has /usr/lib/dri hardcoded at compile time.
# Alpine installs DRI drivers under xorg/modules/dri — symlink so GBM finds them.
# Must rm first: mesa creates /usr/lib/dri/ as a real directory.
rm -rf "$STAGING/usr/lib/dri"
ln -s xorg/modules/dri "$STAGING/usr/lib/dri"

echo "        staging: $(du -sh "$STAGING" | cut -f1)"
echo ""

# ── Step 5: Package initramfs ────────────────────────────────────────────
echo "  [5/5] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

echo "  Done! Boot with: bash experiments/cartridge-os/run.sh"
echo ""
