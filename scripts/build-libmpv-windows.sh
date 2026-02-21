#!/usr/bin/env bash
# Cross-compile libmpv for Windows x86_64 using zig cc as the entire toolchain.
# No mingw-w64 install required. Zig provides: cc, c++, ar, ranlib, nm, dlltool, rc.
#
# Output: vendor/mpv-win64/mpv-2.dll
#
# FFmpeg is built as static libs, then statically linked into mpv-2.dll,
# so the final DLL is fully self-contained with no extra dependencies.
#
# Usage:
#   scripts/build-libmpv-windows.sh          # full build
#   scripts/build-libmpv-windows.sh --clean  # wipe build dir and rebuild

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_DIR=/tmp/ilr-mpv-build
OUT_DIR="$REPO_ROOT/vendor/mpv-win64"

TARGET="x86_64-windows-gnu"
J=$(nproc)

FFMPEG_TAG="n7.1"
FRIBIDI_TAG="v1.0.15"
LIBASS_TAG="0.17.3"
MPV_TAG="v0.36.0"

FFMPEG_SRC="$BUILD_DIR/ffmpeg"
FFMPEG_BUILD="$BUILD_DIR/ffmpeg-build"
FFMPEG_INSTALL="$BUILD_DIR/ffmpeg-install"

FRIBIDI_SRC="$BUILD_DIR/fribidi"
FRIBIDI_INSTALL="$BUILD_DIR/fribidi-install"

LIBASS_SRC="$BUILD_DIR/libass"
LIBASS_INSTALL="$BUILD_DIR/libass-install"

MPV_SRC="$BUILD_DIR/mpv"
MPV_BUILD="$BUILD_DIR/mpv-build"
MPV_INSTALL="$BUILD_DIR/mpv-install"

if [[ "${1:-}" == "--clean" ]]; then
    echo "=== Cleaning build dir ==="
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR" "$OUT_DIR"

# ── Toolchain wrappers ────────────────────────────────────────────────────────
# FFmpeg configure probes the compiler via small test programs. Wrapping zig cc
# in a script lets us pass the target flag without special quoting in makefiles.

ZIG_CC_WRAP="$BUILD_DIR/zig-cc"
ZIG_CXX_WRAP="$BUILD_DIR/zig-cxx"
ZIG_AR_WRAP="$BUILD_DIR/zig-ar"
ZIG_RANLIB_WRAP="$BUILD_DIR/zig-ranlib"
ZIG_NM_WRAP="$BUILD_DIR/zig-nm"
ZIG_DLLTOOL_WRAP="$BUILD_DIR/zig-dlltool"
ZIG_RC_WRAP="$BUILD_DIR/zig-rc"
ZIG_STRIP_WRAP="$BUILD_DIR/zig-strip"

cat > "$ZIG_CC_WRAP" <<'WRAPEOF'
#!/bin/sh
# zig/lld (PE/COFF mode) doesn't support --pic-executable (GNU ld extension).
# --dynamicbase already enables ASLR; drop --pic-executable, keep -e entry point.
args=""
for arg in "$@"; do
    case "$arg" in
        "-Wl,--pic-executable,-e,mainCRTStartup") args="$args -Wl,-e,mainCRTStartup" ;;
        "-Wl,--pic-executable")                    ;;  # drop silently
        *) args="$args $arg" ;;
    esac
done
eval exec zig cc -target TARGET $args
WRAPEOF
sed -i "s/TARGET/$TARGET/" "$ZIG_CC_WRAP"

cat > "$ZIG_CXX_WRAP" <<'WRAPEOF'
#!/bin/sh
args=""
for arg in "$@"; do
    case "$arg" in
        "-Wl,--pic-executable,-e,mainCRTStartup") args="$args -Wl,-e,mainCRTStartup" ;;
        "-Wl,--pic-executable")                    ;;
        *) args="$args $arg" ;;
    esac
