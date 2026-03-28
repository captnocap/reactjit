#!/bin/bash
# Build QuickJS host as a standalone echo/http server binary
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QJS_PREFIX="/tmp/quickjs-local"

if [ ! -f "$QJS_PREFIX/lib/libqjs.a" ]; then
    echo "ERROR: QuickJS not built. Run the QuickJS build first."
    exit 1
fi

# Build echo server
cc -O2 -o "$SCRIPT_DIR/qjs_echo_server" \
    -DSERVER_MODE=1 \
    "$SCRIPT_DIR/server_main.c" \
    "$SCRIPT_DIR/host.c" \
    -I"$QJS_PREFIX/include" \
    -L"$QJS_PREFIX/lib" \
    -lqjs -lm -lpthread

# Build HTTP server
cc -O2 -o "$SCRIPT_DIR/qjs_http_server" \
    -DSERVER_MODE=2 \
    "$SCRIPT_DIR/server_main.c" \
    "$SCRIPT_DIR/host.c" \
    -I"$QJS_PREFIX/include" \
    -L"$QJS_PREFIX/lib" \
    -lqjs -lm -lpthread

echo "QuickJS servers built."
