#!/bin/bash
# Send a message to another Claude session (or all sessions).
#
# Usage:
#   send-message.sh <from_short> <target> <message>
#
#   from_short: your own 4-char session ID (shown in hook context as "You are session XXXX")
#   target:     4-char short session ID of recipient, or "all" for global broadcast
#   message:    the text to deliver
#
# Examples:
#   send-message.sh 32bb 4b92 "I fixed the layout bug in canvas.zig, re-read it"
#   send-message.sh 32bb all  "I'm about to refactor the compiler — hold off on actions.zig"

set -euo pipefail

SESSIONS_DIR="/run/user/$(id -u)/claude-sessions/reactjit"
MESSAGES_DIR="$SESSIONS_DIR/messages"
mkdir -p "$MESSAGES_DIR"

SENDER_SHORT="${1:-}"
TARGET="${2:-}"
MESSAGE="${3:-}"

if [ -z "$SENDER_SHORT" ] || [ -z "$TARGET" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: send-message.sh <from_short> <target|all> <message>" >&2
  exit 1
fi

NOW=$(date +%s)
MSGID="${NOW}_$$"

# Resolve sender short to full SID for skip-self logic in delivery
SENDER_SID=""
for f in "$SESSIONS_DIR"/*.json; do
  [ -f "$f" ] || continue
  S_SHORT=$(jq -r '.short // ""' "$f" 2>/dev/null) || continue
  if [ "$S_SHORT" = "$SENDER_SHORT" ]; then
    SENDER_SID=$(jq -r '.sid // ""' "$f" 2>/dev/null)
    break
  fi
done

if [ "$TARGET" = "all" ]; then
  # Global message — one file, picked up by all sessions except sender
  jq -n \
    --arg from "$SENDER_SHORT" \
    --arg from_sid "$SENDER_SID" \
    --arg to "all" \
    --arg msg "$MESSAGE" \
    --argjson time "$NOW" \
    '{from:$from, from_sid:$from_sid, to:$to, msg:$msg, time:$time}' \
    > "$MESSAGES_DIR/global_${SENDER_SHORT}_${MSGID}.json"
  echo "Global message sent to all sessions."
else
  # Targeted message — resolve short ID to full SID
  FOUND=""
  for f in "$SESSIONS_DIR"/*.json; do
    [ -f "$f" ] || continue
    S_SHORT=$(jq -r '.short // ""' "$f" 2>/dev/null) || continue
    if [ "$S_SHORT" = "$TARGET" ]; then
      FOUND=$(basename "$f" .json)
      break
    fi
  done

  if [ -z "$FOUND" ]; then
    echo "No active session found with short ID '$TARGET'." >&2
    echo "Active sessions:" >&2
    for f in "$SESSIONS_DIR"/*.json; do
      [ -f "$f" ] || continue
      jq -r '"  \(.short) — \(.tool // "idle") \(.file // "")"' "$f" 2>/dev/null
    done >&2
    exit 1
  fi

  jq -n \
    --arg from "$SENDER_SHORT" \
    --arg from_sid "$SENDER_SID" \
    --arg to "$TARGET" \
    --arg to_sid "$FOUND" \
    --arg msg "$MESSAGE" \
    --argjson time "$NOW" \
    '{from:$from, from_sid:$from_sid, to:$to, to_sid:$to_sid, msg:$msg, time:$time}' \
    > "$MESSAGES_DIR/to_${TARGET}_${MSGID}.json"
  echo "Message sent to session $TARGET."
fi
