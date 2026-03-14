#!/usr/bin/env bash
# run_cart.sh — Build a test cart and run it in QEMU (Option C)
# End-to-end sandbox validation inside the real CartridgeOS.
#
# Usage: bash tests/run_cart.sh
# From:  experiments/cartridge-os/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CART_DIR="$SCRIPT_DIR/.."
DIST_DIR="$CART_DIR/dist"
TEST_LOG="$DIST_DIR/test-boot.log"
TIMEOUT=30  # seconds to wait for test completion

echo ""
echo "  CartridgeOS Sandbox Tests (in-cart / QEMU)"
echo ""

# ── Build with test main.lua ────────────────────────────────────────────────
# Save originals, swap in test files, build, restore.

ORIG_MAIN="$CART_DIR/app/main.lua"
ORIG_MANIFEST="$CART_DIR/app/manifest.json"
BACKUP_MAIN="$CART_DIR/app/main.lua.bak"
BACKUP_MANIFEST="$CART_DIR/app/manifest.json.bak"

cleanup() {
  # Restore originals
  if [ -f "$BACKUP_MAIN" ]; then
    mv "$BACKUP_MAIN" "$ORIG_MAIN"
  fi
  if [ -f "$BACKUP_MANIFEST" ]; then
    mv "$BACKUP_MANIFEST" "$ORIG_MANIFEST"
  fi
}
trap cleanup EXIT

cp "$ORIG_MAIN" "$BACKUP_MAIN"
cp "$ORIG_MANIFEST" "$BACKUP_MANIFEST"
cp "$SCRIPT_DIR/test_cart_main.lua" "$ORIG_MAIN"
cp "$SCRIPT_DIR/test_manifest.json" "$ORIG_MANIFEST"

echo "  Building test cart..."
cd "$CART_DIR"
bash build.sh > /dev/null 2>&1
echo "  Build complete."

# Restore immediately (build is done, files are packed into initrd)
cleanup
trap - EXIT

# ── Run in QEMU ─────────────────────────────────────────────────────────────

KERNEL="$DIST_DIR/vmlinuz"
INITRD="$DIST_DIR/initrd.cpio.gz"

if [ ! -f "$KERNEL" ] || [ ! -f "$INITRD" ]; then
  echo "  ERROR: build failed — missing kernel or initrd"
  exit 1
fi

KVM=""
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  KVM="-enable-kvm -cpu host"
fi

echo "  Booting QEMU (timeout: ${TIMEOUT}s)..."
echo "  Serial log: $TEST_LOG"
echo ""

# Run QEMU headless with serial to file, kill after timeout
rm -f "$TEST_LOG"
touch "$TEST_LOG"

qemu-system-x86_64 \
  $KVM \
  -m 2048M \
  -kernel "$KERNEL" \
  -initrd "$INITRD" \
  -append "rdinit=/init console=ttyS0 loglevel=3" \
  -nographic \
  -serial file:"$TEST_LOG" \
  -no-reboot &
QEMU_PID=$!

# Wait for TEST_COMPLETE sentinel or timeout
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if grep -q "TEST_COMPLETE:" "$TEST_LOG" 2>/dev/null; then
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

# Kill QEMU
kill $QEMU_PID 2>/dev/null || true
wait $QEMU_PID 2>/dev/null || true

# ── Parse results ───────────────────────────────────────────────────────────

echo ""
if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "  TIMEOUT: QEMU did not complete within ${TIMEOUT}s"
  echo ""
  echo "  Last 20 lines of serial log:"
  tail -20 "$TEST_LOG" | sed 's/^/    /'
  echo ""
  exit 1
fi

# Show test output (everything between the header and TEST_COMPLETE)
grep -A 1000 "CartridgeOS Sandbox Tests" "$TEST_LOG" | head -200

# Check result
if grep -q "TEST_COMPLETE:PASS" "$TEST_LOG"; then
  echo ""
  echo "  In-cart tests: ALL PASSED"
  echo ""
  exit 0
else
  echo ""
  echo "  In-cart tests: FAILED"
  echo ""
  exit 1
fi
