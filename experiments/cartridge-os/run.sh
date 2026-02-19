#\!/usr/bin/env bash
# CartridgeOS run.sh — boots the initramfs in QEMU
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
KERNEL="$DIST_DIR/vmlinuz"
INITRD="$DIST_DIR/initrd.cpio.gz"
LOG="$DIST_DIR/boot.log"

if [ \! -f "$KERNEL" ] || [ \! -f "$INITRD" ]; then
  echo "ERROR: run build.sh first"
  exit 1
fi

echo ""
echo "  CartridgeOS"
echo "  kernel: $KERNEL ($(du -sh "$KERNEL" | cut -f1))"
echo "  initrd: $INITRD ($(du -sh "$INITRD" | cut -f1))"
echo "  log:    $LOG"
echo ""

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  KVM="-enable-kvm -cpu host"
  echo "  KVM: enabled"
else
  echo "  KVM: disabled"
fi

echo "  Booting... serial output → $LOG"
echo ""

qemu-system-x86_64 \
  $KVM \
  -m 2048M \
  -kernel "$KERNEL" \
  -initrd "$INITRD" \
  -append "rdinit=/init console=ttyS0 loglevel=7" \
  -device virtio-vga-gl \
  -display sdl,gl=on \
  -serial file:"$LOG" \
  -no-reboot
