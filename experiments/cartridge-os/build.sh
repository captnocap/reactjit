#\!/usr/bin/env bash
# CartridgeOS build.sh — builds initramfs for bare-metal iLoveReact boot
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"

echo ""
echo "  CartridgeOS build"
echo "  repo: $REPO_ROOT"
echo "  out:  $DIST_DIR"
echo ""

mkdir -p "$DIST_DIR" "$STAGING"

# ── Step 1: Build Docker image ──────────────────────────────────────────────
echo "  [1/5] Building Docker image..."
docker build \
  -f "$SCRIPT_DIR/Dockerfile" \
  -t cartridge-os:latest \
  "$REPO_ROOT" \
  --quiet
echo "  Done."
echo ""

# ── Step 2: Extract kernel ──────────────────────────────────────────────────
echo "  [2/5] Extracting kernel..."
docker rm -f co-extract 2>/dev/null || true
docker create --name co-extract cartridge-os:latest /bin/true
docker cp co-extract:/boot/vmlinuz-virt "$DIST_DIR/vmlinuz" 2>/dev/null \
  || docker cp co-extract:/boot/vmlinuz "$DIST_DIR/vmlinuz" 2>/dev/null \
  || { echo "  ERROR: no kernel found in /boot inside Docker image"; exit 1; }
echo "  kernel: $DIST_DIR/vmlinuz ($(du -sh "$DIST_DIR/vmlinuz" | cut -f1))"
echo ""

# ── Step 3: Build initramfs staging tree ────────────────────────────────────
echo "  [3/5] Building initramfs staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{bin,sbin,lib,usr/bin,usr/lib,usr/lib/dri,usr/share/fonts,dev,proc,sys,app,tmp}

docker cp co-extract:/usr/bin/luajit   "$STAGING/usr/bin/luajit"
docker cp co-extract:/bin/sh           "$STAGING/bin/sh"
docker cp co-extract:/lib/.            "$STAGING/lib/"
docker cp co-extract:/usr/lib/.        "$STAGING/usr/lib/"
docker cp co-extract:/usr/share/fonts/. "$STAGING/usr/share/fonts/" 2>/dev/null || true
docker cp co-extract:/app/ft_helper.so "$STAGING/app/ft_helper.so"

cp "$SCRIPT_DIR/app/main.lua"  "$STAGING/app/"
cp "$SCRIPT_DIR/app/gl.lua"    "$STAGING/app/"
cp "$SCRIPT_DIR/app/font.lua"  "$STAGING/app/"

cp "$SCRIPT_DIR/init" "$STAGING/init"
chmod +x "$STAGING/init"

mknod "$STAGING/dev/null"    c 1 3 2>/dev/null || true
mknod "$STAGING/dev/zero"    c 1 5 2>/dev/null || true
mknod "$STAGING/dev/console" c 5 1 2>/dev/null || true

docker rm co-extract
echo "  Staging tree: $(du -sh "$STAGING" | cut -f1)"
echo ""

# ── Step 4: Package as cpio.gz ──────────────────────────────────────────────
echo "  [4/5] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "  initrd: $DIST_DIR/initrd.cpio.gz ($(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1))"
echo ""

echo "  [5/5] Done\!"
echo ""
echo "  Output:"
echo "    $DIST_DIR/vmlinuz"
echo "    $DIST_DIR/initrd.cpio.gz"
echo ""
echo "  Boot with: bash experiments/cartridge-os/run.sh"
echo ""
