#!/bin/bash
# Cuttlefish Android VM setup script
# Run as: sudo bash setup.sh

set -e

echo "=== Installing apt dependencies ==="
apt install -y qemu-kvm git devscripts config-package-dev debhelper-compat golang curl unzip zip psmisc

echo "=== Adding Google Cuttlefish apt repo ==="
curl -fsSL https://us-apt.pkg.dev/doc/repo-signing-key.gpg \
    -o /etc/apt/trusted.gpg.d/artifact-registry.asc
chmod a+r /etc/apt/trusted.gpg.d/artifact-registry.asc
echo "deb https://us-apt.pkg.dev/projects/android-cuttlefish-artifacts android-cuttlefish main" \
    > /etc/apt/sources.list.d/artifact-registry.list

echo "=== Installing Cuttlefish host packages ==="
apt update
apt install -y cuttlefish-base cuttlefish-user

echo "=== Adding user to required groups ==="
usermod -aG kvm,cvdnetwork,render ${SUDO_USER:-$USER}

echo ""
echo "=== Done! ==="
echo "You MUST reboot for group changes to take effect."
echo ""
echo "After reboot, download images from ci.android.com:"
echo "  Branch: aosp-android-latest-release"
echo "  Target: aosp_cf_x86_64_only_phone-userdebug"
echo "  Download: *-img-*.zip AND cvd-host_package.tar.gz"
echo ""
echo "Then:"
echo "  mkdir ~/cuttlefish && cd ~/cuttlefish"
echo "  tar xvf cvd-host_package.tar.gz"
echo "  unzip aosp_cf_x86_64_phone-img-*.zip"
echo "  HOME=\$PWD ./bin/launch_cvd -start_vnc_server --daemon"
