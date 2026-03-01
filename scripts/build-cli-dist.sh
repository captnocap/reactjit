#!/bin/bash
# Build ReactJIT CLI distribution (Full or Light tier).
#
# Usage:
#   ./scripts/build-cli-dist.sh linux-x64              # Full (embeds Node.js)
#   ./scripts/build-cli-dist.sh linux-x64 --no-node    # Light (BYO Node.js)
#   ./scripts/build-cli-dist.sh macos-arm64
#   ./scripts/build-cli-dist.sh windows-x64
#
# Prerequisites:
#   make cli-setup && make build-storybook-native
#
# Output:
#   dist/reactjit-full-<platform>   or
#   dist/reactjit-light-<platform>
set -euo pipefail

PLATFORM="${1:?Usage: $0 <platform> [--no-node]}"
EMBED_NODE=true
[ "${2:-}" = "--no-node" ] && EMBED_NODE=false

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT/dist"
STAGING="/tmp/reactjit-cli-staging"
PAYLOAD="/tmp/reactjit-cli-payload"

# Node.js LTS version to embed
NODE_VERSION="22.14.0"

# ── Platform mapping ─────────────────────────────────────
case "$PLATFORM" in
  linux-x64)
    NODE_SLUG="node-v${NODE_VERSION}-linux-x64"
    NODE_EXT="tar.gz"
    NODE_BIN_PATH="bin/node"
    EXE_EXT=""
    ;;
  macos-x64)
    NODE_SLUG="node-v${NODE_VERSION}-darwin-x64"
    NODE_EXT="tar.gz"
    NODE_BIN_PATH="bin/node"
    EXE_EXT=""
    ;;
  macos-arm64)
    NODE_SLUG="node-v${NODE_VERSION}-darwin-arm64"
    NODE_EXT="tar.gz"
    NODE_BIN_PATH="bin/node"
    EXE_EXT=""
    ;;
  windows-x64)
    NODE_SLUG="node-v${NODE_VERSION}-win-x64"
    NODE_EXT="zip"
    NODE_BIN_PATH="node.exe"
    EXE_EXT=".exe"
    ;;
  *)
    echo "Unknown platform: $PLATFORM" >&2
    echo "Supported: linux-x64, macos-x64, macos-arm64, windows-x64" >&2
    exit 1
    ;;
esac

TIER="full"
$EMBED_NODE || TIER="light"

echo "=== Building reactjit-${TIER}-${PLATFORM} ==="

# ── Verify prerequisites ─────────────────────────────────
if [ ! -d "$ROOT/cli/runtime/lua" ]; then
  echo "ERROR: cli/runtime/ not populated. Run: make cli-setup" >&2
  exit 1
fi

STORYBOOK_BUNDLE="$ROOT/storybook/love/bundle.js"
if [ ! -f "$STORYBOOK_BUNDLE" ]; then
  echo "ERROR: Storybook not built. Run: make build-storybook-native" >&2
  exit 1
fi

# ── Clean staging ─────────────────────────────────────────
rm -rf "$STAGING" "$PAYLOAD"
mkdir -p "$STAGING/cli" "$STAGING/runtime" "$STAGING/apps" "$STAGING/lib"
mkdir -p "$PAYLOAD" "$DIST_DIR"

# ── 1. Bundle CLI to single file ─────────────────────────
echo "--- Bundling CLI ---"
# Read version from package.json and stamp it into the bundle
PKG_VERSION=$(node -e "process.stdout.write(require('$ROOT/package.json').version)")
echo "  Version: $PKG_VERSION"

npx esbuild \
  "$ROOT/cli/bin/reactjit.mjs" \
  --bundle \
  --platform=node \
  --format=esm \
  --target=es2020 \
  --define:"__REACTJIT_VERSION__=\"$PKG_VERSION\"" \
  --outfile="$STAGING/cli/reactjit.mjs"

# ── 2. Build storybook.love ──────────────────────────────
echo "--- Packaging storybook.love ---"
STORYBOOK_STAGING="/tmp/reactjit-storybook-love"
rm -rf "$STORYBOOK_STAGING"
mkdir -p "$STORYBOOK_STAGING/lua/audio/modules" \
         "$STORYBOOK_STAGING/lua/themes" \
         "$STORYBOOK_STAGING/lua/effects" \
         "$STORYBOOK_STAGING/lua/capabilities" \
         "$STORYBOOK_STAGING/love"

