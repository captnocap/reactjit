#!/bin/bash
# Rebuild libvello_ffi_stripped.a from source.
# Run this after `git clone` or if the .a is missing.
#
# Usage: deps/vello_ffi/build.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[vello_ffi] cargo build --release..."
cargo build --release

echo "[vello_ffi] weakening rust_eh_personality (prevents duplicate symbol with wgpu)..."
if [ "$(uname -s)" = "Darwin" ]; then
    OBJCOPY=$(brew --prefix llvm 2>/dev/null)/bin/llvm-objcopy
    if [ -x "$OBJCOPY" ]; then
        "$OBJCOPY" --weaken-symbol=_rust_eh_personality \
            target/release/libvello_ffi.a \
            target/release/libvello_ffi_stripped.a
    else
        echo "[vello_ffi] WARNING: llvm-objcopy not found (brew install llvm), copying without weakening"
        cp target/release/libvello_ffi.a target/release/libvello_ffi_stripped.a
    fi
else
    llvm-objcopy --weaken-symbol=rust_eh_personality \
        target/release/libvello_ffi.a \
        target/release/libvello_ffi_stripped.a
fi

echo "[vello_ffi] done — $(du -sh target/release/libvello_ffi_stripped.a | cut -f1) at target/release/libvello_ffi_stripped.a"
