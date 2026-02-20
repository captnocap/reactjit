#!/usr/bin/env bash
# CartridgeOS build.sh — surgical rootfs, no bloat
#
# Alpine is a parts bin, not a rootfs. We install packages into a temp tree,
# then cherry-pick only the exact binaries, .so files, kernel modules, and
# font we need. Nothing else goes into the initramfs.
#
# LLVM (154M) is replaced with a stub .so — virgl sends shaders to the host,
# it never invokes LLVM at runtime.
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, curl, python3
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
PARTS="$DIST_DIR/parts"
CACHE_DIR="$DIST_DIR/cache"

ALPINE_VERSION="v3.21"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo ""
echo "  CartridgeOS build (surgical rootfs)"
echo "  repo: $REPO_ROOT"
echo ""

mkdir -p "$DIST_DIR" "$STAGING" "$PARTS" "$CACHE_DIR"

# ── Step 1: Compile init + ft_helper via zig build ───────────────────────
echo "  [1/7] Compiling native artifacts (zig build)..."
(cd "$REPO_ROOT" && zig build cartridge ft-helper \
    -Dtarget=x86_64-linux-musl \
    -Doptimize=ReleaseFast 2>&1)
cp "$REPO_ROOT/zig-out/cartridge/init" "$DIST_DIR/init"
chmod +x "$DIST_DIR/init"
echo "        init:      $(du -sh "$DIST_DIR/init" | cut -f1)"
echo "        ft_helper: $(du -sh "$REPO_ROOT/zig-out/lib/libft_helper.so" | cut -f1)"
echo ""

