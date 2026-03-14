#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# GPU Passthrough Verify — Check everything is back to normal
# Run after cleanup.sh + reboot to confirm the RTX 3060 is restored
# Also works after setup.sh + reboot to confirm VFIO grabbed the GPU
# ══════════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
CYN='\033[0;36m'
RST='\033[0m'

echo -e "${YLW}═══ GPU Status Verification ═══${RST}"
echo ""

# ── GPUs detected ─────────────────────────────────────────────────────
echo -e "${CYN}GPUs detected:${RST}"
lspci | grep -i "vga\|3d controller" | while read line; do
  echo "  $line"
done
echo ""

# ── Driver bindings ───────────────────────────────────────────────────
echo -e "${CYN}Driver bindings:${RST}"

# RTX 3060
RTX_DRIVER=$(basename "$(readlink /sys/bus/pci/devices/0000:08:00.0/driver 2>/dev/null)" 2>/dev/null || echo "none")
RTX_AUDIO_DRIVER=$(basename "$(readlink /sys/bus/pci/devices/0000:08:00.1/driver 2>/dev/null)" 2>/dev/null || echo "none")

echo "  RTX 3060 VGA  (08:00.0): $RTX_DRIVER"
echo "  RTX 3060 Audio(08:00.1): $RTX_AUDIO_DRIVER"

# AMD 7900
AMD_DRIVER=$(basename "$(readlink /sys/bus/pci/devices/0000:03:00.0/driver 2>/dev/null)" 2>/dev/null || echo "none")
echo "  AMD 7900  VGA  (03:00.0): $AMD_DRIVER"
echo ""

# ── Determine mode ────────────────────────────────────────────────────
if [ "$RTX_DRIVER" = "vfio-pci" ]; then
  echo -e "${YLW}Mode: PASSTHROUGH${RST}"
  echo "  RTX 3060 is held by vfio-pci → ready for VM passthrough"
  echo ""

  # Check IOMMU is active
  if grep -q 'intel_iommu=on' /proc/cmdline; then
    echo -e "  ${GRN}✓${RST} intel_iommu=on active in kernel"
  else
    echo -e "  ${RED}✗${RST} intel_iommu=on NOT in kernel cmdline"
  fi

  # Check IOMMU groups
  GROUPS=$(ls /sys/kernel/iommu_groups/ 2>/dev/null | wc -l)
  if [ "$GROUPS" -gt 0 ]; then
    echo -e "  ${GRN}✓${RST} IOMMU groups present ($GROUPS groups)"
  else
    echo -e "  ${RED}✗${RST} No IOMMU groups found"
  fi

  # Check libvirtd
  if systemctl is-active libvirtd &>/dev/null; then
    echo -e "  ${GRN}✓${RST} libvirtd is running"
  else
    echo -e "  ${YLW}!${RST} libvirtd not running — start with: sudo systemctl start libvirtd"
  fi

  echo ""
  echo "  Next: open virt-manager, create a Windows VM, attach the RTX 3060"

elif [ "$RTX_DRIVER" = "nvidia" ]; then
  echo -e "${GRN}Mode: NORMAL${RST}"
  echo "  RTX 3060 is on the nvidia driver → back to normal operation"
  echo ""

  # Verify nvidia module is loaded
  if lsmod | grep -q '^nvidia '; then
    echo -e "  ${GRN}✓${RST} nvidia kernel module loaded"
  else
    echo -e "  ${RED}✗${RST} nvidia kernel module NOT loaded"
  fi

  # Check no VFIO configs remain
  if [ -f /etc/modprobe.d/vfio.conf ]; then
    echo -e "  ${YLW}!${RST} /etc/modprobe.d/vfio.conf still exists (stale — safe to delete)"
  else
    echo -e "  ${GRN}✓${RST} No VFIO modprobe config (clean)"
  fi

  if grep -q 'intel_iommu=on' /proc/cmdline; then
    echo -e "  ${YLW}!${RST} intel_iommu=on still in kernel cmdline (harmless but unnecessary)"
  else
    echo -e "  ${GRN}✓${RST} No IOMMU params in kernel cmdline (clean)"
  fi

  echo ""
  echo "  Everything is back to normal. Both GPUs on their native drivers."

else
  echo -e "${RED}Mode: UNKNOWN${RST}"
  echo "  RTX 3060 driver: $RTX_DRIVER (expected: nvidia or vfio-pci)"
  echo "  Something unexpected happened. Check lspci -v for details."
fi

echo ""
echo -e "${CYN}Kernel cmdline:${RST}"
echo "  $(cat /proc/cmdline)"
echo ""
