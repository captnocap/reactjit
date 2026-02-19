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
BEFORE_TRIM=$(du -sm "$STAGING" | cut -f1)

# Extract kernel from the installed linux-virt package
cp "$STAGING/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# Remove boot/ from staging (kernel goes to QEMU -kernel, not initramfs)
rm -rf "$STAGING/boot"

# Remove apk metadata (not needed at runtime)
rm -rf "$STAGING/etc/apk" "$STAGING/lib/apk" "$STAGING/var"

# ── Trim: remove unused GPU drivers, X11, and other bloat ────────────
# gallium-pipe/ has per-GPU pipe drivers (iris, radeonsi, nouveau, etc.)
# but NO pipe_virtio — virgl is compiled into libgallium itself.
rm -rf "$STAGING/usr/lib/gallium-pipe"

# Kernel modules: keep only virtio-gpu + its DRM dependency chain
KVER=$(ls "$STAGING/lib/modules/" | head -1)
if [ -n "$KVER" ]; then
    MODDIR="$STAGING/lib/modules/$KVER"
    # Preserve the modules we need
    mkdir -p /tmp/cartridge-mods
    cp "$MODDIR/kernel/drivers/gpu/drm/virtio/virtio-gpu.ko.gz" /tmp/cartridge-mods/ 2>/dev/null || true
    cp "$MODDIR/modules.dep" /tmp/cartridge-mods/ 2>/dev/null || true
    cp "$MODDIR/modules.alias" /tmp/cartridge-mods/ 2>/dev/null || true
    cp "$MODDIR/modules.dep.bin" /tmp/cartridge-mods/ 2>/dev/null || true
    cp "$MODDIR/modules.alias.bin" /tmp/cartridge-mods/ 2>/dev/null || true
    # Wipe and restore
    rm -rf "$MODDIR/kernel"
    mkdir -p "$MODDIR/kernel/drivers/gpu/drm/virtio"
    cp /tmp/cartridge-mods/virtio-gpu.ko.gz "$MODDIR/kernel/drivers/gpu/drm/virtio/" 2>/dev/null || true
    cp /tmp/cartridge-mods/modules.dep "$MODDIR/" 2>/dev/null || true
    cp /tmp/cartridge-mods/modules.alias "$MODDIR/" 2>/dev/null || true
    cp /tmp/cartridge-mods/modules.dep.bin "$MODDIR/" 2>/dev/null || true
    cp /tmp/cartridge-mods/modules.alias.bin "$MODDIR/" 2>/dev/null || true
    rm -rf /tmp/cartridge-mods
fi

# Fonts: keep only LiberationSans-Regular (the one font.lua actually loads)
find "$STAGING/usr/share/fonts" -type f ! -name "LiberationSans-Regular.ttf" -delete 2>/dev/null
find "$STAGING/usr/share/fonts" -type d -empty -delete 2>/dev/null

# X11 data (locale, xkb configs — not needed for kmsdrm)
rm -rf "$STAGING/usr/share/X11"

# strace (debug tool — keep binary but don't include in prod by default)
rm -f "$STAGING/usr/bin/strace"

# Other unnecessary data
rm -rf "$STAGING/usr/share/doc" "$STAGING/usr/share/man" "$STAGING/usr/share/info"
rm -rf "$STAGING/usr/share/misc" "$STAGING/usr/share/terminfo"
rm -rf "$STAGING/etc/udev" "$STAGING/usr/share/hwdata"

AFTER_TRIM=$(du -sm "$STAGING" | cut -f1)
echo "        trimmed: ${BEFORE_TRIM}M → ${AFTER_TRIM}M (saved $((BEFORE_TRIM - AFTER_TRIM))M)"

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
cp "$SCRIPT_DIR/app/gbm_format_shim.so" "$STAGING/app/" 2>/dev/null || true

# GBM's DRI loader has /usr/lib/dri hardcoded at compile time.
# Alpine installs DRI drivers under xorg/modules/dri — symlink so GBM finds them.
# Must rm first: mesa creates /usr/lib/dri/ as a real directory.
rm -rf "$STAGING/usr/lib/dri"
ln -s xorg/modules/dri "$STAGING/usr/lib/dri"

# SDL2's KMSDRM backend hardcodes GBM_FORMAT_ARGB8888 (fourcc 'AR24') for scanout
# surfaces. virtio-gpu only supports XRGB8888 for drmModeSetCrtc/drmModePageFlip.
# Binary-patch SDL2 to use XRGB8888 instead.
SDL2_LIB=$(find "$STAGING/usr/lib" -name 'libSDL2-2.0.so.*' -type f | head -1)
if [ -n "$SDL2_LIB" ]; then
  PATCHED=$(python3 -c "
import sys
with open('$SDL2_LIB', 'rb') as f: data = bytearray(f.read())
old, new = bytes([0x41,0x52,0x32,0x34]), bytes([0x58,0x52,0x32,0x34])
n = 0
i = 0
while True:
    j = data.find(old, i)
    if j == -1: break
    data[j:j+4] = new; n += 1; i = j + 4
with open('$SDL2_LIB', 'wb') as f: f.write(data)
print(n)
")
  echo "        SDL2 patched: ARGB8888→XRGB8888 ($PATCHED occurrences)"
fi

echo "        staging: $(du -sh "$STAGING" | cut -f1)"
echo ""

# ── Step 5: Package initramfs ────────────────────────────────────────────
echo "  [5/5] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

echo "  Done! Boot with: bash experiments/cartridge-os/run.sh"
echo ""

# ── Step 6: Create bootable ISO ─────────────────────────────────────────
# Wraps vmlinuz + initrd.cpio.gz in a GRUB2 hybrid ISO (boots on BIOS and
# UEFI). Requires: grub-pc-bin, grub-efi-amd64-bin, xorriso.
# Install: sudo apt install grub-pc-bin grub-efi-amd64-bin xorriso mtools

ISO_OUT="$DIST_DIR/cartridge-os.iso"
ISO_STAGE="/tmp/cartridge-iso-staging"

if ! command -v grub-mkrescue &>/dev/null; then
    echo "  [6/6] ISO: SKIPPED (grub-mkrescue not found)"
    echo "        Install: sudo apt install grub-pc-bin grub-efi-amd64-bin xorriso mtools"
    echo ""
else
    echo "  [6/6] Creating bootable ISO..."
    rm -rf   "$ISO_STAGE"
    mkdir -p "$ISO_STAGE/boot/grub"

    cp "$DIST_DIR/vmlinuz"        "$ISO_STAGE/boot/"
    cp "$DIST_DIR/initrd.cpio.gz" "$ISO_STAGE/boot/"

    cat > "$ISO_STAGE/boot/grub/grub.cfg" << 'GRUBCFG'
set timeout=3
set default=0

menuentry "CartridgeOS" {
    linux  /boot/vmlinuz rdinit=/init quiet loglevel=0
    initrd /boot/initrd.cpio.gz
}

menuentry "CartridgeOS (debug)" {
    linux  /boot/vmlinuz rdinit=/init console=ttyS0,115200 loglevel=7
    initrd /boot/initrd.cpio.gz
}
GRUBCFG

    grub-mkrescue -o "$ISO_OUT" "$ISO_STAGE" 2>/dev/null
    rm -rf "$ISO_STAGE"

    echo "        iso:  $(du -sh "$ISO_OUT" | cut -f1)  →  $ISO_OUT"
    echo "        Test: bash experiments/cartridge-os/run-iso.sh"
    echo ""
fi
