#!/bin/sh
# install.sh — public installer for reactjit.
#
# Hosted at https://reactjit.com/install. End users run:
#
#   curl -fsSL https://reactjit.com/install | sh
#
# Detects the host OS+arch, downloads the matching prebuilt reactjit binary
# from the latest GitHub release, drops it at ~/.local/bin/reactjit, and
# prints a one-line "you're done" message. The binary is self-extracting:
# on first run it unpacks its bundled libs (V8, SDL3, libwhisper, etc.) into
# ~/.cache/reactjit/ and execs itself. Zero system dependencies, no zig, no
# toolchain. Reinstall by running the same command again.

set -eu

REPO="captnocap/reactjit"
INSTALL_DIR="${REACTJIT_INSTALL_DIR:-$HOME/.local/bin}"
BIN_NAME="reactjit"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$OS" in
    linux|darwin) ;;
    *) echo "[install] unsupported OS: $OS" >&2; exit 1 ;;
esac
case "$ARCH" in
    x86_64|amd64) ARCH="x86_64" ;;
    arm64|aarch64) ARCH="aarch64" ;;
    *) echo "[install] unsupported arch: $ARCH" >&2; exit 1 ;;
esac

ASSET="reactjit-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
DEST="${INSTALL_DIR}/${BIN_NAME}"

mkdir -p "$INSTALL_DIR"

echo "[install] downloading $ASSET..."
if command -v curl >/dev/null 2>&1; then
    curl -fSL --progress-bar -o "$DEST.tmp" "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget --show-progress -qO "$DEST.tmp" "$URL"
else
    echo "[install] need curl or wget" >&2; exit 1
fi

chmod +x "$DEST.tmp"
mv "$DEST.tmp" "$DEST"

SIZE=$(du -h "$DEST" | cut -f1)
echo "[install] installed reactjit ($SIZE) → $DEST"

case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
        echo
        echo "[install] note: $INSTALL_DIR is not on your PATH."
        echo "          add this to your shell rc:"
        echo "            export PATH=\"\$HOME/.local/bin:\$PATH\""
        ;;
esac

echo
echo "  $ reactjit            # launch the dev host"
echo "  $ reactjit --help     # see commands"
