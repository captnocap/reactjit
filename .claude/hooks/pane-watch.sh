#!/bin/bash
# pane-watch.sh — Watch a kitty pane and emit deltas.
#
# Captures the screen buffer on an interval, diffs against last capture,
# outputs only new lines. Maintains a full append-only log for search.
#
# Usage:
#   pane-watch.sh <pane_id> [interval_secs]
#
# Output:
#   Prints new lines to stdout each tick.
#   Full log: $STATE_DIR/<pane_id>.full.log
#   Last snapshot: $STATE_DIR/<pane_id>.last

set -uo pipefail

PANE_ID="${1:?Usage: pane-watch.sh <pane_id> [interval_secs]}"
INTERVAL="${2:-30}"

STATE_DIR="/run/user/$(id -u)/claude-sessions/reactjit/.watch"
mkdir -p "$STATE_DIR"

FULL_LOG="$STATE_DIR/${PANE_ID}.full.log"
LAST_SNAP="$STATE_DIR/${PANE_ID}.last"
LAST_LINES_FILE="$STATE_DIR/${PANE_ID}.linecount"

# Find kitty socket
KITTY_SOCK=""
for s in /tmp/kitty-*; do
    [ -S "$s" ] && KITTY_SOCK="$s" && break
done
if [ -z "$KITTY_SOCK" ]; then
    echo "[watch] No kitty socket found" >&2
    exit 1
fi

# Initialize
touch "$FULL_LOG" "$LAST_SNAP"
echo "0" > "$LAST_LINES_FILE" 2>/dev/null

echo "[watch] Watching pane $PANE_ID every ${INTERVAL}s"
echo "[watch] Full log: $FULL_LOG"
echo ""

while true; do
    # Capture current buffer (full scrollback + visible)
    CURRENT=$(kitten @ --to "unix:$KITTY_SOCK" get-text --match "id:$PANE_ID" --extent all 2>/dev/null) || {
        echo "[watch] Failed to read pane $PANE_ID" >&2
        sleep "$INTERVAL"
        continue
    }

    CURRENT_LINES=$(echo "$CURRENT" | wc -l)
    LAST_LINES=$(cat "$LAST_LINES_FILE" 2>/dev/null || echo "0")

    if [ "$CURRENT_LINES" -gt "$LAST_LINES" ]; then
        # Extract only the new lines
        DELTA=$(echo "$CURRENT" | tail -n +"$(( LAST_LINES + 1 ))")

        # Append to full log
        echo "$DELTA" >> "$FULL_LOG"

        # Output delta
        TIMESTAMP=$(date +%H:%M:%S)
        echo "--- [$TIMESTAMP] +$(( CURRENT_LINES - LAST_LINES )) new lines from pane $PANE_ID ---"
        echo "$DELTA"
        echo ""

        # Update snapshot
        echo "$CURRENT" > "$LAST_SNAP"
        echo "$CURRENT_LINES" > "$LAST_LINES_FILE"
    fi

    sleep "$INTERVAL"
done
