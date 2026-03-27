#!/bin/bash
# Rebuild libvello_ffi_stripped.a from source.
# Run this after `git clone` or if the .a is missing.
#
# Usage: deps/vello_ffi/build.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[vello_ffi] cargo build --release..."
cargo build --release

echo "[vello_ffi] stripping debug symbols..."
llvm-strip --strip-debug \
    target/release/libvello_ffi.a \
    -o target/release/libvello_ffi_stripped.a

echo "[vello_ffi] done — $(du -sh target/release/libvello_ffi_stripped.a | cut -f1) at target/release/libvello_ffi_stripped.a"
