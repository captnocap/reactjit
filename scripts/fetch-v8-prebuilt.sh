#!/bin/bash
# Fetch the prebuilt V8 static library that `zig build app -Duse-v8=true` links
# against. Keeps the 116MB .a out of git history; run once after cloning if you
# plan to build the V8 path.
#
# V8 release: lightpanda-io/zig-v8-fork v0.4.0 → V8 14.0.365.4
# License: V8 is BSD-style (see deps/zig-v8/LICENSE)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS-$ARCH" in
    Linux-x86_64)  ASSET="libc_v8_14.0.365.4_linux_x86_64.a" ;;
    Linux-aarch64) ASSET="libc_v8_14.0.365.4_linux_aarch64.a" ;;
    Darwin-arm64)  ASSET="libc_v8_14.0.365.4_macos_aarch64.a" ;;
    Darwin-x86_64) ASSET="libc_v8_14.0.365.4_macos_x86_64.a" ;;
    *) echo "[fetch-v8] unsupported host: $OS-$ARCH" >&2; exit 1 ;;
esac

OUT="deps/v8-prebuilt/libc_v8.a"
URL="https://github.com/lightpanda-io/zig-v8-fork/releases/download/v0.4.0/$ASSET"

if [[ -f "$OUT" ]]; then
    SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
    if [[ "$SIZE" -gt 100000000 ]]; then
        echo "[fetch-v8] $OUT already present ($((SIZE / 1024 / 1024))MB) — skipping"
        exit 0
    fi
fi

mkdir -p deps/v8-prebuilt
echo "[fetch-v8] downloading $ASSET..."
curl -sL -o "$OUT" "$URL"
SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "[fetch-v8] wrote $OUT ($((SIZE / 1024 / 1024))MB)"
