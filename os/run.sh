#!/usr/bin/env bash
# CartridgeOS run.sh — boots kernel + busybox + QuickJS in QEMU
# HTTP bridge on port 8080 forwarded to host port 9080
# No GPU, no display. Serial console only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
KERNEL="$DIST_DIR/vmlinuz"
INITRD="$DIST_DIR/initrd.cpio.gz"

if [ ! -f "$KERNEL" ] || [ ! -f "$INITRD" ]; then
    echo "ERROR: run build.sh first"
    exit 1
fi

echo ""
echo "  CartridgeOS (kernel mode)"
echo "  kernel: $KERNEL ($(du -sh "$KERNEL" | cut -f1))"
echo "  initrd: $INITRD ($(du -sh "$INITRD" | cut -f1))"
echo "  bridge: http://localhost:9080/cgi-bin/info"
echo ""

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
    KVM="-enable-kvm -cpu host"
    echo "  KVM: enabled"
else
    echo "  KVM: disabled"
fi

echo "  Booting... (serial console, Ctrl-A X to quit)"
echo ""

qemu-system-x86_64 \
    $KVM \
    -m 512M \
    -kernel "$KERNEL" \
    -initrd "$INITRD" \
    -append "rdinit=/init console=ttyS0 loglevel=3" \
    -nographic \
    -no-reboot \
    -netdev user,id=net0,hostfwd=tcp::9080-:8080 \
    -device virtio-net-pci,netdev=net0
