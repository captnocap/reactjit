#!/usr/bin/env bash
# CartridgeOS run-iso.sh — boots the GRUB ISO in QEMU
#
# Use this to verify the bootable ISO works end-to-end (GRUB → kernel → init).
# For the fast dev loop (no bootloader overhead), use run.sh instead.
#
# Deps: qemu-system-x86_64
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
ISO="$DIST_DIR/cartridge-os.iso"
LOG="$DIST_DIR/boot-iso.log"

if [ ! -f "$ISO" ]; then
    echo "ERROR: $ISO not found — run build.sh first (requires grub-mkrescue)"
    exit 1
fi

echo ""
echo "  CartridgeOS ISO boot"
echo "  iso: $ISO ($(du -sh "$ISO" | cut -f1))"
echo "  log: $LOG"
echo ""

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
    KVM="-enable-kvm -cpu host"
    echo "  KVM: enabled"
else
    echo "  KVM: disabled (no /dev/kvm access)"
fi

echo "  Booting from ISO... serial output → $LOG"
echo ""

qemu-system-x86_64 \
    $KVM \
    -m 2048M \
    -cdrom "$ISO" \
    -boot d \
    -vga none \
    -device virtio-vga-gl \
    -display sdl,gl=on \
    -serial file:"$LOG" \
    -no-reboot