cp "$STORYBOOK_BUNDLE" "$STORYBOOK_STAGING/love/"
cp "$ROOT/packaging/storybook/main.lua" "$STORYBOOK_STAGING/"
cp "$ROOT/packaging/storybook/conf.lua" "$STORYBOOK_STAGING/"
cp "$ROOT"/lua/*.lua "$STORYBOOK_STAGING/lua/"
cp "$ROOT"/lua/audio/*.lua "$STORYBOOK_STAGING/lua/audio/"
cp "$ROOT"/lua/audio/modules/*.lua "$STORYBOOK_STAGING/lua/audio/modules/"
cp "$ROOT"/lua/themes/*.lua "$STORYBOOK_STAGING/lua/themes/"
cp "$ROOT"/lua/effects/*.lua "$STORYBOOK_STAGING/lua/effects/"
if [ -d "$ROOT/lua/capabilities" ]; then
  cp "$ROOT"/lua/capabilities/*.lua "$STORYBOOK_STAGING/lua/capabilities/"
fi

(cd "$STORYBOOK_STAGING" && zip -9 -r "$STAGING/apps/storybook.love" .)
rm -rf "$STORYBOOK_STAGING"

# ── 3. Collect Love2D binary ─────────────────────────────
echo "--- Collecting Love2D binary ---"
case "$PLATFORM" in
  linux-x64)
    LOVE_BIN=$(readlink -f "$(which love)" 2>/dev/null || true)
    if [ -z "$LOVE_BIN" ] || [ ! -f "$LOVE_BIN" ]; then
      echo "WARNING: Love2D not found. Storybook will not work." >&2
      echo "  Install love and rebuild, or users will need system love." >&2
    else
      cp "$LOVE_BIN" "$STAGING/apps/love"
      chmod +x "$STAGING/apps/love"

      # Bundle Love2D's shared libs
      ldd "$LOVE_BIN" | grep "=> /" | grep -v 'linux-vdso' | \
        awk '{print $1, $3}' | while read -r soname path; do
          real=$(readlink -f "$path")
          cp "$real" "$STAGING/lib/$soname"
        done

      # Bundle ld-linux
      cp "$(readlink -f /lib64/ld-linux-x86-64.so.2)" "$STAGING/lib/ld-linux-x86-64.so.2"
    fi
    ;;
  macos-*)
    # On macOS build agents, love is typically in /Applications or via brew
    LOVE_BIN=$(which love 2>/dev/null || true)
    if [ -n "$LOVE_BIN" ] && [ -f "$LOVE_BIN" ]; then
      cp "$LOVE_BIN" "$STAGING/apps/love"
      chmod +x "$STAGING/apps/love"
    else
      echo "WARNING: Love2D not found on this macOS host." >&2
    fi
    ;;
  windows-x64)
    # Windows: expect Love2D in vendor/ (downloaded by Makefile)
    LOVE_WIN_DIR="$ROOT/vendor/love-11.5-win64"
    if [ -d "$LOVE_WIN_DIR" ]; then
      cp "$LOVE_WIN_DIR/love.exe" "$STAGING/apps/love.exe"
      cp "$LOVE_WIN_DIR"/*.dll "$STAGING/lib/"
    else
      echo "WARNING: Love2D Windows binaries not found in vendor/." >&2
      echo "  Run: make dist-storybook-windows (downloads them)" >&2
    fi
    ;;
esac

# ── 4. Bundle libquickjs ─────────────────────────────────
echo "--- Bundling libquickjs ---"
if [ -f "$ROOT/cli/runtime/lib/libquickjs.so" ]; then
  cp "$ROOT/cli/runtime/lib/libquickjs.so" "$STAGING/lib/"
fi

# ── 5. Copy runtime ──────────────────────────────────────
echo "--- Copying runtime ---"
cp -r "$ROOT/cli/runtime/"* "$STAGING/runtime/"

# ── 6. Download Node.js (Full tier only) ─────────────────
if $EMBED_NODE; then
  echo "--- Downloading Node.js v${NODE_VERSION} for ${PLATFORM} ---"
  NODE_CACHE="/tmp/node-cache"
  mkdir -p "$NODE_CACHE"
  NODE_ARCHIVE="$NODE_CACHE/${NODE_SLUG}.${NODE_EXT}"

  if [ ! -f "$NODE_ARCHIVE" ]; then
    curl -fSL --progress-bar \
      "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_SLUG}.${NODE_EXT}" \
      -o "$NODE_ARCHIVE"
  else
    echo "  (cached)"
  fi

  # Extract just the node binary
  case "$NODE_EXT" in
    tar.gz)
      tar xzf "$NODE_ARCHIVE" -C "/tmp" "${NODE_SLUG}/${NODE_BIN_PATH}"
      cp "/tmp/${NODE_SLUG}/${NODE_BIN_PATH}" "$STAGING/node"
      chmod +x "$STAGING/node"
      rm -rf "/tmp/${NODE_SLUG}"
      ;;
    zip)
      unzip -qo "$NODE_ARCHIVE" "${NODE_SLUG}/${NODE_BIN_PATH}" -d "/tmp"
      cp "/tmp/${NODE_SLUG}/${NODE_BIN_PATH}" "$STAGING/node.exe"
      rm -rf "/tmp/${NODE_SLUG}"
      ;;
  esac

  echo "  Node.js: $(du -h "$STAGING/node"* | cut -f1)"
fi

# ── 7. Create launcher script ────────────────────────────
echo "--- Creating launcher ---"
case "$PLATFORM" in
  linux-x64)
    if $EMBED_NODE; then
      cat > "$STAGING/run" << 'LAUNCHER'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/lib/ld-linux-x86-64.so.2" --inhibit-cache \
  --library-path "$DIR/lib" \
  "$DIR/node" "$DIR/cli/reactjit.mjs" "$@"
LAUNCHER
    else
      cat > "$STAGING/run" << 'LAUNCHER'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE=$(command -v node 2>/dev/null)
if [ -z "$NODE" ]; then
  echo "Error: Node.js not found. Install Node.js or use the 'full' tier." >&2
  exit 1
fi
exec "$NODE" "$DIR/cli/reactjit.mjs" "$@"
LAUNCHER
    fi
    chmod +x "$STAGING/run"
    ;;
  macos-*)
    if $EMBED_NODE; then
      cat > "$STAGING/run" << 'LAUNCHER'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/node" "$DIR/cli/reactjit.mjs" "$@"
LAUNCHER
    else
      cat > "$STAGING/run" << 'LAUNCHER'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE=$(command -v node 2>/dev/null)
if [ -z "$NODE" ]; then
  echo "Error: Node.js not found. Install Node.js or use the 'full' tier." >&2
  exit 1
fi
exec "$NODE" "$DIR/cli/reactjit.mjs" "$@"
LAUNCHER
    fi
    chmod +x "$STAGING/run"
    ;;
  windows-x64)
    if $EMBED_NODE; then
      cat > "$STAGING/run.bat" << 'LAUNCHER'
@echo off
set DIR=%~dp0
"%DIR%\node.exe" "%DIR%\cli\reactjit.mjs" %*
LAUNCHER
    else
      cat > "$STAGING/run.bat" << 'LAUNCHER'
@echo off
set DIR=%~dp0
where node >nul 2>&1 || (echo Error: Node.js not found. Install Node.js or use the 'full' tier. & exit /b 1)
node "%DIR%\cli\reactjit.mjs" %*
LAUNCHER
    fi
    ;;
esac

# ── 8. Pack into distributable ────────────────────────────
BINARY_NAME="reactjit-${TIER}-${PLATFORM}${EXE_EXT}"
OUTPUT="$DIST_DIR/$BINARY_NAME"

echo "--- Packing ${BINARY_NAME} ---"

case "$PLATFORM" in
  linux-x64)
    # Self-extracting binary (shell stub + tar.gz)
    cd "$STAGING" && tar czf /tmp/reactjit-cli.tar.gz .

    cat > "$OUTPUT" << 'STUB'
#!/bin/sh
set -e
APP_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/reactjit-cli
SIG=$(md5sum "$0" 2>/dev/null | cut -c1-8 || cksum "$0" | cut -d" " -f1)
CACHE="$APP_DIR/$SIG"
if [ ! -f "$CACHE/.ready" ]; then
  rm -rf "$APP_DIR"
  mkdir -p "$CACHE"
  SKIP=$(awk '/^__ARCHIVE__$/{print NR + 1; exit}' "$0")
  tail -n+"$SKIP" "$0" | tar xz -C "$CACHE"
  touch "$CACHE/.ready"
fi
exec "$CACHE/run" "$@"
__ARCHIVE__
STUB
    cat /tmp/reactjit-cli.tar.gz >> "$OUTPUT"
    chmod +x "$OUTPUT"
    rm /tmp/reactjit-cli.tar.gz
    ;;

  macos-*)
    # Self-extracting binary (same pattern, works on macOS)
    cd "$STAGING" && tar czf /tmp/reactjit-cli.tar.gz .

    cat > "$OUTPUT" << 'STUB'
#!/bin/sh
set -e
APP_DIR="$HOME/.cache/reactjit-cli"
SIG=$(cksum "$0" | cut -d" " -f1)
CACHE="$APP_DIR/$SIG"
if [ ! -f "$CACHE/.ready" ]; then
  rm -rf "$APP_DIR"
  mkdir -p "$CACHE"
  SKIP=$(awk '/^__ARCHIVE__$/{print NR + 1; exit}' "$0")
  tail -n+"$SKIP" "$0" | tar xz -C "$CACHE"
  touch "$CACHE/.ready"
fi
exec "$CACHE/run" "$@"
__ARCHIVE__
STUB
    cat /tmp/reactjit-cli.tar.gz >> "$OUTPUT"
    chmod +x "$OUTPUT"
    rm /tmp/reactjit-cli.tar.gz
    ;;

  windows-x64)
    # Windows: tar.gz archive (user extracts manually or via installer)
    cd "$STAGING" && tar czf "$OUTPUT.tar.gz" .
    echo "  Windows: created ${BINARY_NAME}.tar.gz (extract and run run.bat)"
    # TODO: When rjit-launcher.exe exists, create proper .exe wrapper
    ;;
esac

# ── Cleanup ───────────────────────────────────────────────
rm -rf "$STAGING" "$PAYLOAD"

echo "=== Done: $OUTPUT ==="
echo "  Size: $(du -h "$OUTPUT"* | tail -1 | cut -f1)"
