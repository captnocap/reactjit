#\!/usr/bin/env bash
# CartridgeOS run.sh — boots the initramfs in QEMU
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
KERNEL="$DIST_DIR/vmlinuz"
INITRD="$DIST_DIR/initrd.cpio.gz"

if [ \! -f "$KERNEL" ] || [ \! -f "$INITRD" ]; then
  echo "ERROR: run build.sh first"
  exit 1
fi

echo ""
echo "  CartridgeOS"
echo "  kernel: $KERNEL ($(du -sh "$KERNEL" | cut -f1))"
echo "  initrd: $INITRD ($(du -sh "$INITRD" | cut -f1))"
echo ""

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  KVM="-enable-kvm -cpu host"
  echo "  KVM: enabled"
else
  echo "  KVM: disabled (add yourself to kvm group for faster boot)"
fi

echo "  Booting... QEMU window will open."
echo "  Serial output appears below. Close the window or Ctrl-C to quit."
echo ""

exec qemu-system-x86_64 \
  $KVM \
  -m 512M \
  -kernel "$KERNEL" \
  -initrd "$INITRD" \
  -append "init=/init quiet loglevel=3" \
  -device virtio-vga-gl \
  -display sdl,gl=on \
  -serial stdio \
  -no-reboot
