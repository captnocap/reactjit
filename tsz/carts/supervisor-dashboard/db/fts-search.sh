#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/run/user/${UID:-1000}/claude-sessions/supervisor.db"
CLAUDE_DIR="$HOME/.claude"

usage() {
    cat <<'EOF'
Usage:
  fts-search.sh search <query> [--project <name>] [--since <date>] [--limit <n>]
  fts-search.sh index-all [--project <name>]
  fts-search.sh stats

Commands:
  search      Full-text search across all conversation messages
  index-all   Find and ingest all JSONL conversation files from ~/.claude/
  stats       Show index size, message count, project breakdown
EOF
    exit 1
}

[ $# -lt 1 ] && usage

ensure_db() {
    if [ ! -f "$DB_PATH" ]; then
        echo "Error: DB not found at $DB_PATH — run init.sh first"
        exit 1
    fi
}

# Derive a project name from a JSONL path like:
#   ~/.claude/projects/-home-siah-creative-reactjit/UUID.jsonl
#   -> reactjit
path_to_project() {
    local p="$1"
    local dir_name
    dir_name=$(basename "$(dirname "$p")")
    # Strip the leading path-encoded prefix, take last segment
    echo "$dir_name" | sed 's/^-home-[^-]*-//' | sed 's/^-home-[^-]*$/home/' | rev | cut -d'-' -f1 | rev
}

# Ingest a single JSONL file into the DB using bulk jq + sqlite3
ingest_file() {
    local jsonl_file="$1"
    local project_name="$2"

    # Check if already ingested
    local existing
    existing=$(sqlite3 "$DB_PATH" "SELECT id FROM sessions WHERE jsonl_path = '$(echo "$jsonl_file" | sed "s/'/''/g")' LIMIT 1;" 2>/dev/null)
    if [ -n "$existing" ]; then
        return 0  # Already ingested
    fi

    # Ensure project exists
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO projects (name) VALUES ('$(echo "$project_name" | sed "s/'/''/g")');"
    local project_id
    project_id=$(sqlite3 "$DB_PATH" "SELECT id FROM projects WHERE name = '$(echo "$project_name" | sed "s/'/''/g")';")

    # Create session and get ID in one connection
    local session_id
    session_id=$(sqlite3 "$DB_PATH" "INSERT INTO sessions (project_id, jsonl_path) VALUES (${project_id}, '$(echo "$jsonl_file" | sed "s/'/''/g")'); SELECT last_insert_rowid();")

    # All-Python ingestion — handles all content types safely
    local count
    count=$(python3 -c "
import sys, json, sqlite3

def extract_text(msg):
    content = msg.get('message', {}).get('content', '')
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get('type') == 'text':
                    parts.append(item.get('text', ''))
                elif item.get('type') == 'tool_result':
                    sub = item.get('content', '')
                    if isinstance(sub, list):
                        for s in sub:
                            if isinstance(s, dict) and s.get('type') == 'text':
                                parts.append(s.get('text', ''))
                    elif isinstance(sub, str):
                        parts.append(sub)
        return ' '.join(parts)
    return ''

db = sqlite3.connect('$DB_PATH')
cur = db.cursor()
cur.execute('BEGIN')
n = 0
with open('$jsonl_file') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except:
            continue
        t = rec.get('type', '')
        if t not in ('user', 'assistant'):
            continue
        role = 'human' if t == 'user' else 'assistant'
        text = extract_text(rec)
        if not text.strip():
            continue
        ts = rec.get('timestamp', '')
        cur.execute('INSERT INTO messages(session_id,role,content,timestamp) VALUES(?,?,?,?)',
                    ($session_id, role, text, ts))
        n += 1
db.commit()
db.close()
print(n)
" 2>&1)

    if [ -n "$count" ] && [ "$count" -gt 0 ] 2>/dev/null; then
        sqlite3 "$DB_PATH" "UPDATE sessions SET started_at = COALESCE((SELECT MIN(timestamp) FROM messages WHERE session_id = ${session_id}), started_at), ended_at = (SELECT MAX(timestamp) FROM messages WHERE session_id = ${session_id}) WHERE id = ${session_id};"
        echo "  ${jsonl_file##*/}: ${count} messages (project: ${project_name})"
    fi
}

cmd_search() {
    ensure_db
    local query=""
    local project=""
    local since=""
    local limit=20

    while [ $# -gt 0 ]; do
        case "$1" in
            --project) project="$2"; shift 2 ;;
            --since)   since="$2"; shift 2 ;;
            --limit)   limit="$2"; shift 2 ;;
            *)         query="${query:+$query }$1"; shift ;;
        esac
    done

    [ -z "$query" ] && { echo "Error: no search query"; usage; }

    # Build WHERE clause for filters
    local where_extra=""
    if [ -n "$project" ]; then
        where_extra="${where_extra} AND p.name = '$(echo "$project" | sed "s/'/''/g")'"
    fi
    if [ -n "$since" ]; then
        where_extra="${where_extra} AND m.timestamp >= '${since}'"
    fi

    # FTS5 search with context
    sqlite3 -header -column "$DB_PATH" "
        SELECT
            m.id,
            m.role,
            substr(m.content, 1, 200) AS content_preview,
            m.timestamp,
            p.name AS project,
            s.jsonl_path
        FROM messages_fts fts
        JOIN messages m ON m.id = fts.rowid
        JOIN sessions s ON s.id = m.session_id
        JOIN projects p ON p.id = s.project_id
        WHERE messages_fts MATCH '$(echo "$query" | sed "s/'/''/g")'
        ${where_extra}
        ORDER BY rank
        LIMIT ${limit};
    "
}

cmd_index_all() {
    ensure_db
    local filter_project="${1:-}"
    local total_files=0
    local total_new=0

    echo "Scanning ${CLAUDE_DIR}/projects/ for JSONL files..."

    # Find all conversation JSONL files (skip subagents)
    while IFS= read -r jsonl_file; do
        total_files=$((total_files + 1))
        local project_name
        if [ -n "$filter_project" ]; then
            project_name="$filter_project"
        else
            project_name=$(path_to_project "$jsonl_file")
        fi
        ingest_file "$jsonl_file" "$project_name" && total_new=$((total_new + 1))
    done < <(find "${CLAUDE_DIR}/projects/" -name "*.jsonl" -not -path "*/subagents/*" -type f 2>/dev/null)

    # Also index ~/.claude/history.jsonl if it exists
    if [ -f "${CLAUDE_DIR}/history.jsonl" ]; then
        total_files=$((total_files + 1))
        ingest_file "${CLAUDE_DIR}/history.jsonl" "global"
    fi

    echo ""
    echo "Scanned ${total_files} files."

    # Show current stats
    cmd_stats
}

cmd_stats() {
    ensure_db
    echo "=== FTS Search Index Stats ==="
    echo ""

    local msg_count
    msg_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM messages;")
    local session_count
    session_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;")
    local fts_count
    fts_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM messages_fts;")

    echo "Messages:  ${msg_count}"
    echo "Sessions:  ${session_count}"
    echo "FTS rows:  ${fts_count}"
    echo ""

    local db_size
    db_size=$(du -h "$DB_PATH" 2>/dev/null | cut -f1)
    echo "DB size:   ${db_size}"
    echo ""

    echo "--- Project Breakdown ---"
    sqlite3 -header -column "$DB_PATH" "
        SELECT
            p.name AS project,
            COUNT(DISTINCT s.id) AS sessions,
            COUNT(m.id) AS messages,
            MIN(m.timestamp) AS earliest,
            MAX(m.timestamp) AS latest
        FROM projects p
        LEFT JOIN sessions s ON s.project_id = p.id
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY p.id
        ORDER BY messages DESC;
    "
}

case "$1" in
    search)
        shift
        cmd_search "$@"
        ;;
    index-all)
        shift
        cmd_index_all "${1:-}"
        ;;
    stats)
        cmd_stats
        ;;
    *)
        usage
        ;;
esac