done
eval exec zig c++ -target TARGET $args
WRAPEOF
sed -i "s/TARGET/$TARGET/" "$ZIG_CXX_WRAP"
cat > "$ZIG_AR_WRAP" <<EOF
#!/bin/sh
exec zig ar "\$@"
EOF
cat > "$ZIG_RANLIB_WRAP" <<EOF
#!/bin/sh
exec zig ranlib "\$@"
EOF
cat > "$ZIG_NM_WRAP" <<EOF
#!/bin/sh
exec llvm-nm "\$@"
EOF
cat > "$ZIG_DLLTOOL_WRAP" <<EOF
#!/bin/sh
exec zig dlltool "\$@"
EOF
cat > "$ZIG_RC_WRAP" <<EOF
#!/bin/sh
exec zig rc "\$@"
EOF
# zig objcopy can strip PE binaries
cat > "$ZIG_STRIP_WRAP" <<EOF
#!/bin/sh
exec zig objcopy --strip-all "\$@"
EOF
chmod +x "$ZIG_CC_WRAP" "$ZIG_CXX_WRAP" "$ZIG_AR_WRAP" "$ZIG_RANLIB_WRAP" \
         "$ZIG_NM_WRAP" "$ZIG_DLLTOOL_WRAP" "$ZIG_RC_WRAP" "$ZIG_STRIP_WRAP"

# ── FFmpeg ────────────────────────────────────────────────────────────────────
echo "=== FFmpeg: clone ==="
if [ ! -d "$FFMPEG_SRC/.git" ]; then
    git clone --depth=1 --branch "$FFMPEG_TAG" \
        https://git.ffmpeg.org/ffmpeg.git "$FFMPEG_SRC"
fi

echo "=== FFmpeg: configure ==="
mkdir -p "$FFMPEG_BUILD" "$FFMPEG_INSTALL"
cd "$FFMPEG_BUILD"

"$FFMPEG_SRC/configure" \
    --target-os=mingw32 \
    --arch=x86_64 \
    --enable-cross-compile \
    --cross-prefix="" \
    --cc="$ZIG_CC_WRAP" \
    --cxx="$ZIG_CXX_WRAP" \
    --ar="$ZIG_AR_WRAP" \
    --ranlib="$ZIG_RANLIB_WRAP" \
    --nm="$ZIG_NM_WRAP" \
    --strip="$ZIG_STRIP_WRAP" \
    --windres="$ZIG_RC_WRAP" \
    --prefix="$FFMPEG_INSTALL" \
    --disable-shared \
    --enable-static \
    --disable-programs \
    --disable-doc \
    --disable-avdevice \
    --disable-avfilter \
    --disable-network \
    --disable-debug \
    --enable-optimizations \
    --enable-small \
    --disable-everything \
    --enable-decoder=h264 \
    --enable-decoder=hevc \
    --enable-decoder=vp8 \
    --enable-decoder=vp9 \
    --enable-decoder=av1 \
    --enable-decoder=aac \
    --enable-decoder=ac3 \
    --enable-decoder=mp3 \
    --enable-decoder=opus \
    --enable-decoder=vorbis \
    --enable-decoder=flac \
    --enable-decoder=pcm_s16le \
    --enable-decoder=pcm_s24le \
    --enable-decoder=pcm_f32le \
    --enable-decoder=subrip \
    --enable-decoder=ass \
    --enable-demuxer=matroska \
    --enable-demuxer=mov \
    --enable-demuxer=mp4 \
    --enable-demuxer=avi \
    --enable-demuxer=ogg \
    --enable-demuxer=mpegts \
    --enable-demuxer=flac \
    --enable-demuxer=mp3 \
    --enable-demuxer=wav \
    --enable-protocol=file \
    --enable-protocol=pipe \
    --enable-swscale \
    --enable-swresample \
    --enable-avformat \
    --enable-avcodec

echo "=== FFmpeg: build (-j$J) ==="
make -j"$J"
make install

# ── fribidi ───────────────────────────────────────────────────────────────────
# Small C library for Unicode BiDi algorithm. Required by libass.
# Uses autotools; zig cc as the cross-compiler.
echo "=== fribidi: clone ==="
if [ ! -d "$FRIBIDI_SRC/.git" ]; then
    git clone --depth=1 --branch "$FRIBIDI_TAG" \
        https://github.com/fribidi/fribidi.git "$FRIBIDI_SRC"
fi

