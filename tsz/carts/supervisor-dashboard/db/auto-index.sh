#!/usr/bin/env bash
set -euo pipefail

# auto-index.sh — Watches for new/modified JSONL files and auto-ingests them
# Uses inotifywait if available, falls back to polling

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
WATCH_DIR="${CLAUDE_DIR}/projects"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
STATE_FILE="/run/user/${UID:-1000}/claude-sessions/.fts-index-state"
DB_PATH="/run/user/${UID:-1000}/claude-sessions/supervisor.db"

usage() {
    echo "Usage: $0 [--once] [--poll-interval <seconds>]"
    echo ""
    echo "Watches ~/.claude/projects/ for new JSONL files and auto-ingests them."
    echo ""
    echo "Options:"
    echo "  --once             Run one indexing pass and exit"
    echo "  --poll-interval N  Seconds between polls (default: 30, only for poll mode)"
    echo ""
    echo "Environment:"
    echo "  POLL_INTERVAL      Same as --poll-interval"
    exit 0
}

RUN_ONCE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --once)           RUN_ONCE=true; shift ;;
        --poll-interval)  POLL_INTERVAL="$2"; shift 2 ;;
        --help|-h)        usage ;;
        *)                echo "Unknown option: $1"; usage ;;
    esac
done

if [ ! -f "$DB_PATH" ]; then
    echo "Error: DB not found at $DB_PATH — run init.sh first"
    exit 1
fi

# Load state (last indexed timestamps per file)
load_state() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    fi
}

save_state() {
    echo "$1" > "$STATE_FILE"
}

# Index any files newer than our last run
index_new_files() {
    local state
    state=$(load_state)
    local new_state=""
    local indexed=0

    while IFS= read -r jsonl_file; do
        local mtime
        mtime=$(stat -c '%Y' "$jsonl_file" 2>/dev/null) || continue
        local key="${jsonl_file}:${mtime}"

        # Check if already indexed at this mtime
        if echo "$state" | grep -qF "$key" 2>/dev/null; then
            new_state="${new_state}${key}\n"
            continue
        fi

        # New or modified — re-ingest
        # First, remove old session for this file if it was modified
        local existing_session
        existing_session=$(sqlite3 "$DB_PATH" "SELECT id FROM sessions WHERE jsonl_path = '$(echo "$jsonl_file" | sed "s/'/''/g")' LIMIT 1;" 2>/dev/null)
        if [ -n "$existing_session" ]; then
            sqlite3 "$DB_PATH" "DELETE FROM messages WHERE session_id = ${existing_session}; DELETE FROM sessions WHERE id = ${existing_session};"
        fi

        # Ingest via fts-search.sh
        "${SCRIPT_DIR}/fts-search.sh" index-all > /dev/null 2>&1 || true
        indexed=$((indexed + 1))
        new_state="${new_state}${key}\n"
    done < <(find "$WATCH_DIR" -name "*.jsonl" -not -path "*/subagents/*" -type f 2>/dev/null)

    save_state "$(echo -e "$new_state")"

    if [ "$indexed" -gt 0 ]; then
        echo "[$(date -u '+%H:%M:%S')] Indexed ${indexed} new/modified files"
    fi
}

echo "FTS auto-indexer started (watching ${WATCH_DIR})"

if $RUN_ONCE; then
    index_new_files
    echo "Done."
    exit 0
fi

# Try inotifywait first (much more efficient)
if command -v inotifywait &>/dev/null; then
    echo "Using inotifywait for file watching"

    # Initial index pass
    index_new_files

    # Watch for new/modified JSONL files
    while true; do
        inotifywait -r -q -e create -e modify -e moved_to \
            --include '\.jsonl$' \
            --exclude 'subagents' \
            "$WATCH_DIR" 2>/dev/null || true

        # Brief debounce — files may still be written
        sleep 2
        index_new_files
    done
else
    echo "inotifywait not found — falling back to polling every ${POLL_INTERVAL}s"

    while true; do
        index_new_files
        sleep "$POLL_INTERVAL"
    done
fi
