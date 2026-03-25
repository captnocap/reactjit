#!/usr/bin/env bash
# CartridgeOS build.sh — x86_64 kernel + busybox + tsz app + GPU drivers
#
# Compiles a .tsz app, cross-compiles against Alpine edge sysroot (SDL3 + Mesa),
# packages into a bootable initramfs. No display server — direct KMS/DRM.
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, curl
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
PARTS="$DIST_DIR/parts"
SYSROOT="$DIST_DIR/sysroot"
CACHE_DIR="$DIST_DIR/cache"

# The .tsz app to boot (default: boot screen)
TSZ_APP="${1:-$SCRIPT_DIR/app/boot.app.tsz}"

ALPINE_VERSION="edge"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo ""
echo "  CartridgeOS build (x86_64 — tsz + SDL3 + wgpu)"
echo "  App: $TSZ_APP"
echo ""

mkdir -p "$DIST_DIR" "$STAGING" "$PARTS" "$CACHE_DIR"

# ── Step 1: Compile init.zig (static musl PID 1) ──────────────────────
echo "  [1/7] Compiling init.zig..."
zig build-exe \
    "$SCRIPT_DIR/init.zig" \
    -target x86_64-linux-musl \
    -OReleaseFast \
    --name init \
    -femit-bin="$DIST_DIR/init" \
    2>&1
chmod +x "$DIST_DIR/init"
echo "        init: $(du -sh "$DIST_DIR/init" | cut -f1)"

# Compile bridge (HTTP server)
echo "        compiling bridge..."
zig build-exe \
    "$SCRIPT_DIR/bridge.zig" \
    -target x86_64-linux-musl \
    -OReleaseFast \
    --name bridge \
    -femit-bin="$DIST_DIR/bridge" \
    2>&1
chmod +x "$DIST_DIR/bridge"
echo "        bridge: $(du -sh "$DIST_DIR/bridge" | cut -f1)"
echo ""

# ── Step 2: Compile .tsz → generated_app.zig ─────────────────────────
echo "  [2/7] Compiling .tsz app..."
cd "$REPO_ROOT"
# tsz build writes generated_app.zig then builds natively.
# We only need the generated_app.zig — the native build may fail (wrong host libs)
# but that's fine, we cross-compile in step 6.
bin/tsz build "$TSZ_APP" 2>&1 || true
if [ ! -f "$REPO_ROOT/tsz/generated_app.zig" ]; then
    echo "        ERROR: generated_app.zig not produced"
    exit 1
fi
echo "        .tsz → generated_app.zig OK"
echo ""

