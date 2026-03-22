#!/bin/bash
# edit-log.sh — PostToolUse hook for Edit/Write.
# Logs what actually changed so the supervisor can see spec violations
# even in large files.
#
# Edit: logs old_string → new_string diff (exact, from hook stdin)
# Write: logs full file contents up to 500 lines
#
# Output: appends to /run/user/$UID/claude-sessions/reactjit/.watch/edits.log

set +e

WATCH_DIR="/run/user/$(id -u)/claude-sessions/reactjit/.watch"
mkdir -p "$WATCH_DIR"
LOG="$WATCH_DIR/edits.log"

# Read hook stdin — extract all relevant fields
INPUT=$(cat)
eval "$(echo "$INPUT" | jq -r '
  @sh "SID=\(.session_id // "")",
  @sh "TOOL=\(.tool_name // "")",
  @sh "FILE=\((.tool_input // {}) | (.file_path // ""))",
  @sh "OLD_STR=\((.tool_input // {}) | (.old_string // ""))",
  @sh "NEW_STR=\((.tool_input // {}) | (.new_string // ""))",
  @sh "CONTENT=\((.tool_input // {}) | (.content // ""))"
')"

[ -z "$FILE" ] && exit 0
[ -z "$SID" ] && exit 0

SHORT="${SID:0:4}"
NOW=$(date +%H:%M:%S)

if [ "$TOOL" = "Edit" ]; then
    # Log the exact diff — old_string and new_string from stdin.
    # This works for files of any size since we only log what changed.
    cat >> "$LOG" <<ENTRY
=== [$NOW] Agent $SHORT — Edit: $FILE ===
--- REMOVED ---
$OLD_STR
--- ADDED ---
$NEW_STR
=== END ===

ENTRY

elif [ "$TOOL" = "Write" ]; then
    # Full file write — log content up to 500 lines
    TOTAL_LINES=$(echo "$CONTENT" | wc -l)
    if [ "$TOTAL_LINES" -le 500 ]; then
        BODY="$CONTENT"
    else
        BODY=$(echo "$CONTENT" | head -500)
        BODY="${BODY}
... [truncated — ${TOTAL_LINES} total lines, showing first 500]"
    fi

    cat >> "$LOG" <<ENTRY
=== [$NOW] Agent $SHORT — Write: $FILE ($TOTAL_LINES lines) ===
$BODY
=== END ===

ENTRY
fi

# Keep log from growing forever — trim to last 5000 lines
LOG_LINES=$(wc -l < "$LOG" 2>/dev/null || echo "0")
if [ "$LOG_LINES" -gt 5000 ]; then
    tail -4000 "$LOG" > "$LOG.tmp" && mv -f "$LOG.tmp" "$LOG"
    # Reset lastline counter since we trimmed
    echo "0" > "$WATCH_DIR/edits.lastline"
fi

exit 0