# ── Step 2: Download apk.static (cached) ────────────────────────────────
APK_STATIC="$CACHE_DIR/apk.static"
if [ ! -x "$APK_STATIC" ]; then
    echo "  [2/7] Downloading apk-tools-static..."
    APK_INDEX=$(curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/" \
        | grep -o "apk-tools-static-[^\"]*\.apk" | head -1)
    curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/$APK_INDEX" \
        -o "$CACHE_DIR/apk-tools-static.apk"
    (cd "$CACHE_DIR" && tar xzf apk-tools-static.apk sbin/apk.static 2>/dev/null \
        && mv sbin/apk.static . && rmdir sbin)
    chmod +x "$APK_STATIC"
    echo "        apk.static: $($APK_STATIC --version)"
else
    echo "  [2/7] apk.static cached"
fi
echo ""

# ── Step 3: Install Alpine packages into parts bin ───────────────────────
# This is a throwaway tree — we'll cherry-pick from it, not ship it.
echo "  [3/7] Installing Alpine packages into parts bin..."
rm -rf "$PARTS"
mkdir -p "$PARTS"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/community" \
    -U --allow-untrusted \
    --root "$PARTS" \
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
    mesa-gles \
    libdrm \
    libstdc++ \
    libgcc \
    eudev-libs \
    font-liberation \
    linux-virt \
    2>&1 | grep -E "^(\(|OK:)" || true

PARTS_SIZE=$(du -sm "$PARTS" | cut -f1)
echo "        parts bin: ${PARTS_SIZE}M (throwaway)"
echo ""

# ── Step 4: Extract kernel + modules ────────────────────────────────────
echo "  [4/7] Extracting kernel..."
cp "$PARTS/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# ── Step 5: Build surgical staging tree ──────────────────────────────────
# Every file is explicitly listed. If it's not here, it's not in the image.
echo "  [5/7] Building surgical staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app}
mkdir -p "$STAGING"/{bin,lib,usr/bin,usr/lib/dri}

# ── Binaries ──
cp "$PARTS/bin/busybox"   "$STAGING/bin/busybox"
cp "$PARTS/usr/bin/luajit" "$STAGING/usr/bin/luajit"
chmod +x "$STAGING/bin/busybox" "$STAGING/usr/bin/luajit"

# ── musl libc (the dynamic linker itself) ──
MUSL=$(find "$PARTS/lib" -name 'ld-musl-x86_64.so*' -type f | head -1)
cp "$MUSL" "$STAGING/lib/ld-musl-x86_64.so.1"
# musl is both the linker and libc — create the expected symlink
ln -sf /lib/ld-musl-x86_64.so.1 "$STAGING/lib/libc.musl-x86_64.so.1"

# ── Trace .so dependency chain from our binaries ──
# Instead of guessing, we walk DT_NEEDED recursively from luajit + SDL2 + EGL + GL.
# This picks up exactly what the dynamic linker would need.
echo "        tracing .so dependencies..."

copy_lib() {
    local name="$1"
    # Skip LLVM — we'll stub it
    if [[ "$name" == *"LLVM"* ]] || [[ "$name" == *"llvm"* ]]; then
        return 0
    fi
    # Skip musl — already copied
    if [[ "$name" == *"musl"* ]]; then
        return 0
    fi
    # Already copied?
    if [ -f "$STAGING/usr/lib/$name" ]; then
        return 0
    fi
    # Find it in parts bin (follow symlinks — Alpine uses soname symlinks)
    local src
    src=$(find "$PARTS/usr/lib" "$PARTS/lib" -name "$name" \( -type f -o -type l \) 2>/dev/null | head -1)
    # If it's a symlink, resolve to the real file
    [ -n "$src" ] && [ -L "$src" ] && src=$(readlink -f "$src")
    if [ -z "$src" ] || [ ! -f "$src" ]; then
        # Try soname glob (e.g. libdrm.so.2 → libdrm.so.2.4.0)
        local base="${name%.so*}"
        local soversion="${name#*.so}"
        src=$(find "$PARTS/usr/lib" "$PARTS/lib" -name "${base}.so${soversion}*" -type f 2>/dev/null | head -1)
    fi
    if [ -z "$src" ]; then
        echo "        WARNING: $name not found in parts bin"
        return 0
    fi
    cp "$src" "$STAGING/usr/lib/$name"
}

# Recursive dependency tracer
trace_deps() {
    local path="$1"
    local deps
    deps=$(readelf -d "$path" 2>/dev/null | grep 'NEEDED' | sed 's/.*\[\(.*\)\]/\1/' || true)
    for dep in $deps; do
        # Skip LLVM and musl
        if [[ "$dep" == *"LLVM"* ]] || [[ "$dep" == *"llvm"* ]] || [[ "$dep" == *"musl"* ]]; then
            continue
        fi
        if [ -f "$STAGING/usr/lib/$dep" ]; then
            continue
        fi
        copy_lib "$dep"
        # Recurse into the newly copied lib
        if [ -f "$STAGING/usr/lib/$dep" ]; then
            trace_deps "$STAGING/usr/lib/$dep"
        fi
    done
}

# Seed libraries — SDL2 dlopen's these at runtime, so they won't appear
# in DT_NEEDED. We must explicitly include them + trace their deps.
SEED_LIBS=(
    # SDL2
    "$(find "$PARTS/usr/lib" -name 'libSDL2-2.0.so.*' -type f | head -1)"
    # Mesa GL/EGL/GBM/GLES stack (dlopen'd by SDL2 KMSDRM backend)
    "$(find "$PARTS/usr/lib" -name 'libEGL.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libGL.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libGLESv2.so.2*' \( -type f -o -type l \) | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libgbm.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libgallium-*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libglapi.so.0*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libdrm.so.2*' -type f | head -1)"
    # libudev — SDL2 KMSDRM dlopen's this to enumerate DRM devices
    "$(find "$PARTS/usr/lib" "$PARTS/lib" -name 'libudev.so.*' \( -type f -o -type l \) 2>/dev/null | head -1)"
)

for seed in "${SEED_LIBS[@]}"; do
    [ -z "$seed" ] && continue
    name=$(basename "$seed")
    cp "$seed" "$STAGING/usr/lib/$name"
    trace_deps "$STAGING/usr/lib/$name"
done

# Also trace deps from luajit binary itself
trace_deps "$STAGING/usr/bin/luajit"

# ── DRI driver (only virtio_gpu) ──
# All DRI drivers are symlinks to libdril_dri.so — copy the real binary
# and create only the virtio symlink.
DRI_SRC="$PARTS/usr/lib/xorg/modules/dri"
DRIL=$(find "$DRI_SRC" -name 'libdril_dri.so' -type f 2>/dev/null | head -1)
if [ -n "$DRIL" ]; then
    cp "$DRIL" "$STAGING/usr/lib/dri/libdril_dri.so"
    ln -sf libdril_dri.so "$STAGING/usr/lib/dri/virtio_gpu_dri.so"
    trace_deps "$STAGING/usr/lib/dri/libdril_dri.so"
fi

# ── LLVM stub ──
# libgallium has DT_NEEDED: libLLVM.so.19.1 and 284 undefined LLVM symbols.
# Virgl never calls them — shaders go to the host GPU as TGSI/NIR.
# We generate a stub .so that exports every symbol with the correct version tag
# so the dynamic linker is fully satisfied. 154MB → ~72KB.
echo "        creating LLVM stub (versioned symbols)..."
LLVM_SONAME=$(readelf -d "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
    | grep 'NEEDED.*LLVM' | sed 's/.*\[\(.*\)\]/\1/' | head -1)
LLVM_VERSION=$(echo "$LLVM_SONAME" | sed 's/libLLVM.so.//')
if [ -n "$LLVM_SONAME" ]; then
    STUB_C=$(mktemp /tmp/llvm_stub_XXXXXX.c)
    STUB_MAP=$(mktemp /tmp/llvm_stub_XXXXXX.map)

    # Extract all LLVM symbols libgallium needs (strip @version suffix)
    nm -D "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
        | grep " U.*LLVM" | awk '{print $2}' | sed 's/@.*//' | sort -u > /tmp/llvm_syms.txt

    # Generate C stub — each symbol is a function returning NULL
    {
        echo "/* Auto-generated LLVM stub — virgl never calls these */"
        while IFS= read -r sym; do
            echo "void *${sym}(void) { return (void*)0; }"
        done < /tmp/llvm_syms.txt
    } > "$STUB_C"

    # Generate version script so symbols get the LLVM_XX.X tag
    {
        echo "LLVM_${LLVM_VERSION} {"
        echo "  global:"
        while IFS= read -r sym; do
            echo "    ${sym};"
        done < /tmp/llvm_syms.txt
        echo "  local: *;"
        echo "};"
    } > "$STUB_MAP"

    SYM_COUNT=$(wc -l < /tmp/llvm_syms.txt)
    zig cc -shared -target x86_64-linux-musl \
        -Wl,-soname,"$LLVM_SONAME" \
        -Wl,--version-script,"$STUB_MAP" \
        -o "$STAGING/usr/lib/$LLVM_SONAME" "$STUB_C" 2>/dev/null

    rm -f "$STUB_C" "$STUB_MAP" /tmp/llvm_syms.txt
    echo "        $LLVM_SONAME: $(du -sh "$STAGING/usr/lib/$LLVM_SONAME" | cut -f1) (stub, $SYM_COUNT symbols)"
else
    echo "        WARNING: could not determine LLVM soname"
fi

# ── Kernel modules: virtio-gpu + deps + input (psmouse, evdev) ──
# virtio-gpu.ko depends on: drm, drm_kms_helper, drm_shmem_helper, drm_panel_orientation_quirks,
# i2c-core, fb, fb_sys_fops, syscopyarea, sysfillrect, sysimgblt, virtio_dma_buf
# Input: psmouse (PS/2 mouse), evdev (/dev/input/eventN), mousedev (/dev/input/mice)
KVER=$(ls "$PARTS/lib/modules/" 2>/dev/null | head -1)
if [ -n "$KVER" ]; then
    SRCMOD="$PARTS/lib/modules/$KVER"
    MODDIR="$STAGING/lib/modules/$KVER"
    mkdir -p "$MODDIR"

    # Parse modules.dep for virtio-gpu's full dependency tree
    VIRTIO_LINE=$(grep "virtio-gpu.ko" "$SRCMOD/modules.dep" 2>/dev/null || true)
    if [ -n "$VIRTIO_LINE" ]; then
        # modules.dep format: "module: dep1 dep2 dep3"
        ALL_MODS=$(echo "$VIRTIO_LINE" | sed 's/:.*//')  # virtio-gpu itself
        DEPS=$(echo "$VIRTIO_LINE" | sed 's/[^:]*://')    # its deps
        ALL_MODS="$ALL_MODS $DEPS"

        for mod in $ALL_MODS; do
            mod=$(echo "$mod" | xargs)  # trim whitespace
            [ -z "$mod" ] && continue
            src="$SRCMOD/$mod"
            if [ -f "$src" ]; then
                mkdir -p "$MODDIR/$(dirname "$mod")"
                cp "$src" "$MODDIR/$mod"
            fi
        done
        echo "        kernel modules: $(echo $ALL_MODS | wc -w) files"
    fi

    # Input + USB + HID modules (not in virtio-gpu's dep chain, needed for input)
    INPUT_MODS=(
        # evdev (userspace input device nodes)
        "kernel/drivers/input/evdev.ko.gz"
        "kernel/drivers/input/mousedev.ko.gz"
        # PS/2 fallback
        "kernel/drivers/input/mouse/psmouse.ko.gz"
        # USB host controllers
        "kernel/drivers/usb/common/usb-common.ko.gz"
        "kernel/drivers/usb/core/usbcore.ko.gz"
        "kernel/drivers/usb/host/xhci-hcd.ko.gz"
        "kernel/drivers/usb/host/xhci-pci.ko.gz"
        "kernel/drivers/usb/host/ehci-hcd.ko.gz"
        "kernel/drivers/usb/host/ehci-pci.ko.gz"
        "kernel/drivers/usb/host/ohci-hcd.ko.gz"
        "kernel/drivers/usb/host/ohci-pci.ko.gz"
        "kernel/drivers/usb/host/uhci-hcd.ko.gz"
        # HID (USB keyboard/mouse class drivers)
        "kernel/drivers/hid/hid.ko.gz"
        "kernel/drivers/hid/hid-generic.ko.gz"
        "kernel/drivers/hid/usbhid/usbhid.ko.gz"
        "kernel/drivers/hid/usbhid/usbkbd.ko.gz"
        "kernel/drivers/hid/usbhid/usbmouse.ko.gz"
        # virtio-input (VMs)
        "kernel/drivers/virtio/virtio_input.ko.gz"
    )
    for mod in "${INPUT_MODS[@]}"; do
        if [ -f "$SRCMOD/$mod" ]; then
            mkdir -p "$MODDIR/$(dirname "$mod")"
            cp "$SRCMOD/$mod" "$MODDIR/$mod"
        fi
    done

    # Copy module metadata (modprobe needs these)
    for f in modules.dep modules.alias modules.dep.bin modules.alias.bin \
             modules.builtin modules.builtin.bin modules.builtin.modinfo \
             modules.order modules.symbols modules.symbols.bin; do
        cp "$SRCMOD/$f" "$MODDIR/" 2>/dev/null || true
    done
fi

# ── Font (one file) ──
mkdir -p "$STAGING/usr/share/fonts"
cp "$PARTS/usr/share/fonts/liberation/LiberationSans-Regular.ttf" \
   "$STAGING/usr/share/fonts/" 2>/dev/null || true

# ── /init (zig-built static PID 1) ──
cp "$DIST_DIR/init" "$STAGING/init"

# ── App files ──
cp "$REPO_ROOT/zig-out/lib/libft_helper.so" "$STAGING/app/ft_helper.so"
cp "$SCRIPT_DIR/app/sandbox.lua"    "$STAGING/app/"
cp "$SCRIPT_DIR/app/main.lua"       "$STAGING/app/"
cp "$SCRIPT_DIR/app/gl.lua"         "$STAGING/app/"
cp "$SCRIPT_DIR/app/font.lua"       "$STAGING/app/"
cp "$SCRIPT_DIR/app/console.lua"    "$STAGING/app/"
cp "$SCRIPT_DIR/app/commands.lua"   "$STAGING/app/"
cp "$SCRIPT_DIR/app/eventbus.lua"   "$STAGING/app/"
cp "$SCRIPT_DIR/app/bootscreen.lua" "$STAGING/app/"
cp "$SCRIPT_DIR/app/json.lua"       "$STAGING/app/"
cp "$SCRIPT_DIR/app/manifest.json"  "$STAGING/app/"
cp "$SCRIPT_DIR/app/probe.lua"      "$STAGING/app/" 2>/dev/null || true
cp "$SCRIPT_DIR/app/gbm_format_shim.so" "$STAGING/app/" 2>/dev/null || true

# ── Pack .cart (if signing key exists) ──
# The signed .cart goes to /boot/app.cart in the initrd.
# init.c will verify and extract it to /app/ on boot.
if [ -f "$SCRIPT_DIR/dev-key.secret" ]; then
    echo "        packing signed .cart..."
    mkdir -p "$STAGING/boot"
    python3 "$SCRIPT_DIR/cartridge-pack.py" \
        --manifest "$SCRIPT_DIR/app/manifest.json" \
        --payload "$STAGING/app/" \
        --key "$SCRIPT_DIR/dev-key.secret" \
        --out "$STAGING/boot/app.cart" 2>&1 | sed 's/^/        /'
else
    echo "        no signing key (dev-key.secret) — skipping .cart packing"
    echo "        (boot with cart_dev=1 for unsigned mode)"
fi

# ── Binary-patch SDL2: ARGB8888 → XRGB8888 ──
# SDL2's KMSDRM backend hardcodes GBM_FORMAT_ARGB8888 (fourcc 'AR24') for scanout
# surfaces. virtio-gpu only supports XRGB8888 for drmModeSetCrtc/drmModePageFlip.
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

# ── Create soname symlinks ──
# The dynamic linker resolves libraries by SONAME. We copied versioned files
# (e.g. libGL.so.1.2.0) but need soname links (libGL.so.1) and base links
# (libGL.so) for both the linker and luajit's ffi.load().
echo "        creating soname symlinks..."
SYMLINK_COUNT=0
for f in "$STAGING/usr/lib/"*.so.*; do
    [ -L "$f" ] && continue
    [ -f "$f" ] || continue
    name=$(basename "$f")

    # Extract SONAME from ELF header
    soname=$(readelf -d "$f" 2>/dev/null | grep SONAME | sed 's/.*\[\(.*\)\]/\1/')
    if [ -n "$soname" ] && [ "$soname" != "$name" ] && [ ! -e "$STAGING/usr/lib/$soname" ]; then
        ln -sf "$name" "$STAGING/usr/lib/$soname"
        SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
    fi

    # Create base .so link (e.g. libdrm.so → libdrm.so.2.123.0)
    base="${name%%.so*}.so"
    if [ "$base" != "$name" ] && [ ! -e "$STAGING/usr/lib/$base" ]; then
        ln -sf "$name" "$STAGING/usr/lib/$base"
        SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
    fi
done

# SDL2 special case: luajit ffi.load("SDL2") looks for libSDL2.so
if [ ! -e "$STAGING/usr/lib/libSDL2.so" ]; then
    SDL2_FILE=$(find "$STAGING/usr/lib" -name 'libSDL2-2.0.so*' -type f | head -1)
    [ -n "$SDL2_FILE" ] && ln -sf "$(basename "$SDL2_FILE")" "$STAGING/usr/lib/libSDL2.so"
    SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
fi
echo "        created $SYMLINK_COUNT symlinks"

echo ""

# ── Report: what's in the image ──
echo "        === staging manifest ==="
echo "        BINARIES:"
echo "          $(du -sh "$STAGING/bin/busybox" | cut -f1)  /bin/busybox"
echo "          $(du -sh "$STAGING/usr/bin/luajit" | cut -f1)  /usr/bin/luajit"
echo "          $(du -sh "$STAGING/init" | cut -f1)  /init"
echo "        LIBRARIES:"
for f in "$STAGING/usr/lib/"*.so*; do
    [ -L "$f" ] && continue  # skip symlinks
    [ -f "$f" ] || continue
    printf "          %-6s  %s\n" "$(du -sh "$f" | cut -f1)" "/usr/lib/$(basename "$f")"
done
echo "        DRI:"
for f in "$STAGING/usr/lib/dri/"*; do
    [ -f "$f" ] || [ -L "$f" ] || continue
    printf "          %-6s  %s\n" "$(du -sh "$f" 2>/dev/null | cut -f1)" "/usr/lib/dri/$(basename "$f")"
done
echo "        APP:"
for f in "$STAGING/app/"*; do
    printf "          %-6s  %s\n" "$(du -sh "$f" | cut -f1)" "/app/$(basename "$f")"
done

STAGING_SIZE=$(du -sm "$STAGING" | cut -f1)
echo ""
echo "        staging total: ${STAGING_SIZE}M"
echo ""

# ── Step 6: Package initramfs ────────────────────────────────────────────
echo "  [6/7] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

# ── Step 7: Create bootable ISO ─────────────────────────────────────────
ISO_OUT="$DIST_DIR/cartridge-os.iso"
ISO_STAGE="/tmp/cartridge-iso-staging"

if ! command -v grub-mkrescue &>/dev/null; then
    echo "  [7/7] ISO: SKIPPED (grub-mkrescue not found)"
    echo "        Install: sudo apt install grub-pc-bin grub-efi-amd64-bin xorriso mtools"
    echo ""
else
    echo "  [7/7] Creating bootable ISO..."
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

# ── Cleanup: nuke the parts bin ──────────────────────────────────────────
rm -rf "$PARTS"

echo "  Done! Boot with: bash experiments/cartridge-os/run.sh"
echo ""