# ── Step 3: Download apk.static (cached) ──────────────────────────────
APK_STATIC="$CACHE_DIR/apk.static"
if [ ! -x "$APK_STATIC" ]; then
    echo "  [3/7] Downloading apk-tools-static..."
    APK_INDEX=$(curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/" \
        | grep -o "apk-tools-static-[^\"]*\.apk" | head -1)
    curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/$APK_INDEX" \
        -o "$CACHE_DIR/apk-tools-static.apk"
    (cd "$CACHE_DIR" && tar xzf apk-tools-static.apk sbin/apk.static 2>/dev/null \
        && mv sbin/apk.static . && rmdir sbin)
    chmod +x "$APK_STATIC"
    echo "        apk.static: $($APK_STATIC --version)"
else
    echo "  [3/7] apk.static cached"
fi
echo ""

# ── Step 4: Install Alpine packages (runtime + kernel) ────────────────
echo "  [4/7] Installing Alpine packages (runtime)..."
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
    linux-virt \
    musl \
    sdl3 \
    freetype \
    mesa-dri-gallium \
    mesa-egl \
    mesa-gbm \
    mesa-gl \
    libdrm \
    libxkbcommon \
    eudev-libs \
    box2d \
    sqlite-libs \
    libvterm \
    curl \
    libarchive \
    luajit \
    bullet \
    font-liberation \
    font-jetbrains-mono \
    font-inter \
    font-awesome \
    2>&1 | grep -E "^(\(|OK:)" || true

PARTS_SIZE=$(du -sm "$PARTS" | cut -f1)
echo "        runtime packages: ${PARTS_SIZE}M"
echo ""

# ── Step 5: Create sysroot with dev packages for cross-compile ────────
echo "  [5/7] Creating cross-compile sysroot..."
rm -rf "$SYSROOT"
mkdir -p "$SYSROOT"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/community" \
    -U --allow-untrusted \
    --root "$SYSROOT" \
    --initdb \
    --arch "$ALPINE_ARCH" \
    --no-scripts \
    --no-cache \
    musl-dev \
    sdl3-dev \
    freetype-dev \
    mesa-dev \
    libdrm-dev \
    box2d-dev \
    sqlite-dev \
    libvterm-dev \
    curl-dev \
    libarchive-dev \
    luajit-dev \
    bullet-dev \
    2>&1 | grep -E "^(\(|OK:)" || true

SYSROOT_SIZE=$(du -sm "$SYSROOT" | cut -f1)
echo "        sysroot: ${SYSROOT_SIZE}M"
echo ""

# ── Step 6: Cross-compile tsz app binary ──────────────────────────────
echo "  [6/7] Cross-compiling tsz app..."
APP_NAME=$(basename "$TSZ_APP" .app.tsz)
cd "$REPO_ROOT/tsz"
PKG_CONFIG_PATH="$SYSROOT/usr/lib/pkgconfig:$SYSROOT/usr/share/pkgconfig" \
PKG_CONFIG_LIBDIR="$SYSROOT/usr/lib/pkgconfig" \
PKG_CONFIG_SYSROOT_DIR="$SYSROOT" \
zig build app \
    -Dapp-name="$APP_NAME" \
    -Dtarget=x86_64-linux-musl \
    -Doptimize=ReleaseFast \
    -Dsysroot="$SYSROOT" \
    2>&1
TSZ_BIN="$REPO_ROOT/tsz/zig-out/bin/$APP_NAME"
if [ -f "$TSZ_BIN" ]; then
    chmod +x "$TSZ_BIN"
    echo "        $APP_NAME: $(du -sh "$TSZ_BIN" | cut -f1)"
else
    echo "        ERROR: binary not found at $TSZ_BIN"
    exit 1
fi
cd "$SCRIPT_DIR"
echo ""

# ── Extract kernel ──
echo "        extracting kernel..."
cp "$PARTS/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# ── Step 7: Build staging tree ─────────────────────────────────────────
echo "  [7/7] Building staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app,run}
mkdir -p "$STAGING"/{bin,sbin,lib,usr/bin,usr/lib}
mkdir -p "$STAGING"/usr/lib/dri
mkdir -p "$STAGING"/usr/share/libdrm
mkdir -p "$STAGING"/etc/udev

# Binaries
cp "$PARTS/bin/busybox"  "$STAGING/bin/busybox"
chmod +x "$STAGING/bin/busybox"

# musl dynamic linker
MUSL_LD=$(find "$PARTS/lib" -name 'ld-musl-*.so*' -type f 2>/dev/null | head -1)
if [ -n "$MUSL_LD" ]; then
    cp "$MUSL_LD" "$STAGING/lib/$(basename "$MUSL_LD")"
fi

# musl libc
MUSL_LIBC=$(find "$PARTS/lib" -name 'libc.musl-*.so*' -type f 2>/dev/null | head -1)
if [ -n "$MUSL_LIBC" ]; then
    cp -a "$MUSL_LIBC" "$STAGING/lib/$(basename "$MUSL_LIBC")"
fi

# Shared libraries: SDL3, Mesa, FreeType, libdrm, etc.
echo "        copying shared libraries..."
for pattern in \
    'libSDL3*so*' 'libfreetype*so*' 'libdrm*so*' \
    'libEGL*so*' 'libGLESv2*so*' 'libgbm*so*' 'libglapi*so*' \
    'libexpat*so*' 'libz.so*' 'libffi*so*' 'libbz2*so*' 'libpng16*so*' \
    'libbrotlidec*so*' 'libbrotlicommon*so*' \
    'libxkbcommon*so*' 'libudev*so*' \
    'libgcc_s*so*' 'libstdc++*so*' \
    'libelf*so*' \
    'libX11*so*' 'libxcb*so*' 'libXau*so*' 'libXdmcp*so*' 'libXext*so*' \
    'libXfixes*so*' 'libxshmfence*so*' 'libXxf86vm*so*' \
    'libbsd*so*' 'libmd*so*' \
    'libxml2*so*' 'liblzma*so*' 'libzstd*so*' \
    'libwayland*so*' \
    'libGL.so*' 'libGLX*so*' \
    'libgallium*so*' 'libvulkan*so*' 'libSPIRV*so*' \
    'libssl*so*' 'libcrypto*so*' \
    'libbox2d*so*' 'libsqlite3*so*' 'libvterm*so*' \
    'libcurl*so*' 'libarchive*so*' \
    'libnghttp2*so*' 'libidn2*so*' 'libunistring*so*' \
    'libpsl*so*' 'libacl*so*' 'liblz4*so*' \
    'libluajit*so*' 'libBullet*so*' 'libLinearMath*so*' \
    'libBulletCollision*so*' 'libBulletDynamics*so*'; do
    for dir in "$PARTS/usr/lib" "$PARTS/lib"; do
        for f in $dir/$pattern; do
            [ -e "$f" ] || continue
            cp -a "$f" "$STAGING/usr/lib/" 2>/dev/null || true
        done
    done
done

# Mesa DRI drivers (virtio_gpu_dri.so)
DRI_DIR=$(find "$PARTS/usr/lib" -type d -name "dri" 2>/dev/null | head -1)
if [ -n "$DRI_DIR" ] && [ -d "$DRI_DIR" ]; then
    cp -a "$DRI_DIR"/* "$STAGING/usr/lib/dri/" 2>/dev/null || true
fi

# Mesa GBM backend (Mesa 26+ uses /usr/lib/gbm/dri_gbm.so)
GBM_DIR=$(find "$PARTS/usr/lib" -type d -name "gbm" 2>/dev/null | head -1)
if [ -n "$GBM_DIR" ] && [ -d "$GBM_DIR" ]; then
    mkdir -p "$STAGING/usr/lib/gbm"
    cp -a "$GBM_DIR"/* "$STAGING/usr/lib/gbm/" 2>/dev/null || true
fi

# ── Recursive dep trace — catch every .so that's still missing ──
echo "        tracing .so dependencies..."
trace_missing() {
    local changed=1
    while [ "$changed" -eq 1 ]; do
        changed=0
        for f in "$STAGING/usr/lib/"*.so* "$STAGING/usr/lib/dri/"*.so* "$STAGING/usr/lib/gbm/"*.so*; do
            [ -f "$f" ] || continue
            [ -L "$f" ] && continue
            for dep in $(readelf -d "$f" 2>/dev/null | grep NEEDED | sed 's/.*\[\(.*\)\]/\1/'); do
                [ -f "$STAGING/usr/lib/$dep" ] && continue
                [ -f "$STAGING/lib/$dep" ] && continue
                [[ "$dep" == *musl* ]] && continue
                [[ "$dep" == *LLVM* ]] && continue
                # Find in parts
                src=$(find "$PARTS/usr/lib" "$PARTS/lib" -name "$dep" \( -type f -o -type l \) 2>/dev/null | head -1)
                [ -n "$src" ] && [ -L "$src" ] && src=$(readlink -f "$src")
                if [ -n "$src" ] && [ -f "$src" ]; then
                    cp "$src" "$STAGING/usr/lib/$dep"
                    changed=1
                fi
            done
        done
    done
}
trace_missing
TRACED=$(ls "$STAGING/usr/lib/"*.so* 2>/dev/null | wc -l)
echo "        $TRACED libraries in staging"

# ── LLVM stub ──
# libgallium needs libLLVM but virgl never calls it — shaders go to the host.
# Generate a stub .so with versioned symbols. 150MB → ~72KB.
echo "        creating LLVM stub..."
LLVM_SONAME=$(readelf -d "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
    | grep 'NEEDED.*LLVM' | sed 's/.*\[\(.*\)\]/\1/' | head -1)
LLVM_VERSION=$(echo "$LLVM_SONAME" | sed 's/libLLVM.so.//')
if [ -n "$LLVM_SONAME" ]; then
    STUB_C=$(mktemp /tmp/llvm_stub_XXXXXX.c)
    STUB_MAP=$(mktemp /tmp/llvm_stub_XXXXXX.map)

    nm -D "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
        | grep " U.*LLVM" | awk '{print $2}' | sed 's/@.*//' | sort -u > /tmp/llvm_syms.txt

    {
        echo "/* Auto-generated LLVM stub — virgl never calls these */"
        while IFS= read -r sym; do
            echo "void *${sym}(void) { return (void*)0; }"
        done < /tmp/llvm_syms.txt
    } > "$STUB_C"

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

# Kernel modules (virtio-gpu + input)
echo "        copying kernel modules..."
KMOD_DIR=$(find "$PARTS/lib/modules" -maxdepth 1 -type d -name '*-virt' 2>/dev/null | head -1)
if [ -n "$KMOD_DIR" ]; then
    mkdir -p "$STAGING/lib/modules"
    cp -a "$KMOD_DIR" "$STAGING/lib/modules/"
fi

# Fonts
echo "        copying fonts..."
mkdir -p "$STAGING/usr/share/fonts"
for dir in liberation jetbrains-mono inter fontawesome; do
    if [ -d "$PARTS/usr/share/fonts/$dir" ]; then
        cp -a "$PARTS/usr/share/fonts/$dir" "$STAGING/usr/share/fonts/"
    fi
done
# Also check TTF dirs
find "$PARTS/usr/share/fonts" -name '*.ttf' -o -name '*.otf' 2>/dev/null | while read f; do
    cp -n "$f" "$STAGING/usr/share/fonts/" 2>/dev/null || true
done
FONT_COUNT=$(find "$STAGING/usr/share/fonts" -name '*.ttf' -o -name '*.otf' 2>/dev/null | wc -l)
echo "        $FONT_COUNT font files"

# Icons
echo "        copying icons..."
if [ -d "$PARTS/usr/share/icons" ]; then
    mkdir -p "$STAGING/usr/share/icons"
    cp -a "$PARTS/usr/share/icons/"* "$STAGING/usr/share/icons/" 2>/dev/null || true
fi

# LuaJIT binary
if [ -f "$PARTS/usr/bin/luajit" ]; then
    cp "$PARTS/usr/bin/luajit" "$STAGING/usr/bin/luajit"
    chmod +x "$STAGING/usr/bin/luajit"
fi

# /init (Zig PID 1) + bridge
cp "$DIST_DIR/init" "$STAGING/init"
cp "$DIST_DIR/bridge" "$STAGING/usr/bin/bridge"
chmod +x "$STAGING/usr/bin/bridge"

# tsz app binary
cp "$TSZ_BIN" "$STAGING/app/tsz"
chmod +x "$STAGING/app/tsz"

echo ""

# ── Report ──
echo "        === staging manifest ==="
echo "          $(du -sh "$STAGING/bin/busybox" | cut -f1)  /bin/busybox"
echo "          $(du -sh "$STAGING/usr/bin/bridge" | cut -f1)  /usr/bin/bridge"
echo "          $(du -sh "$STAGING/init" | cut -f1)  /init"
echo "          $(du -sh "$STAGING/app/tsz" | cut -f1)  /app/tsz"
[ -d "$STAGING/usr/lib/dri" ] && echo "          $(du -sh "$STAGING/usr/lib/dri" | cut -f1)  /usr/lib/dri/"
[ -d "$STAGING/lib/modules" ] && echo "          $(du -sh "$STAGING/lib/modules" | cut -f1)  /lib/modules/"

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
rm -rf "$PARTS" "$SYSROOT"

echo "  Done!"
echo "  Test:    bash os/run.sh       (QEMU with virtio-gpu)"
echo ""
