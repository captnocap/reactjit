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

# Apply schemas if tables don't exist yet
ensure_schema() {
    local schema_dir
    schema_dir="$(cd "$(dirname "$0")" && pwd)"
    local has_steps
    has_steps=$(sql "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='task_steps';")
    if [ "$has_steps" = "0" ]; then
        "$SQLITE3" "$DB_PATH" < "${schema_dir}/task-schema.sql"
        echo "Applied task-schema.sql" >&2
    fi
    local has_plans
    has_plans=$(sql "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='plans';")
    if [ "$has_plans" = "0" ]; then
        "$SQLITE3" "$DB_PATH" < "${schema_dir}/plan-schema.sql" 2>/dev/null || true
        echo "Applied plan-schema.sql" >&2
    fi
}

usage() {
    cat <<'HELP'
Usage: tasks.sh <command> [args...]

Commands:
  create <project> <title> --spec "text"     Create a task
  steps <task_id>                            List steps for a task
  step-add <task_id> <title> --desc "text"   Add a step to a task
  step-reorder <task_id> <step#> <new_pos>   Reorder a step
  step-status <task_id> <step#> <status>     Set step status
  assign <task_id> <worker_pane_id>          Assign task to worker
  unassign <task_id>                         Unassign task
  priority <task_id> <number>                Set priority (lower=higher)
  status <task_id> <status>                  Set task status
  note <task_id> <author> "content"          Add a note
  log-edit <task_id> <worker_id> <path> "summary" [diff]
                                             Log a file edit
  list [project] [--status X] [--worker X] [--priority]
                                             List tasks with filters
  detail <task_id>                           Full task view
  diffs <task_id>                            All edit diffs for a task
  json [project]                             Full board state as JSON
HELP
    exit 1
}

ensure_db
ensure_schema

