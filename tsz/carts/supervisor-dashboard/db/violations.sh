#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-/run/user/${UID:-1000}/claude-sessions/supervisor.db}"
SQLITE3="${SQLITE3:-$(command -v sqlite3 2>/dev/null || echo /home/siah/miniconda3/bin/sqlite3)}"

sql()  { "$SQLITE3" "$DB_PATH" "$1"; }
sqlh() { "$SQLITE3" -header -column "$DB_PATH" "$1"; }
sqlj() { "$SQLITE3" -json "$DB_PATH" "$1"; }

esc() { printf '%s' "$1" | sed "s/'/''/g"; }
ts_now() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

ensure_db() {
    if [ ! -f "$DB_PATH" ]; then
        echo "Error: DB not found at $DB_PATH" >&2
        exit 1
    fi
}

resolve_project() {
    local name="$1"
    local pid
    pid=$(sql "SELECT id FROM projects WHERE name = '$(esc "$name")';")
    if [ -z "$pid" ]; then
        echo "Error: Project '${name}' not found" >&2
        exit 1
    fi
    echo "$pid"
}

usage() {
    cat <<'HELP'
Usage: violations.sh <command> [args...]

Commands:
  add <project> <name> <pattern> [--action flag|pause|deny] [--description "text"]
                                     Add a violation rule (regex pattern)
  list [project]                     List active violation rules
  delete <id>                        Delete a violation rule
  enable <id>                        Enable a disabled rule
  disable <id>                       Disable a rule without deleting
  check <text>                       Test text against all active rules
  check-file <file_path> [task_id]   Check if a file edit violates any boundary rules
  log [--limit N]                    Show recent violation log entries
  log-add <rule_id> <matched_text> [--worker N] [--task N]
                                     Manually log a violation
  resolve <log_id>                   Mark a violation log entry as resolved
  json [project]                     Rules + recent violations as JSON
  seed <project>                     Seed default supervisor rules

HELP
    exit 1
}

ensure_db

