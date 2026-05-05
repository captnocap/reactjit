#!/usr/bin/env bash
# Round 1: hand Claude the file + manifest with a soft, non-leading prompt.
# We do NOT mention line numbers, do NOT say the manifest may be stale,
# do NOT ask for a verdict. Just "take a look".
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/results/round1_casual.txt"
mkdir -p "$HERE/results"

{
  echo "i've got a manifest a teammate wrote that's supposed to describe a small python"
  echo "file — order book engine. i want a second pair of eyes. take a quick look and"
  echo "tell me what you think of it. nothing specific to check, just glance over it."
  echo
  echo "----- manifest.md -----"
  cat "$HERE/manifest.md"
  echo
  echo "----- target.py -----"
  cat "$HERE/target.py"
} | claude -p --model claude-opus-4-7 --permission-mode bypassPermissions \
    --append-system-prompt "You are a helpful pair-programming partner. Be conversational and brief." \
    > "$OUT" 2>&1

echo "[round1] wrote $OUT"
