#!/usr/bin/env bash
# Build the rjit-llm-worker subprocess used by framework/local_ai_runtime.zig.
#
# Background:
# - The worker exists as a separate process so it owns its own VkInstance —
#   ggml-vulkan inference would otherwise fight the renderer's wgpu/Vulkan
#   pipeline and crash. Several days of debugging led to this isolation.
# - Until now the build command was oral tradition: a one-shot g++ invocation
#   from a previous Claude session, never persisted. This script captures it
#   so we can rebuild reliably.
# - Talks to the host over a tiny line protocol (LOAD/CHAT/READY/TOK/DONE/ERR).
#   See framework/ffi/llm_worker.cpp.
#
# Output: zig-out/bin/rjit-llm-worker (linked against deps/llama.cpp-fresh).
#
# Add `--with-tools` later to also link common/chat.cpp + minja for tool
# calling. For now this rebuilds the existing minimal worker exactly as it is.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LLAMA_DIR="$REPO_ROOT/deps/llama.cpp-fresh"
LLAMA_BUILD="$LLAMA_DIR/build/bin"
HEADERS="$REPO_ROOT/framework/ffi/llama_headers"
SRC="$REPO_ROOT/framework/ffi/llm_worker.cpp"
OUT="$REPO_ROOT/zig-out/bin/rjit-llm-worker"

if [[ ! -d "$LLAMA_BUILD" ]]; then
    echo "[build-llm-worker] llama.cpp build dir missing: $LLAMA_BUILD" >&2
    echo "[build-llm-worker] You need an upstream llama.cpp checkout built at deps/llama.cpp-fresh." >&2
    exit 1
fi

if [[ ! -f "$LLAMA_BUILD/libllama.so" ]] && [[ ! -f "$LLAMA_BUILD/libllama.so.0" ]]; then
    echo "[build-llm-worker] no libllama.so in $LLAMA_BUILD" >&2
    exit 1
fi

mkdir -p "$(dirname "$OUT")"

echo "[build-llm-worker] g++ -> $OUT"
# llama-common is upstream's umbrella for chat.cpp + minja Jinja + the
# per-model tool-call parsers (Qwen / Hermes / Mistral / Llama-3 / etc).
# Linked unconditionally so common_chat_templates_apply / common_chat_parse_*
# are available; whether llm_worker.cpp actually CALLS them is a separate
# step. Order: common first because it depends on llama, llama on ggml.
g++ -O2 -std=c++17 \
    -I "$HEADERS" \
    -I "$LLAMA_DIR/include" \
    -I "$LLAMA_DIR/common" \
    -I "$LLAMA_DIR/vendor" \
    "$SRC" \
    -L "$LLAMA_BUILD" \
    -Wl,--no-as-needed -lllama-common -Wl,--as-needed \
    -lllama -lggml \
    -Wl,-rpath,"$LLAMA_BUILD" \
    -o "$OUT"

ls -la "$OUT"
echo "[build-llm-worker] OK"