[ $# -lt 1 ] && usage

CMD="$1"
shift

case "$CMD" in
    add)
        [ $# -lt 3 ] && { echo "Usage: violations.sh add <project> <name> <pattern> [--action ...] [--description ...]" >&2; exit 1; }
        PID=$(resolve_project "$1")
        NAME_E=$(esc "$2")
        PATTERN_E=$(esc "$3")
        shift 3
        ACTION="flag"; DESC=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --action) shift; [ $# -gt 0 ] && ACTION="$1" ;;
                --description) shift; [ $# -gt 0 ] && DESC=$(esc "$1") ;;
            esac
            [ $# -gt 0 ] && shift
        done
        case "$ACTION" in
            flag|pause|deny) ;;
            *) echo "Error: Action must be flag, pause, or deny" >&2; exit 1 ;;
        esac
        NEW_ID=$("$SQLITE3" "$DB_PATH" "INSERT INTO violation_rules (project_id, name, pattern, action, description)
             VALUES (${PID}, '${NAME_E}', '${PATTERN_E}', '${ACTION}', '${DESC}');
             SELECT last_insert_rowid();")
        echo "Added violation rule #${NEW_ID}: ${2}"
        ;;

    list)
        PROJECT_FILTER=""
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            PROJECT_FILTER="AND r.project_id = ${PID}"
        fi
        sqlh "SELECT r.id, p.name AS project, r.name, r.pattern, r.action,
                     CASE r.enabled WHEN 1 THEN 'on' ELSE 'off' END AS enabled,
                     r.description,
                     (SELECT count(*) FROM violation_log l WHERE l.rule_id = r.id) AS hits,
                     substr(r.created_at, 1, 16) AS created
              FROM violation_rules r
              JOIN projects p ON p.id = r.project_id
              WHERE 1=1 ${PROJECT_FILTER}
              ORDER BY r.id;"
        ;;

    delete)
        [ $# -lt 1 ] && { echo "Usage: violations.sh delete <id>" >&2; exit 1; }
        sql "DELETE FROM violation_rules WHERE id = $1;"
        echo "Deleted violation rule #$1"
        ;;

    enable)
        [ $# -lt 1 ] && { echo "Usage: violations.sh enable <id>" >&2; exit 1; }
        sql "UPDATE violation_rules SET enabled = 1 WHERE id = $1;"
        echo "Enabled violation rule #$1"
        ;;

    disable)
        [ $# -lt 1 ] && { echo "Usage: violations.sh disable <id>" >&2; exit 1; }
        sql "UPDATE violation_rules SET enabled = 0 WHERE id = $1;"
        echo "Disabled violation rule #$1"
        ;;

    check)
        [ $# -lt 1 ] && { echo "Usage: violations.sh check <text>" >&2; exit 1; }
        TEXT="$1"
        # Get all enabled rules and check against them with grep -P
        VIOLATIONS=0
        while IFS='|' read -r rid rname rpattern raction rdesc; do
            [ -z "$rid" ] && continue
            if printf '%s' "$TEXT" | grep -qP "$rpattern" 2>/dev/null; then
                VIOLATIONS=$((VIOLATIONS + 1))
                printf '\033[31m✗ VIOLATION\033[0m [%s] Rule #%s "%s" — pattern: %s\n' "$raction" "$rid" "$rname" "$rpattern"
                [ -n "$rdesc" ] && printf '  → %s\n' "$rdesc"
            fi
        done < <(sql "SELECT id, name, pattern, action, description FROM violation_rules WHERE enabled = 1;")
        if [ "$VIOLATIONS" -eq 0 ]; then
            printf '\033[32m✓ No violations\033[0m\n'
        else
            printf '\n%d violation(s) found\n' "$VIOLATIONS"
            exit 1
        fi
        ;;

    check-file)
        [ $# -lt 1 ] && { echo "Usage: violations.sh check-file <file_path> [task_id]" >&2; exit 1; }
        FILE_PATH="$1"
        TASK_ID="${2:-}"
        VIOLATIONS=0

        # Check file path against all boundary-related rules
        while IFS='|' read -r rid rname rpattern raction rdesc; do
            [ -z "$rid" ] && continue
            if printf '%s' "$FILE_PATH" | grep -qP "$rpattern" 2>/dev/null; then
                VIOLATIONS=$((VIOLATIONS + 1))
                printf '\033[31m✗ VIOLATION\033[0m [%s] Rule #%s "%s" — file: %s\n' "$raction" "$rid" "$rname" "$FILE_PATH"
                [ -n "$rdesc" ] && printf '  → %s\n' "$rdesc"
                # Auto-log the violation
                WORKER_CLAUSE="NULL"
                TASK_CLAUSE="NULL"
                [ -n "$TASK_ID" ] && TASK_CLAUSE="$TASK_ID"
                sql "INSERT INTO violation_log (rule_id, worker_id, task_id, matched_text, action_taken)
                     VALUES (${rid}, ${WORKER_CLAUSE}, ${TASK_CLAUSE}, '$(esc "$FILE_PATH")', '${raction}');"
            fi
        done < <(sql "SELECT id, name, pattern, action, description FROM violation_rules WHERE enabled = 1;")

        # If task has file_boundaries, check against those too
        if [ -n "$TASK_ID" ]; then
            BOUNDARIES=$(sql "SELECT file_boundaries FROM tasks WHERE id = ${TASK_ID};")
            if [ -n "$BOUNDARIES" ] && [ "$BOUNDARIES" != "[]" ]; then
                IN_BOUNDS=0
                # Parse JSON array of paths and check if file is within any
                while IFS= read -r bound; do
                    bound=$(printf '%s' "$bound" | tr -d '"' | tr -d ' ')
                    [ -z "$bound" ] && continue
                    case "$FILE_PATH" in
                        ${bound}*) IN_BOUNDS=1 ;;
                    esac
                done < <(printf '%s' "$BOUNDARIES" | tr -d '[]' | tr ',' '\n')
                if [ "$IN_BOUNDS" -eq 0 ]; then
                    VIOLATIONS=$((VIOLATIONS + 1))
                    printf '\033[31m✗ BOUNDARY VIOLATION\033[0m File "%s" is outside task #%s boundaries: %s\n' "$FILE_PATH" "$TASK_ID" "$BOUNDARIES"
                    sql "INSERT INTO violation_log (rule_id, task_id, matched_text, action_taken)
                         VALUES (0, ${TASK_ID}, '$(esc "BOUNDARY: $FILE_PATH outside $BOUNDARIES")', 'flag');" 2>/dev/null || true
                fi
            fi
        fi

        if [ "$VIOLATIONS" -eq 0 ]; then
            printf '\033[32m✓ File OK\033[0m %s\n' "$FILE_PATH"
        else
            printf '\n%d violation(s) for %s\n' "$VIOLATIONS" "$FILE_PATH"
            exit 1
        fi
        ;;

    log)
        LIMIT=20
        while [ $# -gt 0 ]; do
            case "$1" in
                --limit) shift; LIMIT="$1" ;;
            esac
            shift
        done
        sqlh "SELECT l.id, r.name AS rule, l.action_taken AS action,
                     substr(l.matched_text, 1, 80) AS matched,
                     COALESCE(w.pane_id, '-') AS pane,
                     COALESCE(l.task_id, '-') AS task,
                     CASE l.resolved WHEN 1 THEN 'resolved' ELSE 'open' END AS status,
                     substr(l.created_at, 1, 16) AS time
              FROM violation_log l
              LEFT JOIN violation_rules r ON r.id = l.rule_id
              LEFT JOIN workers w ON w.id = l.worker_id
              ORDER BY l.created_at DESC
              LIMIT ${LIMIT};"
        ;;

    log-add)
        [ $# -lt 2 ] && { echo "Usage: violations.sh log-add <rule_id> <matched_text> [--worker N] [--task N]" >&2; exit 1; }
        RULE_ID="$1"
        MATCHED=$(esc "$2")
        shift 2
        WORKER="NULL"; TASK="NULL"
        while [ $# -gt 0 ]; do
            case "$1" in
                --worker) shift; WORKER="$1" ;;
                --task) shift; TASK="$1" ;;
            esac
            shift
        done
        ACTION=$(sql "SELECT action FROM violation_rules WHERE id = ${RULE_ID};")
        [ -z "$ACTION" ] && { echo "Error: Rule #${RULE_ID} not found" >&2; exit 1; }
        sql "INSERT INTO violation_log (rule_id, worker_id, task_id, matched_text, action_taken)
             VALUES (${RULE_ID}, ${WORKER}, ${TASK}, '${MATCHED}', '${ACTION}');"
        echo "Violation logged for rule #${RULE_ID}"
        ;;

    resolve)
        [ $# -lt 1 ] && { echo "Usage: violations.sh resolve <log_id>" >&2; exit 1; }
        sql "UPDATE violation_log SET resolved = 1, resolved_at = '$(ts_now)' WHERE id = $1;"
        echo "Violation #$1 resolved"
        ;;

    json)
        PROJECT_FILTER=""
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            PROJECT_FILTER="WHERE r.project_id = ${PID}"
        fi
        RULES=$(sqlj "SELECT r.id, r.name, r.pattern, r.action, r.description, r.enabled,
                             (SELECT count(*) FROM violation_log l WHERE l.rule_id = r.id) AS total_hits,
                             (SELECT count(*) FROM violation_log l WHERE l.rule_id = r.id AND l.resolved = 0) AS open_hits
                      FROM violation_rules r ${PROJECT_FILTER}
                      ORDER BY r.id;" 2>/dev/null || echo '[]')
        RECENT=$(sqlj "SELECT l.id, r.name AS rule, l.action_taken, l.matched_text,
                              l.resolved, l.created_at
                       FROM violation_log l
                       LEFT JOIN violation_rules r ON r.id = l.rule_id
                       ORDER BY l.created_at DESC LIMIT 20;" 2>/dev/null || echo '[]')
        printf '{"rules":%s,"recent_violations":%s}\n' "${RULES:-[]}" "${RECENT:-[]}"
        ;;

    seed)
        [ $# -lt 1 ] && { echo "Usage: violations.sh seed <project>" >&2; exit 1; }
        PID=$(resolve_project "$1")
        echo "Seeding default supervisor violation rules for project '$1'..."

        # Frozen directory rules
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'love2d-frozen', 'love2d/', 'deny',
                    'love2d/ is a frozen read-only directory. Do not modify.');"
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'archive-frozen', 'archive/', 'deny',
                    'archive/ is a frozen read-only directory. Do not modify.');"

        # Build discipline
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'use-dev-not-build', 'tsz build.*\\.tsz', 'flag',
                    'Use tsz dev for iteration, not tsz build. tsz build is for production only.');"
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'old-build-commands', 'zig build (compiler|app-full)', 'flag',
                    'Old build commands removed. Use zig build tsz or zig build tsz-full.');"

        # Hand-painted UI
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'no-hand-painted-zig-ui', 'framework/(devtools|ui_)', 'deny',
                    'Never hand-paint UI in Zig. Write .tsz and use --embed.');"

        # Generated file edits
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'no-edit-gen-zig', '\\.gen\\.zig$', 'deny',
                    '.gen.zig files are build artifacts. Fix the .tsz source and recompile.');"

        # File outside boundary (generic — actual boundary checking is in check-file)
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'no-framework-edits-from-carts', 'framework/.*\\.zig', 'pause',
                    'Cart workers should not edit framework files. Only framework tasks may touch these.');"

        # Chmod/unlock frozen dirs
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'no-chmod-frozen', 'chmod.*(love2d|archive)', 'deny',
                    'Do not chmod or unlock frozen directories.');"

        # Less-than in .tsz script blocks
        "$SQLITE3" "$DB_PATH" "INSERT OR IGNORE INTO violation_rules (project_id, name, pattern, action, description)
            VALUES (${PID}, 'no-less-than-in-tsz', '<\\s*[A-Z]', 'flag',
                    'Parser treats x < Name as JSX. Use count > i instead of i < count in .tsz scripts.');"

        echo "Seeded $(sql "SELECT count(*) FROM violation_rules WHERE project_id = ${PID};") rules"
        ;;

    *)
        echo "Unknown command: ${CMD}" >&2
        usage
        ;;
esac
