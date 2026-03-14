#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# GPU Passthrough Runtime — Verify setup then reboot
# Run AFTER setup.sh, BEFORE using the VM
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

echo -e "${YLW}═══ Pre-Reboot Verification ═══${RST}"
echo ""

FAIL=0

# Check GRUB has IOMMU
if grep -q 'intel_iommu=on' /etc/default/grub; then
  echo -e "  ${GRN}✓${RST} GRUB: intel_iommu=on"
else
  echo -e "  ${RED}✗${RST} GRUB: intel_iommu=on MISSING — run setup.sh first"
  FAIL=1
fi

# Check VFIO IDs
if grep -q '10de:2504' /etc/default/grub; then
  echo -e "  ${GRN}✓${RST} GRUB: vfio-pci.ids includes RTX 3060"
else
  echo -e "  ${RED}✗${RST} GRUB: vfio-pci.ids missing — run setup.sh first"
  FAIL=1
fi

# Check modprobe config
if [ -f /etc/modprobe.d/vfio.conf ]; then
  echo -e "  ${GRN}✓${RST} /etc/modprobe.d/vfio.conf exists"
else
  echo -e "  ${RED}✗${RST} /etc/modprobe.d/vfio.conf missing — run setup.sh first"
  FAIL=1
fi

# Check modules-load config
if [ -f /etc/modules-load.d/vfio.conf ]; then
  echo -e "  ${GRN}✓${RST} /etc/modules-load.d/vfio.conf exists"
else
  echo -e "  ${RED}✗${RST} /etc/modules-load.d/vfio.conf missing — run setup.sh first"
  FAIL=1
fi

# Check OVMF exists
if [ -f /usr/share/OVMF/OVMF_CODE_4M.fd ] || [ -f /usr/share/OVMF/OVMF_CODE.fd ]; then
  echo -e "  ${GRN}✓${RST} OVMF firmware present"
else
  echo -e "  ${RED}✗${RST} OVMF firmware missing — apt install ovmf"
  FAIL=1
fi

# Check libvirtd
if systemctl is-enabled libvirtd &>/dev/null; then
  echo -e "  ${GRN}✓${RST} libvirtd enabled"
else
  echo -e "  ${RED}✗${RST} libvirtd not enabled — run setup.sh first"
  FAIL=1
fi

# Check qemu-kvm
if [ -e /dev/kvm ]; then
  echo -e "  ${GRN}✓${RST} /dev/kvm exists (VT-x active)"
else
  echo -e "  ${YLW}?${RST} /dev/kvm not found — might appear after reboot with IOMMU"
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo -e "  ${RED}Pre-flight checks failed. Fix the issues above before rebooting.${RST}"
  exit 1
fi

echo ""
echo -e "${GRN}All checks passed.${RST}"
echo ""
echo "After reboot:"
echo "  - Your AMD 7900 drives your display (unchanged)"
echo "  - The RTX 3060 is held by vfio-pci (ready for VM passthrough)"
echo "  - Run virt-manager to create a Windows VM with the GPU attached"
echo ""
echo -e "${YLW}Quick VM setup after reboot:${RST}"
echo ""
echo "  1. Open virt-manager (or run from terminal: virt-manager)"
echo "  2. Create new VM → Local install media → pick your Windows ISO"
echo "  3. Give it 8GB RAM, 4-8 CPUs, 60GB disk"
echo "  4. IMPORTANT: Check 'Customize configuration before install'"
echo "  5. Overview → Firmware: select UEFI x86_64: /usr/share/OVMF/OVMF_CODE_4M.fd"
echo "  6. Add Hardware → PCI Host Device → 08:00.0 (RTX 3060 VGA)"
echo "  7. Add Hardware → PCI Host Device → 08:00.1 (RTX 3060 Audio)"
echo "  8. Begin installation"
echo "  9. After Windows installs, install NVIDIA drivers from nvidia.com"
echo " 10. Copy playground.exe to the VM and double-click it"
echo ""
read -p "Reboot now? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Rebooting..."
  reboot
else
  echo "Reboot when ready: sudo reboot"
fi
