#!/usr/bin/env bash
# CartridgeOS run.sh — boots x86_64 kernel with virtio-gpu in QEMU
# tsz renders via DRM/KMS through the virtual GPU.
# HTTP bridge on port 8080 forwarded to host port 9080.
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
echo "  CartridgeOS (x86_64 — tsz + virtio-gpu)"
echo "  kernel: $KERNEL ($(du -sh "$KERNEL" | cut -f1))"
echo "  initrd: $INITRD ($(du -sh "$INITRD" | cut -f1))"
echo "  bridge: http://localhost:9080/cgi-bin/info"
echo ""

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
    KVM="-enable-kvm -cpu host"
    echo "  KVM: enabled"
else
    echo "  KVM: disabled (will be slow)"
fi

# Default to graphical mode with virtio-gpu
# Pass --serial to get serial-only mode (no GPU, for debugging)
if [ "${1:-}" = "--serial" ]; then
    echo "  Mode: serial only (no GPU)"
    echo "  Booting... (Ctrl-A X to quit)"
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
else
    echo "  Mode: graphical (virtio-gpu + SDL display)"
    echo "  Booting... (close window to quit)"
    echo ""
    qemu-system-x86_64 \
        $KVM \
        -m 1G \
        -kernel "$KERNEL" \
        -initrd "$INITRD" \
        -append "rdinit=/init console=ttyS0 loglevel=3" \
        -device virtio-vga-gl \
        -display sdl,gl=on \
        -serial stdio \
        -no-reboot \
        -netdev user,id=net0,hostfwd=tcp::9080-:8080 \
        -device virtio-net-pci,netdev=net0
fi