echo "=== fribidi: configure ==="
mkdir -p "$BUILD_DIR/fribidi-build" "$FRIBIDI_INSTALL"
cd "$FRIBIDI_SRC"
[ ! -f configure ] && autoreconf -fiv
cd "$BUILD_DIR/fribidi-build"
"$FRIBIDI_SRC/configure" \
    --host=x86_64-w64-mingw32 \
    --prefix="$FRIBIDI_INSTALL" \
    CC="$ZIG_CC_WRAP" \
    AR="$ZIG_AR_WRAP" \
    RANLIB="$ZIG_RANLIB_WRAP" \
    --disable-shared \
    --enable-static \
    --disable-docs \
    --disable-deprecated

echo "=== fribidi: build (-j$J) ==="
make -j"$J"
# `make install` may fail on the docs step if c2man is not installed.
# Fall back to manual installation of the library and headers.
if ! make install 2>/dev/null; then
    echo "=== fribidi: make install failed (likely docs/c2man), installing manually ==="
    mkdir -p "$FRIBIDI_INSTALL/lib/pkgconfig" "$FRIBIDI_INSTALL/include/fribidi"
    cp "$BUILD_DIR/fribidi-build/lib/.libs/libfribidi.a" "$FRIBIDI_INSTALL/lib/"
    cp "$FRIBIDI_SRC/lib/fribidi"*.h "$FRIBIDI_INSTALL/include/fribidi/"
    cp "$BUILD_DIR/fribidi-build/lib/fribidi-config.h" "$FRIBIDI_INSTALL/include/fribidi/"
fi

# ── libass ─────────────────────────────────────────────────────────────────────
# Subtitle rendering library. Required by mpv. Uses our cross-compiled
# FreeType (from zig build.zig) and fribidi.
echo "=== libass: clone ==="
if [ ! -d "$LIBASS_SRC/.git" ]; then
    git clone --depth=1 --branch "$LIBASS_TAG" \
        https://github.com/libass/libass.git "$LIBASS_SRC"
fi

echo "=== libass: configure ==="
mkdir -p "$BUILD_DIR/libass-build" "$LIBASS_INSTALL"
cd "$LIBASS_SRC"
[ ! -f configure ] && autoreconf -fiv

# Point pkg-config at our cross-compiled freetype + fribidi.
# We use the same FreeType that build.zig vendors (fetched via zig fetch).
FREETYPE_INSTALL="$BUILD_DIR/freetype-install"
mkdir -p "$FREETYPE_INSTALL/include/freetype2" "$FREETYPE_INSTALL/lib/pkgconfig"

# Build FreeType for Windows using zig so libass can link it.
if [ ! -f "$FREETYPE_INSTALL/lib/libfreetype.a" ]; then
    echo "=== FreeType: cross-compile for Windows ==="
    FREETYPE_VERSION="2.13.3"
    FREETYPE_URL="https://download.savannah.gnu.org/releases/freetype/freetype-${FREETYPE_VERSION}.tar.xz"
    FREETYPE_ARCHIVE="$BUILD_DIR/freetype.tar.xz"
    FREETYPE_SRC_DIR="$BUILD_DIR/freetype-src"
    [ ! -f "$FREETYPE_ARCHIVE" ] && curl -L -o "$FREETYPE_ARCHIVE" "$FREETYPE_URL"
    [ ! -d "$FREETYPE_SRC_DIR" ] && mkdir -p "$FREETYPE_SRC_DIR" && tar xf "$FREETYPE_ARCHIVE" -C "$FREETYPE_SRC_DIR" --strip-components=1
    mkdir -p "$BUILD_DIR/freetype-build"
    cd "$BUILD_DIR/freetype-build"
    "$FREETYPE_SRC_DIR/configure" \
        --host=x86_64-w64-mingw32 \
        --prefix="$FREETYPE_INSTALL" \
        CC="$ZIG_CC_WRAP" AR="$ZIG_AR_WRAP" RANLIB="$ZIG_RANLIB_WRAP" \
        --disable-shared --enable-static \
        --without-harfbuzz --without-bzip2 --without-png --without-brotli
    make -j"$J"
    make install
fi

# Fribidi pkg-config
cat > "$FRIBIDI_INSTALL/lib/pkgconfig/fribidi.pc" << 'PCEOF'
prefix=FRIBIDI_PREFIX
exec_prefix=${prefix}
libdir=${exec_prefix}/lib
includedir=${prefix}/include

