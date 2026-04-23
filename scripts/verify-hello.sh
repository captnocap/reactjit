#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CART_NAME="${CART_NAME:-hello}"
HARNESS_NAME="${HARNESS_NAME:-verify-${CART_NAME}}"
EXPECT_FILE="${EXPECT_FILE:-$ROOT/tests/${CART_NAME}.autotest}"

SHIP_ARGS=()
JSRT_MODE="${REACTJIT_USE_JSRT:-auto}"
case "$JSRT_MODE" in
  1|true|yes|on)
    SHIP_ARGS+=(--jsrt)
    ;;
  auto)
    # Flip automatically once the JSRT app source lands.
    if [[ -f "jsrt_app.zig" || -f "framework/jsrt_app.zig" ]]; then
      SHIP_ARGS+=(--jsrt)
    fi
    ;;
esac

./scripts/ship "$CART_NAME" "${SHIP_ARGS[@]}"

OS="$(uname -s)"
case "$OS" in
  Darwin)
    BINARY="$ROOT/zig-out/bin/${CART_NAME}.app/Contents/MacOS/${CART_NAME}"
    ;;
  Linux)
    BINARY="$ROOT/zig-out/bin/${CART_NAME}"
    ;;
  *)
    echo "[$HARNESS_NAME] unsupported OS: $OS" >&2
    exit 1
    ;;
esac

if [[ ! -f "$EXPECT_FILE" ]]; then
  echo "[$HARNESS_NAME] missing expectation file: $EXPECT_FILE" >&2
  exit 1
fi

echo "[$HARNESS_NAME] running autotest against $BINARY"
ZIGOS_WITNESS=autotest ZIGOS_WITNESS_FILE="$EXPECT_FILE" "$BINARY"
