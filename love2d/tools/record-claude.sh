#!/usr/bin/env bash
# Record a Claude Code session for SemanticTerminal playback.
# Run from monorepo root: bash tools/record-claude.sh
# When done: exit claude, then type 'exit' to stop recording.

set -e

TIMING="/tmp/claude_timing.txt"
OUTPUT="/tmp/claude_output.txt"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

rm -f "$TIMING" "$OUTPUT"

echo "=== SemanticTerminal Recorder ==="
echo "  This will launch claude inside a recorded session."
echo "  Do your thing (2-3 min is plenty), then:"
echo "    1. Exit claude (type /exit or Ctrl+C)"
echo "    2. Type 'exit' to stop the recording"
echo ""
echo "  Recording starts NOW."
echo ""

script --timing="$TIMING" -q "$OUTPUT" -c "claude"

echo ""
echo "  Recording stopped. Converting..."
echo ""

luajit "$SCRIPT_DIR/convert_script_recording.lua" "$TIMING" "$OUTPUT" "$PROJECT_ROOT/storybook/data/claude_session.rec.lua"

rm -f "$TIMING" "$OUTPUT"

echo ""
echo "  Done! Recording is at storybook/data/claude_session.rec.lua"
