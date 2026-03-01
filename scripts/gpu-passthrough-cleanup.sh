#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# GPU Passthrough Cleanup — Return RTX 3060 to host nvidia driver
# Removes VFIO configs, restores GRUB, reboots
# ══════════════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
RST='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Run as root: sudo bash $0${RST}"
  exit 1
fi

echo -e "${YLW}═══ GPU Passthrough Cleanup ═══${RST}"
echo ""
echo "This will:"
echo "  1. Remove VFIO configs (modprobe + modules-load)"
echo "  2. Remove intel_iommu + vfio-pci.ids from GRUB"
echo "  3. Rebuild initramfs"
echo "  4. Reboot → RTX 3060 returns to nvidia driver"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ── 1. Remove VFIO configs ───────────────────────────────────────────
echo -e "${GRN}[1/4]${RST} Removing VFIO configs..."
rm -f /etc/modprobe.d/vfio.conf
rm -f /etc/modules-load.d/vfio.conf
echo "  Removed /etc/modprobe.d/vfio.conf"
echo "  Removed /etc/modules-load.d/vfio.conf"

# ── 2. Restore GRUB ──────────────────────────────────────────────────
echo -e "${GRN}[2/4]${RST} Restoring GRUB..."

GRUB_FILE="/etc/default/grub"
CURRENT=$(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' "$GRUB_FILE" | sed 's/^GRUB_CMDLINE_LINUX_DEFAULT="//' | sed 's/"$//')

# Remove iommu/vfio params, keep everything else
CLEANED=$(echo "$CURRENT" | sed 's/intel_iommu=[^ ]*//g' | sed 's/iommu=[^ ]*//g' | sed 's/vfio-pci.ids=[^ ]*//g' | sed 's/  */ /g' | sed 's/^ //' | sed 's/ $//')

sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"$CLEANED\"|" "$GRUB_FILE"

echo "  Boot params restored: $CLEANED"
update-grub
echo "  GRUB updated"

# ── 3. Rebuild initramfs ─────────────────────────────────────────────
echo -e "${GRN}[3/4]${RST} Rebuilding initramfs..."
update-initramfs -u
echo "  initramfs updated"

# ── 4. Reboot ─────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}═══ Cleanup complete ═══${RST}"
echo ""
echo "  After reboot, the RTX 3060 will be back on the nvidia driver."
echo "  Run gpu-passthrough-verify.sh to confirm everything is restored."
echo ""
read -p "Reboot now? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Rebooting..."
  reboot
else
  echo "Reboot when ready: sudo reboot"
fi
