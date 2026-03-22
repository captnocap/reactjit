#!/bin/bash
# ralph.sh — Message delivery daemon for standby Claude Code sessions.
#
# Runs in its own kitty pane (launched via kitten @ launch --keep-focus).
# Polls for wake requests, checks if the target pane is safe to inject into
# (not focused = user isn't typing there), and delivers via kitten @ send-text.
#
# Usage:
#   .claude/hooks/ralph.sh              # run in foreground
#   kitten @ launch --keep-focus --title Ralph .claude/hooks/ralph.sh  # launch as pane
#
# Wake files are written to $SESSIONS_DIR/.wake/<target_short>.json by send-message.sh
# when the target session hasn't pinged in >4 minutes (standby).

set -uo pipefail

SESSIONS_DIR="/run/user/$(id -u)/claude-sessions/reactjit"
WAKE_DIR="$SESSIONS_DIR/.wake"
POLL_INTERVAL=5        # seconds between checks
FOCUS_DEBOUNCE=15      # seconds to wait if target pane is focused
STANDBY_THRESHOLD=240  # 4 minutes — same as session-ping display threshold

mkdir -p "$WAKE_DIR"

# Find the kitty socket
find_kitty_sock() {
    local sock=""
    for s in /tmp/kitty-*; do
        [ -S "$s" ] && sock="$s" && break
    done
    echo "$sock"
}

KITTY_SOCK=$(find_kitty_sock)
if [ -z "$KITTY_SOCK" ]; then
    echo "[ralph] No kitty socket found. Is allow_remote_control enabled?"
    exit 1
fi

echo "[ralph] Started. Socket: $KITTY_SOCK"
echo "[ralph] Watching: $WAKE_DIR"
echo "[ralph] Poll interval: ${POLL_INTERVAL}s, focus debounce: ${FOCUS_DEBOUNCE}s"
echo ""

# Check if a kitty pane is focused
is_pane_focused() {
    local pane_id="$1"
    kitten @ --to "unix:$KITTY_SOCK" ls 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
pane_id = int(sys.argv[1])
for os_win in data:
    for tab in os_win.get('tabs', []):
        for win in tab.get('windows', []):
            if win['id'] == pane_id:
                print('focused' if win.get('is_focused') else 'unfocused')
                sys.exit(0)
print('missing')
" "$pane_id" 2>/dev/null
}

# Inject a message into a Claude pane
inject_message() {
    local pane_id="$1"
    local msg="$2"
    kitten @ --to "unix:$KITTY_SOCK" send-text --match "id:$pane_id" -- "${msg}\r" 2>/dev/null
}

# Main loop
while true; do
    for wake_file in "$WAKE_DIR"/*.json; do
        [ -f "$wake_file" ] || continue

        # Parse wake request
        WAKE_INFO=$(jq -r '{target_short:.target_short, target_sid:.target_sid, from:.from, msg:.msg, time:.time}' "$wake_file" 2>/dev/null) || {
            rm -f "$wake_file"
            continue
        }

        TARGET_SHORT=$(echo "$WAKE_INFO" | jq -r '.target_short')
        TARGET_SID=$(echo "$WAKE_INFO" | jq -r '.target_sid // ""')
        FROM=$(echo "$WAKE_INFO" | jq -r '.from')
        MSG=$(echo "$WAKE_INFO" | jq -r '.msg')
        WAKE_TIME=$(echo "$WAKE_INFO" | jq -r '.time')

        NOW=$(date +%s)
        WAKE_AGE=$(( NOW - WAKE_TIME ))

        # Expire old wake requests (5 min)
        if [ "$WAKE_AGE" -gt 300 ]; then
            echo "[ralph] Expired wake for $TARGET_SHORT (${WAKE_AGE}s old)"
            rm -f "$wake_file"
            continue
        fi

        # Find target session's kitty pane
        SESSION_FILE=""
        if [ -n "$TARGET_SID" ] && [ -f "$SESSIONS_DIR/$TARGET_SID.json" ]; then
            SESSION_FILE="$SESSIONS_DIR/$TARGET_SID.json"
        else
            # Search by short ID
            for sf in "$SESSIONS_DIR"/*.json; do
                [ -f "$sf" ] || continue
                S_SHORT=$(jq -r '.short // ""' "$sf" 2>/dev/null) || continue
                if [ "$S_SHORT" = "$TARGET_SHORT" ]; then
                    SESSION_FILE="$sf"
                    break
                fi
            done
        fi

        if [ -z "$SESSION_FILE" ]; then
            echo "[ralph] No session file for $TARGET_SHORT — removing wake"
            rm -f "$wake_file"
            continue
        fi

        PANE_ID=$(jq -r '.kitty_pane // ""' "$SESSION_FILE" 2>/dev/null)
        if [ -z "$PANE_ID" ]; then
            echo "[ralph] No kitty pane ID for $TARGET_SHORT — waiting"
            continue
        fi

        # Check if session is still on standby (hasn't woken up on its own)
        LAST_PING=$(jq -r '.ping // 0' "$SESSION_FILE" 2>/dev/null)
        PING_AGO=$(( NOW - LAST_PING ))
        if [ "$PING_AGO" -lt "$STANDBY_THRESHOLD" ]; then
            # Session woke up on its own — message will be delivered via hooks
            echo "[ralph] $TARGET_SHORT is active again (${PING_AGO}s ago) — removing wake"
            rm -f "$wake_file"
            continue
        fi

        # Check pane focus
        FOCUS=$(is_pane_focused "$PANE_ID")

        if [ "$FOCUS" = "focused" ]; then
            echo "[ralph] Pane $PANE_ID ($TARGET_SHORT) is focused — debouncing ${FOCUS_DEBOUNCE}s"
            sleep "$FOCUS_DEBOUNCE"

            # Re-check after debounce
            FOCUS=$(is_pane_focused "$PANE_ID")
            if [ "$FOCUS" = "focused" ]; then
                echo "[ralph] Still focused — skipping this cycle"
                continue
            fi
        fi

        if [ "$FOCUS" = "missing" ]; then
            echo "[ralph] Pane $PANE_ID not found — removing wake"
            rm -f "$wake_file"
            continue
        fi

        # Inject!
        INJECT_MSG="You have a message from Agent $FROM: $MSG"
        echo "[ralph] Injecting into pane $PANE_ID ($TARGET_SHORT): $INJECT_MSG"
        inject_message "$PANE_ID" "$INJECT_MSG"
        rm -f "$wake_file"
        echo "[ralph] Delivered and cleaned up"
    done

    sleep "$POLL_INTERVAL"
done
