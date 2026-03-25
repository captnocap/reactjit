#!/bin/bash
# Supervisor dashboard hook — logs session activity to the supervisor SQLite DB.
# Called on SessionStart, Stop, PreToolUse (Edit/Write/Bash), PostToolUse.
# Fast path: single sqlite3 INSERT, no output (doesn't inject context).

set +e

DB="/run/user/$(id -u)/claude-sessions/supervisor.db"
[ -f "$DB" ] || exit 0

SQLITE3="${SQLITE3:-$(command -v sqlite3 2>/dev/null || echo /home/siah/miniconda3/bin/sqlite3)}"
[ -x "$SQLITE3" ] || exit 0

INPUT=$(cat)
eval "$(echo "$INPUT" | jq -r '
  @sh "SID=\(.session_id // "")",
  @sh "HOOK=\(.hook_event_name // "")",
  @sh "TOOL=\(.tool_name // "")",
  @sh "FPATH=\((.tool_input // {}) | (.file_path // .path // .pattern // .command // ""))"
' 2>/dev/null)" || exit 0

[ -z "$SID" ] && exit 0
SHORT="${SID:0:4}"

# Strip repo root for compact paths
REPO="/home/siah/creative/reactjit/"
DISPLAY_PATH="${FPATH#$REPO}"
[ "$DISPLAY_PATH" = "$FPATH" ] && DISPLAY_PATH="$FPATH"

# Resolve project ID (cached after first call)
PID=$("$SQLITE3" "$DB" "SELECT id FROM projects WHERE name = 'reactjit';" 2>/dev/null)
[ -z "$PID" ] && exit 0

# Find or create worker for this session
get_or_create_worker() {
    local wid
    wid=$("$SQLITE3" "$DB" "SELECT id FROM workers WHERE session_id = '${SHORT}' AND project_id = ${PID};" 2>/dev/null)
    if [ -z "$wid" ]; then
        # Try to detect tmux pane
        local pane_id=0
        if [ -n "$TMUX_PANE" ]; then
            pane_id="${TMUX_PANE#%}"
        fi
        "$SQLITE3" "$DB" "INSERT INTO workers (project_id, pane_id, session_id, status) VALUES (${PID}, ${pane_id}, '${SHORT}', 'active');" 2>/dev/null
        wid=$("$SQLITE3" "$DB" "SELECT last_insert_rowid();" 2>/dev/null)
    fi
    echo "$wid"
}

case "$HOOK" in
    SessionStart)
        WID=$(get_or_create_worker)
        "$SQLITE3" "$DB" "
            UPDATE workers SET status = 'active', last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${WID};
            INSERT INTO events (project_id, worker_id, event_type, payload_json)
            VALUES (${PID}, ${WID}, 'session_start', '{\"session\":\"${SHORT}\"}');
        " 2>/dev/null
        ;;

    Stop)
        WID=$("$SQLITE3" "$DB" "SELECT id FROM workers WHERE session_id = '${SHORT}' AND project_id = ${PID};" 2>/dev/null)
        [ -n "$WID" ] && "$SQLITE3" "$DB" "
            UPDATE workers SET status = 'idle', last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${WID};
            INSERT INTO events (project_id, worker_id, event_type, payload_json)
            VALUES (${PID}, ${WID}, 'stop', '{\"session\":\"${SHORT}\"}');
        " 2>/dev/null
        ;;

    PreToolUse)
        # Only log significant tool uses
        case "$TOOL" in
            Edit|Write|Bash)
                WID=$("$SQLITE3" "$DB" "SELECT id FROM workers WHERE session_id = '${SHORT}' AND project_id = ${PID};" 2>/dev/null)
                if [ -z "$WID" ]; then
                    WID=$(get_or_create_worker)
                fi
                PAYLOAD=$(jq -n --arg t "$TOOL" --arg f "$DISPLAY_PATH" '{tool:$t,file:$f}' 2>/dev/null)
                PAYLOAD_ESC=$(printf '%s' "$PAYLOAD" | sed "s/'/''/g")
                "$SQLITE3" "$DB" "
                    UPDATE workers SET status = 'active', last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                    WHERE id = ${WID};
                    INSERT INTO events (project_id, worker_id, event_type, payload_json)
                    VALUES (${PID}, ${WID}, 'tool_use', '${PAYLOAD_ESC}');
                " 2>/dev/null
                ;;
        esac
        ;;

    PostToolUse)
        # Just update last_seen, don't log every post (too noisy)
        WID=$("$SQLITE3" "$DB" "SELECT id FROM workers WHERE session_id = '${SHORT}' AND project_id = ${PID};" 2>/dev/null)
        [ -n "$WID" ] && "$SQLITE3" "$DB" "
            UPDATE workers SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${WID};
        " 2>/dev/null
        ;;
esac

# No output — this hook is fire-and-forget, doesn't inject context
exit 0
