#!/usr/bin/env bash
# CartridgeOS build.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"

echo "" && echo "  CartridgeOS build" && echo "  repo: $REPO_ROOT" && echo ""

mkdir -p "$DIST_DIR" "$STAGING"

# ── Step 1: Compile init (PID 1) locally with zig cc ──────────────────────
# zig cc -target x86_64-linux-musl produces a static musl binary from the host.
# No Docker or Alpine toolchain needed for this step.
echo "  [1/6] Compiling init (zig cc → musl static)..."
zig cc -static -O2 \
    "$SCRIPT_DIR/init.c" \
    -o "$DIST_DIR/init" \
    -target x86_64-linux-musl
chmod +x "$DIST_DIR/init"
echo "  init: $(du -sh "$DIST_DIR/init" | cut -f1)" && echo ""

# ── Step 2: Build Docker image (Alpine userspace + musl ft_helper.so) ──────
echo "  [2/6] Building Docker image..."
docker build -f "$SCRIPT_DIR/Dockerfile" -t cartridge-os:latest "$REPO_ROOT" --quiet
echo "  Done." && echo ""

# ── Step 3: Extract kernel ─────────────────────────────────────────────────
echo "  [3/6] Extracting kernel..."
docker rm -f co-extract 2>/dev/null || true
docker create --name co-extract cartridge-os:latest /bin/true
docker cp co-extract:/boot/vmlinuz-virt "$DIST_DIR/vmlinuz" 2>/dev/null \
  || { echo "ERROR: no kernel"; exit 1; }
echo "  kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)" && echo ""

# ── Step 4: Build staging tree ─────────────────────────────────────────────
echo "  [4/6] Building staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{bin,sbin,etc,lib,usr/bin,usr/lib,usr/share/fonts,dev,proc,sys,app,tmp}

# /bin — full dir: busybox binary + all symlinks (sh, modprobe, etc.)
docker cp co-extract:/bin/.              "$STAGING/bin/"

# /lib — musl libc, dynamic linker, kernel modules
docker cp co-extract:/lib/.              "$STAGING/lib/"

# /usr/bin — FULL directory so luajit-2.1.x symlink target is included
docker cp co-extract:/usr/bin/.          "$STAGING/usr/bin/"

# /usr/lib — SDL2, Mesa, FreeType, libdrm, LLVM, all deps
docker cp co-extract:/usr/lib/.          "$STAGING/usr/lib/"

# fonts
docker cp co-extract:/usr/share/fonts/.  "$STAGING/usr/share/fonts/" 2>/dev/null || true

# /init — zig cc musl static binary (compiled in step 1, not from Docker)
cp "$DIST_DIR/init" "$STAGING/init"

# ft_helper.so — FreeType bridge (still musl-compiled via Alpine in Docker)
docker cp co-extract:/app/ft_helper.so   "$STAGING/app/ft_helper.so"

# App Lua files
cp "$SCRIPT_DIR/app/main.lua"  "$STAGING/app/"
cp "$SCRIPT_DIR/app/gl.lua"    "$STAGING/app/"
cp "$SCRIPT_DIR/app/font.lua"  "$STAGING/app/"

docker rm co-extract

# Lead 1: GBM's DRI loader has /usr/lib/dri hardcoded at compile time.
# Alpine installs DRI drivers under xorg/modules/dri — symlink so GBM finds them.
ln -sf xorg/modules/dri "$STAGING/usr/lib/dri"

echo "  Staging: $(du -sh "$STAGING" | cut -f1)" && echo ""

# ── Step 5: Package initramfs ──────────────────────────────────────────────
echo "  [5/6] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "  initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)" && echo ""

echo "  [6/6] Done! Boot with: bash experiments/cartridge-os/run.sh" && echo ""
