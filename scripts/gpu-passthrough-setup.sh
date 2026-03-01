#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# GPU Passthrough Setup — Run ONCE before the first reboot
# Installs packages, configures VFIO, updates GRUB
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

echo -e "${YLW}═══ GPU Passthrough Setup ═══${RST}"
echo ""

# ── 1. Install packages ───────────────────────────────────────────────
echo -e "${GRN}[1/5]${RST} Installing VM packages..."
apt install -y qemu-kvm libvirt-daemon-system virt-manager ovmf bridge-utils

# Add user to libvirt/kvm groups
REAL_USER="${SUDO_USER:-$USER}"
usermod -aG libvirt "$REAL_USER" 2>/dev/null || true
usermod -aG kvm "$REAL_USER" 2>/dev/null || true
echo "  Added $REAL_USER to libvirt + kvm groups"

# ── 2. Enable IOMMU in GRUB ──────────────────────────────────────────
echo -e "${GRN}[2/5]${RST} Configuring GRUB for IOMMU + VFIO..."

GRUB_FILE="/etc/default/grub"
cp "$GRUB_FILE" "$GRUB_FILE.bak.$(date +%s)"

# Current line: GRUB_CMDLINE_LINUX_DEFAULT="quiet splash modprobe.blacklist=nouveau nvidia-drm.modeset=0"
# Add intel_iommu=on and vfio-pci.ids for the RTX 3060
# GPU: 10de:2504  Audio: 10de:228e
CURRENT=$(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' "$GRUB_FILE" | sed 's/^GRUB_CMDLINE_LINUX_DEFAULT="//' | sed 's/"$//')

# Remove any existing iommu/vfio params (idempotent)
CLEANED=$(echo "$CURRENT" | sed 's/intel_iommu=[^ ]*//g' | sed 's/iommu=[^ ]*//g' | sed 's/vfio-pci.ids=[^ ]*//g' | sed 's/  */ /g' | sed 's/^ //' | sed 's/ $//')

NEW_CMDLINE="$CLEANED intel_iommu=on iommu=pt vfio-pci.ids=10de:2504,10de:228e"

sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"$NEW_CMDLINE\"|" "$GRUB_FILE"

echo "  Boot params: $NEW_CMDLINE"

update-grub
echo "  GRUB updated"

# ── 3. Configure VFIO module loading ─────────────────────────────────
echo -e "${GRN}[3/5]${RST} Configuring VFIO modules..."

cat > /etc/modprobe.d/vfio.conf << 'EOF'
# RTX 3060 passthrough — GPU + HDMI audio
options vfio-pci ids=10de:2504,10de:228e
softdep nvidia pre: vfio-pci
softdep nvidia_drm pre: vfio-pci
softdep nvidia_modeset pre: vfio-pci
softdep nvidia_uvm pre: vfio-pci
EOF

cat > /etc/modules-load.d/vfio.conf << 'EOF'
vfio
vfio_iommu_type1
vfio_pci
EOF

echo "  /etc/modprobe.d/vfio.conf written"
echo "  /etc/modules-load.d/vfio.conf written"

# ── 4. Update initramfs ──────────────────────────────────────────────
echo -e "${GRN}[4/5]${RST} Rebuilding initramfs..."
update-initramfs -u
echo "  initramfs updated"

# ── 5. Enable libvirt ─────────────────────────────────────────────────
echo -e "${GRN}[5/5]${RST} Enabling libvirt..."
systemctl enable libvirtd
systemctl start libvirtd 2>/dev/null || true
echo "  libvirtd enabled"

echo ""
echo -e "${GRN}═══ Setup complete ═══${RST}"
echo ""
echo "  GPU to pass through: RTX 3060 (08:00.0) [10de:2504]"
echo "  Host GPU (untouched): AMD RX 7900 (03:00.0)"
echo ""
echo -e "  ${YLW}Next step: run gpu-passthrough-runtime.sh to reboot${RST}"
echo "  After reboot, the RTX 3060 will be held by vfio-pci (not nvidia)"
echo "  Your AMD GPU continues to drive your display as normal"