Name: GNU FriBidi
Description: Unicode Bidirectional Algorithm Library
Version: 1.0.15
Libs: -L${libdir} -lfribidi
Cflags: -I${includedir}
PCEOF
sed -i "s|FRIBIDI_PREFIX|$FRIBIDI_INSTALL|g" "$FRIBIDI_INSTALL/lib/pkgconfig/fribidi.pc"

export PKG_CONFIG_LIBDIR="$FFMPEG_INSTALL/lib/pkgconfig:$FRIBIDI_INSTALL/lib/pkgconfig:$FREETYPE_INSTALL/lib/pkgconfig"
export PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"

cd "$BUILD_DIR/libass-build"
"$LIBASS_SRC/configure" \
    --host=x86_64-w64-mingw32 \
    --prefix="$LIBASS_INSTALL" \
    CC="$ZIG_CC_WRAP" \
    AR="$ZIG_AR_WRAP" \
    RANLIB="$ZIG_RANLIB_WRAP" \
    --disable-shared \
    --enable-static \
    --disable-libunibreak \
    --disable-fontconfig \
    --disable-directwrite \
    --enable-freetype \
    --enable-fribidi

echo "=== libass: build (-j$J) ==="
make -j"$J"
make install

# ── mpv cross-file for Meson ──────────────────────────────────────────────────
CROSS_FILE="$BUILD_DIR/zig-windows.ini"
cat > "$CROSS_FILE" << CROSSEOF
[binaries]
c = '$ZIG_CC_WRAP'
cpp = '$ZIG_CXX_WRAP'
ar = '$ZIG_AR_WRAP'
ranlib = '$ZIG_RANLIB_WRAP'
strip = '$ZIG_STRIP_WRAP'
windres = '$ZIG_RC_WRAP'
pkgconfig = 'pkg-config'

[host_machine]
system = 'windows'
cpu_family = 'x86_64'
cpu = 'x86_64'
endian = 'little'
CROSSEOF

# ── mpv ───────────────────────────────────────────────────────────────────────
echo "=== mpv: clone ==="
if [ ! -d "$MPV_SRC/.git" ]; then
    git clone --depth=1 --branch "$MPV_TAG" \
        https://github.com/mpv-player/mpv.git "$MPV_SRC"
fi

echo "=== mpv: configure (Meson) ==="

# Point pkg-config at all cross-compiled deps
export PKG_CONFIG_LIBDIR="$FFMPEG_INSTALL/lib/pkgconfig:$FRIBIDI_INSTALL/lib/pkgconfig:$LIBASS_INSTALL/lib/pkgconfig"
export PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"
export PKG_CONFIG_SYSROOT_DIR=""

cd "$MPV_SRC"

meson setup "$MPV_BUILD" \
    --cross-file="$CROSS_FILE" \
    --prefix="$MPV_INSTALL" \
    --buildtype=release \
    -Dlibmpv=true \
    -Dcplayer=false \
    -Dlua=disabled \
    -Djavascript=disabled \
    -Dlibarchive=disabled \
    -Duchardet=disabled \
    -Drubberband=disabled \
    -Dvapoursynth=disabled \
    -Dcuda-hwaccel=disabled \
    -Dgl=disabled \
    -Dlibplacebo=disabled \
    -Dlibplacebo-next=disabled \
    -Dspirv-cross=disabled \
    -Dvulkan=disabled \
    -Dcocoa=disabled \
    -Ddrm=disabled \
    -Dgbm=disabled \
    -Dwayland=disabled \
    -Dx11=disabled \
    -Dopenal=disabled \
    -Dpipewire=disabled \
    -Dpulse=disabled \
    -Dalsa=disabled \
    -Djack=disabled \
    -Dsndio=disabled \
    -Dcoreaudio=disabled \
    -Dwasapi=enabled \
    -Dd3d11=enabled \
    -Ddxva2=enabled

echo "=== mpv: build (-j$J) ==="
cd "$MPV_BUILD"
meson compile -j"$J"
meson install

echo "=== Copying mpv-2.dll ==="
cp "$MPV_INSTALL/bin/mpv-2.dll" "$OUT_DIR/mpv-2.dll"

echo ""
echo "=== Done: $OUT_DIR/mpv-2.dll ==="
echo "  Size: $(du -h "$OUT_DIR/mpv-2.dll" | cut -f1)"