[ $# -lt 1 ] && usage

CMD="$1"
shift

case "$CMD" in
    create)
        [ $# -lt 2 ] && { echo "Usage: tasks.sh create <project> <title> [--spec ...] [--phase N] [--objective ...] [--context ...] [--priority N] [--criteria '<json>'] [--boundaries '<json>'] [--conflicts '<json>'] [--max-workers N] [--created-by supervisor|user]" >&2; exit 1; }
        PID=$(resolve_project "$1")
        TITLE_E=$(esc "$2")
        shift 2
        SPEC=""; PHASE_ID="NULL"; OBJECTIVE=""; CONTEXT=""; PRIORITY="3"
        CRITERIA="[]"; BOUNDARIES="[]"; CONFLICTS="[]"; MAX_W=1; CREATED_BY="user"
        while [ $# -gt 0 ]; do
            case "$1" in
                --spec) shift; SPEC=$(esc "$1") ;;
                --phase) shift; PHASE_ID="$1" ;;
                --objective) shift; OBJECTIVE=$(esc "$1") ;;
                --context) shift; CONTEXT=$(esc "$1") ;;
                --priority) shift; PRIORITY="$1" ;;
                --criteria) shift; CRITERIA=$(esc "$1") ;;
                --boundaries) shift; BOUNDARIES=$(esc "$1") ;;
                --conflicts) shift; CONFLICTS=$(esc "$1") ;;
                --max-workers) shift; MAX_W="$1" ;;
                --created-by) shift; CREATED_BY="$1" ;;
            esac
            shift
        done
        NEW_ID=$("$SQLITE3" "$DB_PATH" "INSERT INTO tasks (project_id, title, spec_text, phase_id, objective, context,
                                priority, acceptance_criteria, file_boundaries, conflict_zones,
                                max_workers, created_by)
             VALUES (${PID}, '${TITLE_E}', '${SPEC}', ${PHASE_ID}, '${OBJECTIVE}', '${CONTEXT}',
                     ${PRIORITY}, '${CRITERIA}', '${BOUNDARIES}', '${CONFLICTS}',
                     ${MAX_W}, '${CREATED_BY}');
             SELECT last_insert_rowid();")
        echo "Created task #${NEW_ID}"
        ;;

    steps)
        [ $# -lt 1 ] && { echo "Usage: tasks.sh steps <task_id>" >&2; exit 1; }
        sqlh "SELECT step_number AS '#', title, status, description
              FROM task_steps WHERE task_id = $1
              ORDER BY step_number;"
        ;;

    step-add)
        [ $# -lt 2 ] && { echo "Usage: tasks.sh step-add <task_id> <title> [--desc ...] [--files ...] [--depends ...]" >&2; exit 1; }
        TASK_ID="$1"
        TITLE_E=$(esc "$2")
        shift 2
        DESC=""; FILES="[]"; DEPS="[]"
        while [ $# -gt 0 ]; do
            case "$1" in
                --desc) shift; DESC=$(esc "$1") ;;
                --files) shift; FILES="[$(echo "$1" | sed 's/[^,]*/"&"/g')]" ;;
                --depends) shift; DEPS="[$(echo "$1" | sed 's/,/, /g')]" ;;
            esac
            shift
        done
        NEXT=$(sql "SELECT COALESCE(MAX(step_number), 0) + 1 FROM task_steps WHERE task_id = ${TASK_ID};")
        sql "INSERT INTO task_steps (task_id, step_number, title, description, files_touched, depends_on)
             VALUES (${TASK_ID}, ${NEXT}, '${TITLE_E}', '${DESC}', '${FILES}', '${DEPS}');"
        echo "Added step #${NEXT} to task #${TASK_ID}"
        ;;

    step-reorder)
        [ $# -lt 3 ] && { echo "Usage: tasks.sh step-reorder <task_id> <step#> <new_pos>" >&2; exit 1; }
        TASK_ID="$1"; OLD="$2"; NEW="$3"
        # Get the step id
        SID=$(sql "SELECT id FROM task_steps WHERE task_id=${TASK_ID} AND step_number=${OLD};")
        [ -z "$SID" ] && { echo "Error: Step #${OLD} not found in task #${TASK_ID}" >&2; exit 1; }
        if [ "$OLD" -lt "$NEW" ]; then
            # Moving down: shift intermediates up
            sql "UPDATE task_steps SET step_number = step_number - 1
                 WHERE task_id=${TASK_ID} AND step_number > ${OLD} AND step_number <= ${NEW};"
        else
            # Moving up: shift intermediates down
            sql "UPDATE task_steps SET step_number = step_number + 1
                 WHERE task_id=${TASK_ID} AND step_number >= ${NEW} AND step_number < ${OLD};"
        fi
        sql "UPDATE task_steps SET step_number = ${NEW}, updated_at = '$(ts_now)' WHERE id = ${SID};"
        echo "Reordered step ${OLD} → ${NEW} in task #${TASK_ID}"
        ;;

    step-status)
        [ $# -lt 3 ] && { echo "Usage: tasks.sh step-status <task_id> <step#> <status>" >&2; exit 1; }
        TASK_ID="$1"; STEP="$2"; STATUS="$3"
        case "$STATUS" in
            pending|in-progress|done|blocked) ;;
            *) echo "Error: Status must be pending, in-progress, done, or blocked" >&2; exit 1 ;;
        esac
        sql "UPDATE task_steps SET status = '${STATUS}', updated_at = '$(ts_now)'
             WHERE task_id = ${TASK_ID} AND step_number = ${STEP};"
        echo "Step #${STEP} of task #${TASK_ID} → ${STATUS}"
        ;;

    assign)
        [ $# -lt 2 ] && { echo "Usage: tasks.sh assign <task_id> <worker_pane_id>" >&2; exit 1; }
        TASK_ID="$1"; PANE_ID="$2"
        WORKER_ID=$(sql "SELECT id FROM workers WHERE pane_id = ${PANE_ID} ORDER BY last_seen_at DESC LIMIT 1;")
        [ -z "$WORKER_ID" ] && { echo "Error: No worker with pane_id ${PANE_ID}" >&2; exit 1; }
        sql "UPDATE tasks SET assigned_worker_id = ${WORKER_ID}, status = 'in-progress',
                              updated_at = '$(ts_now)' WHERE id = ${TASK_ID};
             UPDATE workers SET current_task_id = ${TASK_ID}, status = 'active',
                                last_seen_at = '$(ts_now)' WHERE id = ${WORKER_ID};"
        echo "Assigned task #${TASK_ID} to pane ${PANE_ID} (worker #${WORKER_ID})"
        ;;

    unassign)
        [ $# -lt 1 ] && { echo "Usage: tasks.sh unassign <task_id>" >&2; exit 1; }
        TASK_ID="$1"
        sql "UPDATE workers SET current_task_id = NULL, status = 'idle',
                                last_seen_at = '$(ts_now)'
             WHERE current_task_id = ${TASK_ID};
             UPDATE tasks SET assigned_worker_id = NULL, status = 'backlog',
                              updated_at = '$(ts_now)' WHERE id = ${TASK_ID};"
        echo "Unassigned task #${TASK_ID}"
        ;;

    priority)
        [ $# -lt 2 ] && { echo "Usage: tasks.sh priority <task_id> <number>" >&2; exit 1; }
        sql "UPDATE tasks SET priority = $2, updated_at = '$(ts_now)' WHERE id = $1;"
        echo "Task #$1 priority → $2"
        ;;

    status)
        [ $# -lt 2 ] && { echo "Usage: tasks.sh status <task_id> <status>" >&2; exit 1; }
        TASK_ID="$1"; STATUS="$2"
        case "$STATUS" in
            backlog|in-progress|review|done|blocked) ;;
            *) echo "Error: Status must be backlog, in-progress, review, done, or blocked" >&2; exit 1 ;;
        esac
        sql "UPDATE tasks SET status = '${STATUS}', updated_at = '$(ts_now)' WHERE id = ${TASK_ID};"
        # If done, free the worker
        if [ "$STATUS" = "done" ]; then
            sql "UPDATE workers SET current_task_id = NULL, status = 'idle',
                                    last_seen_at = '$(ts_now)'
                 WHERE current_task_id = ${TASK_ID};"
        fi
        echo "Task #${TASK_ID} → ${STATUS}"
        ;;

    note)
        [ $# -lt 3 ] && { echo "Usage: tasks.sh note <task_id> <author> \"content\"" >&2; exit 1; }
        TASK_ID="$1"; AUTHOR="$2"; CONTENT=$(esc "$3")
        case "$AUTHOR" in
            supervisor|worker|user) ;;
            *) echo "Error: Author must be supervisor, worker, or user" >&2; exit 1 ;;
        esac
        sql "INSERT INTO task_notes (task_id, author, content) VALUES (${TASK_ID}, '${AUTHOR}', '${CONTENT}');"
        echo "Note added to task #${TASK_ID}"
        ;;

    log-edit)
        [ $# -lt 4 ] && { echo "Usage: tasks.sh log-edit <task_id> <worker_id> <file_path> \"summary\" [diff_snippet]" >&2; exit 1; }
        TASK_ID="$1"; WORKER_ID="$2"; FPATH=$(esc "$3"); SUMMARY=$(esc "$4")
        DIFF=""
        [ $# -ge 5 ] && DIFF=$(esc "$(printf '%.500s' "$5")")
        sql "INSERT INTO task_edits (task_id, worker_id, file_path, edit_summary, diff_snippet)
             VALUES (${TASK_ID}, ${WORKER_ID}, '${FPATH}', '${SUMMARY}', '${DIFF}');"
        echo "Edit logged for task #${TASK_ID}"
        ;;

    list)
        PROJECT_FILTER=""
        STATUS_FILTER=""
        WORKER_FILTER=""
        ORDER="t.id"
        while [ $# -gt 0 ]; do
            case "$1" in
                --status) shift; STATUS_FILTER="AND t.status = '$(esc "$1")'" ;;
                --worker) shift; WORKER_FILTER="AND w.pane_id = $1" ;;
                --priority) ORDER="t.priority ASC, t.id" ;;
                *) PID=$(resolve_project "$1"); PROJECT_FILTER="AND t.project_id = ${PID}" ;;
            esac
            shift
        done
        sqlh "SELECT t.id, t.title, t.status, t.priority AS pri,
                     COALESCE(w.pane_id, '-') AS pane,
                     (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') || '/' ||
                     (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps,
                     substr(t.updated_at, 1, 16) AS updated
              FROM tasks t
              LEFT JOIN workers w ON w.id = t.assigned_worker_id
              WHERE 1=1 ${PROJECT_FILTER} ${STATUS_FILTER} ${WORKER_FILTER}
              ORDER BY ${ORDER};"
        ;;

    detail)
        [ $# -lt 1 ] && { echo "Usage: tasks.sh detail <task_id>" >&2; exit 1; }
        TID="$1"
        echo "=== TASK #${TID} ==="
        sqlh "SELECT t.id, t.title, t.status, t.priority, p.name AS project,
                     COALESCE(ph.phase_number, '-') AS phase,
                     COALESCE(w.pane_id, '-') AS pane, t.max_workers,
                     t.created_by, t.created_at, t.updated_at
              FROM tasks t
              JOIN projects p ON p.id = t.project_id
              LEFT JOIN workers w ON w.id = t.assigned_worker_id
              LEFT JOIN phases ph ON ph.id = t.phase_id
              WHERE t.id = ${TID};"
        echo ""
        echo "--- Objective ---"
        sql "SELECT objective FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Context ---"
        sql "SELECT context FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Spec ---"
        sql "SELECT spec_text FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Acceptance Criteria ---"
        sql "SELECT acceptance_criteria FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- File Boundaries ---"
        sql "SELECT file_boundaries FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Conflict Zones ---"
        sql "SELECT conflict_zones FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Blocked By ---"
        sql "SELECT blocked_by FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Tests ---"
        sql "SELECT tests FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Steps ---"
        sqlh "SELECT step_number AS '#', title, status, description,
                     files_touched AS files, depends_on AS deps
              FROM task_steps WHERE task_id = ${TID} ORDER BY step_number;"
        echo ""
        echo "--- Notes ---"
        sqlh "SELECT author, content, substr(timestamp, 1, 16) AS time
              FROM task_notes WHERE task_id = ${TID} ORDER BY timestamp;"
        echo ""
        echo "--- Recent Edits ---"
        sqlh "SELECT file_path, edit_summary, substr(timestamp, 1, 16) AS time
              FROM task_edits WHERE task_id = ${TID} ORDER BY timestamp DESC LIMIT 10;"
        ;;

    diffs)
        [ $# -lt 1 ] && { echo "Usage: tasks.sh diffs <task_id>" >&2; exit 1; }
        sqlh "SELECT id, file_path, edit_summary, diff_snippet, substr(timestamp, 1, 16) AS time
              FROM task_edits WHERE task_id = $1 ORDER BY timestamp;"
        ;;

    json)
        # Full board state as JSON for the UI to consume
        PROJECT_FILTER=""
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            PROJECT_FILTER="WHERE t.project_id = ${PID}"
        fi
        # Build composite JSON
        TASKS=$(sqlj "SELECT t.id, t.title, t.status, t.priority, t.spec_text AS spec,
                             COALESCE(t.phase_id, 0) AS phase_id,
                             COALESCE(ph.phase_number, 0) AS phase_number,
                             COALESCE(ph.title, '') AS phase_title,
                             COALESCE(t.objective, '') AS objective,
                             COALESCE(w.pane_id, 0) AS worker_pane,
                             COALESCE(w.session_id, '') AS worker_session,
                             (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') AS steps_done,
                             (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps_total,
                             (SELECT substr(MAX(timestamp), 1, 16) FROM task_edits e WHERE e.task_id = t.id) AS last_edit,
                             t.updated_at
                      FROM tasks t
                      LEFT JOIN workers w ON w.id = t.assigned_worker_id
                      LEFT JOIN phases ph ON ph.id = t.phase_id
                      ${PROJECT_FILTER}
                      ORDER BY t.priority ASC, t.id;" 2>/dev/null || echo '[]')
        WORKERS=$(sqlj "SELECT w.id, w.pane_id, w.session_id, w.status,
                               COALESCE(t.title, '') AS current_task, w.last_seen_at
                        FROM workers w
                        LEFT JOIN tasks t ON t.id = w.current_task_id
                        ORDER BY w.last_seen_at DESC;" 2>/dev/null || echo '[]')
        printf '{"tasks":%s,"workers":%s}\n' "${TASKS:-[]}" "${WORKERS:-[]}"
        ;;

    json-detail)
        [ $# -lt 1 ] && { echo "Usage: tasks.sh json-detail <task_id>" >&2; exit 1; }
        TID="$1"
        TASK=$(sqlj "SELECT t.id, t.title, t.status, t.priority, t.spec_text AS spec,
                            COALESCE(t.objective, '') AS objective,
                            COALESCE(t.context, '') AS context,
                            COALESCE(t.acceptance_criteria, '[]') AS acceptance_criteria,
                            COALESCE(t.blocked_by, '') AS blocked_by,
                            COALESCE(t.visual_verification, '') AS visual_verification,
                            COALESCE(t.changelog_entry, '') AS changelog_entry,
                            COALESCE(t.phase_id, 0) AS phase_id,
                            COALESCE(ph.title, '') AS phase_title,
                            COALESCE(w.pane_id, 0) AS worker_pane,
                            COALESCE(w.session_id, '') AS worker_session
                     FROM tasks t
                     LEFT JOIN workers w ON w.id = t.assigned_worker_id
                     LEFT JOIN phases ph ON ph.id = t.phase_id
                     WHERE t.id = ${TID};")
        STEPS=$(sqlj "SELECT step_number, title, status, description,
                             COALESCE(files_touched, '[]') AS files_touched,
                             COALESCE(depends_on, '[]') AS depends_on
                      FROM task_steps WHERE task_id = ${TID} ORDER BY step_number;" 2>/dev/null || echo '[]')
        NOTES=$(sqlj "SELECT author, content, substr(timestamp, 1, 16) AS timestamp
                      FROM task_notes WHERE task_id = ${TID} ORDER BY timestamp;" 2>/dev/null || echo '[]')
        EDITS=$(sqlj "SELECT file_path, edit_summary, diff_snippet, substr(timestamp, 1, 16) AS timestamp
                      FROM task_edits WHERE task_id = ${TID} ORDER BY timestamp DESC LIMIT 20;" 2>/dev/null || echo '[]')
        printf '{"task":%s,"steps":%s,"notes":%s,"edits":%s}' \
            "$TASK" "${STEPS:-[]}" "${NOTES:-[]}" "${EDITS:-[]}" | \
        python3 -c "
import sys,json
d=json.load(sys.stdin)
t=d['task'][0] if isinstance(d['task'],list) else d['task']
t['steps']=d['steps']
t['notes']=d['notes']
t['edits']=d['edits']
for k in ('acceptance_criteria','known_exists','known_gaps','tests',
          'file_boundaries','conflict_zones','commit_trail','docs_required'):
    if k in t and isinstance(t[k],str):
        try: t[k]=json.loads(t[k])
        except: pass
print(json.dumps(t))
" 2>/dev/null || {
            TASK_INNER=$(printf '%s' "$TASK" | tr -d '[]')
            TASK_INNER="${TASK_INNER%\}}"
            printf '%s,"steps":%s,"notes":%s,"edits":%s}\n' "$TASK_INNER" "${STEPS:-[]}" "${NOTES:-[]}" "${EDITS:-[]}"
        }
        ;;

    refresh)
        # Write JSON files for the UI to poll
        OUT_DIR="/run/user/${UID:-1000}/claude-sessions"
        "$0" json > "${OUT_DIR}/taskboard_view.json" 2>/dev/null
        if [ $# -ge 1 ]; then
            "$0" json-detail "$1" > "${OUT_DIR}/taskboard_detail.json" 2>/dev/null
        fi
        ;;

    *)
        echo "Unknown command: ${CMD}" >&2
        usage
        ;;
esac
