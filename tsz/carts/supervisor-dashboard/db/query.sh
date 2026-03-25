#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-/run/user/${UID:-1000}/claude-sessions/supervisor.db}"
SQLITE3="${SQLITE3:-$(command -v sqlite3 2>/dev/null || echo /home/siah/miniconda3/bin/sqlite3)}"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: DB not found at $DB_PATH — run init.sh first" >&2
    exit 1
fi

q() { "$SQLITE3" -header -column "$DB_PATH" "$1"; }
qcsv() { "$SQLITE3" -csv -header "$DB_PATH" "$1"; }
qjson() { "$SQLITE3" -json "$DB_PATH" "$1"; }

resolve_project() {
    local name="$1"
    local pid
    pid=$("$SQLITE3" "$DB_PATH" "SELECT id FROM projects WHERE name = '$(echo "$name" | sed "s/'/''/g")';")
    if [ -z "$pid" ]; then
        echo "Error: Project '${name}' not found" >&2
        exit 1
    fi
    echo "$pid"
}

esc() { printf '%s' "$1" | sed "s/'/''/g"; }

usage() {
    cat <<'HELP'
Usage: query.sh <command> [args...]

Commands:
  search <query>                     FTS5 search across messages
  tasks [project] [--phase N] [--status X]
                                     List tasks (with optional phase/status filter)
  workers [project]                  List workers
  events [project] [--since 5m]      Recent events

  task-add <project> <title> [spec]  Add a backlog task
  task-assign <task-id> <worker-id>  Assign task to worker
  task-done <task-id>                Mark task done
  task-status <task-id> <status>     Set task status (backlog/assigned/in-progress/review/done/blocked)
  task-phase <task-id> <phase_id>    Assign task to a phase
  task-criteria <task-id> "json"     Set acceptance criteria (JSON array of strings)
  task-boundaries <task-id> "json"   Set file boundaries (JSON array of paths)
  task-conflicts <task-id> "json"    Set conflict zones (JSON array of files)
  task-objective <task-id> "text"    Set task objective
  task-context <task-id> "text"      Set task context
  task-block <task-id> "reason"      Block task with reason
  task-unblock <task-id>             Unblock task
  task-tests <task-id> "json"        Set validation tests (JSON array)
  task-detail <task-id>              Full task view with rich fields

  json-tasks [project] [--phase N]   Tasks as JSON (for dashboard)
  json-workers [project]             Workers as JSON (for dashboard)
  json-events [project] [limit]      Events as JSON (for dashboard)
  json-task-detail <task-id>         Single task with all fields as JSON
HELP
    exit 1
}

[ $# -lt 1 ] && usage

CMD="$1"
shift

case "$CMD" in
    search)
        [ $# -lt 1 ] && { echo "Usage: query.sh search <query>" >&2; exit 1; }
        QUERY=$(printf '%s' "$1" | sed "s/'/''/g")
        q "SELECT m.id, m.role, substr(m.content, 1, 120) AS content, m.timestamp, s.jsonl_path
           FROM messages_fts f
           JOIN messages m ON m.id = f.rowid
           JOIN sessions s ON s.id = m.session_id
           WHERE messages_fts MATCH '${QUERY}'
           ORDER BY m.timestamp DESC
           LIMIT 20;"
        ;;

    tasks)
        PROJECT_FILTER=""
        PHASE_FILTER=""
        STATUS_FILTER=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --phase) shift; PHASE_FILTER="AND ph.phase_number = $1" ;;
                --status) shift; STATUS_FILTER="AND t.status = '$(esc "$1")'" ;;
                *) PID=$(resolve_project "$1"); PROJECT_FILTER="AND t.project_id = ${PID}" ;;
            esac
            shift
        done
        q "SELECT t.id, t.title, t.status, t.priority AS pri,
                  COALESCE(ph.phase_number, '-') AS phase,
                  COALESCE(ph.title, '-') AS phase_title,
                  COALESCE(w.session_id, '-') AS worker,
                  (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') || '/' ||
                  (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps,
                  t.file_boundaries AS boundaries,
                  t.conflict_zones AS conflicts
           FROM tasks t
           LEFT JOIN workers w ON w.id = t.assigned_worker_id
           LEFT JOIN phases ph ON ph.id = t.phase_id
           WHERE 1=1 ${PROJECT_FILTER} ${PHASE_FILTER} ${STATUS_FILTER}
           ORDER BY CASE t.status WHEN 'in-progress' THEN 0 WHEN 'assigned' THEN 1 WHEN 'backlog' THEN 2 WHEN 'review' THEN 3 WHEN 'blocked' THEN 4 ELSE 5 END,
                    t.priority, t.id;"
        ;;

    workers)
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            q "SELECT w.id, w.pane_id, w.session_id, w.status,
                      COALESCE(t.title, '-') AS current_task, w.last_seen_at
               FROM workers w
               LEFT JOIN tasks t ON t.id = w.current_task_id
               WHERE w.project_id = ${PID}
               ORDER BY w.last_seen_at DESC;"
        else
            q "SELECT w.id, p.name AS project, w.pane_id, w.session_id, w.status,
                      COALESCE(t.title, '-') AS current_task, w.last_seen_at
               FROM workers w
               JOIN projects p ON p.id = w.project_id
               LEFT JOIN tasks t ON t.id = w.current_task_id
               ORDER BY w.last_seen_at DESC;"
        fi
        ;;

    events)
        PROJECT_FILTER=""
        SINCE_FILTER=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --since)
                    shift
                    [ $# -lt 1 ] && { echo "Error: --since needs a value (e.g., 5m, 1h)" >&2; exit 1; }
                    VAL="$1"
                    if [[ "$VAL" =~ ^([0-9]+)m$ ]]; then
                        SINCE_FILTER="AND e.created_at >= datetime('now', '-${BASH_REMATCH[1]} minutes')"
                    elif [[ "$VAL" =~ ^([0-9]+)h$ ]]; then
                        SINCE_FILTER="AND e.created_at >= datetime('now', '-${BASH_REMATCH[1]} hours')"
                    elif [[ "$VAL" =~ ^([0-9]+)d$ ]]; then
                        SINCE_FILTER="AND e.created_at >= datetime('now', '-${BASH_REMATCH[1]} days')"
                    else
                        echo "Error: Invalid --since format. Use Nm, Nh, or Nd" >&2; exit 1
                    fi
                    ;;
                *)
                    PID=$(resolve_project "$1")
                    PROJECT_FILTER="AND e.project_id = ${PID}"
                    ;;
            esac
            shift
        done
        q "SELECT e.id, p.name AS project, e.event_type,
                  substr(e.payload_json, 1, 60) AS payload, e.created_at,
                  COALESCE(w.session_id, '-') AS worker
           FROM events e
           JOIN projects p ON p.id = e.project_id
           LEFT JOIN workers w ON w.id = e.worker_id
           WHERE 1=1 ${PROJECT_FILTER} ${SINCE_FILTER}
           ORDER BY e.created_at DESC
           LIMIT 50;"
        ;;

    task-add)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-add <project> <title> [spec]" >&2; exit 1; }
        PID=$(resolve_project "$1")
        TITLE_ESC=$(esc "$2")
        SPEC_ESC=""
        [ $# -ge 3 ] && SPEC_ESC=$(esc "$3")
        "$SQLITE3" "$DB_PATH" "INSERT INTO tasks (project_id, title, spec_text) VALUES (${PID}, '${TITLE_ESC}', '${SPEC_ESC}');"
        NEW_ID=$("$SQLITE3" "$DB_PATH" "SELECT last_insert_rowid();")
        echo "Created task #${NEW_ID}: ${2}"
        ;;

    task-assign)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-assign <task-id> <worker-id>" >&2; exit 1; }
        TASK_ID="$1"
        WORKER_ID="$2"
        "$SQLITE3" "$DB_PATH" "
            UPDATE tasks SET assigned_worker_id = ${WORKER_ID}, status = 'in-progress',
                             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${TASK_ID};
            UPDATE workers SET current_task_id = ${TASK_ID}, status = 'active',
                               last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${WORKER_ID};
        "
        echo "Assigned task #${TASK_ID} to worker #${WORKER_ID}"
        ;;

    task-done)
        [ $# -lt 1 ] && { echo "Usage: query.sh task-done <task-id>" >&2; exit 1; }
        TASK_ID="$1"
        "$SQLITE3" "$DB_PATH" "
            UPDATE workers SET current_task_id = NULL, status = 'idle',
                               last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE current_task_id = ${TASK_ID};
            UPDATE tasks SET status = 'done', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ${TASK_ID};
        "
        echo "Task #${TASK_ID} marked done"
        ;;

    task-status)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-status <task-id> <status>" >&2; exit 1; }
        TASK_ID="$1"
        STATUS="$2"
        case "$STATUS" in
            backlog|assigned|in-progress|review|done|blocked) ;;
            *) echo "Error: Status must be backlog, assigned, in-progress, review, done, or blocked" >&2; exit 1 ;;
        esac
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET status = '${STATUS}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ${TASK_ID};"
        echo "Task #${TASK_ID} status set to ${STATUS}"
        ;;

    task-phase)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-phase <task-id> <phase_id>" >&2; exit 1; }
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET phase_id = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 assigned to phase #$2"
        ;;

    task-criteria)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-criteria <task-id> '<json array>'" >&2; exit 1; }
        CRITERIA=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET acceptance_criteria = '${CRITERIA}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 acceptance criteria updated"
        ;;

    task-boundaries)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-boundaries <task-id> '<json array>'" >&2; exit 1; }
        BOUNDS=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET file_boundaries = '${BOUNDS}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 file boundaries updated"
        ;;

    task-conflicts)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-conflicts <task-id> '<json array>'" >&2; exit 1; }
        ZONES=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET conflict_zones = '${ZONES}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 conflict zones updated"
        ;;

    task-objective)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-objective <task-id> \"text\"" >&2; exit 1; }
        OBJ=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET objective = '${OBJ}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 objective updated"
        ;;

    task-context)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-context <task-id> \"text\"" >&2; exit 1; }
        CTX=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET context = '${CTX}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 context updated"
        ;;

    task-block)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-block <task-id> \"reason\"" >&2; exit 1; }
        REASON=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET status = 'blocked', blocked_by = '${REASON}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 blocked: $2"
        ;;

    task-unblock)
        [ $# -lt 1 ] && { echo "Usage: query.sh task-unblock <task-id>" >&2; exit 1; }
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET status = 'backlog', blocked_by = '', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 unblocked"
        ;;

    task-tests)
        [ $# -lt 2 ] && { echo "Usage: query.sh task-tests <task-id> '<json array>'" >&2; exit 1; }
        TESTS=$(esc "$2")
        "$SQLITE3" "$DB_PATH" "UPDATE tasks SET tests = '${TESTS}', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $1;"
        echo "Task #$1 tests updated"
        ;;

    task-detail)
        [ $# -lt 1 ] && { echo "Usage: query.sh task-detail <task-id>" >&2; exit 1; }
        TID="$1"
        echo "=== TASK #${TID} ==="
        q "SELECT t.id, t.title, t.status, t.priority, p.name AS project,
                  COALESCE(ph.phase_number, '-') AS phase,
                  COALESCE(w.pane_id, '-') AS pane, t.created_by, t.created_at, t.updated_at
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN workers w ON w.id = t.assigned_worker_id
           LEFT JOIN phases ph ON ph.id = t.phase_id
           WHERE t.id = ${TID};"
        echo ""
        echo "--- Objective ---"
        "$SQLITE3" "$DB_PATH" "SELECT objective FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Context ---"
        "$SQLITE3" "$DB_PATH" "SELECT context FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Acceptance Criteria ---"
        "$SQLITE3" "$DB_PATH" "SELECT acceptance_criteria FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Known Exists ---"
        "$SQLITE3" "$DB_PATH" "SELECT known_exists FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Known Gaps ---"
        "$SQLITE3" "$DB_PATH" "SELECT known_gaps FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- File Boundaries ---"
        "$SQLITE3" "$DB_PATH" "SELECT file_boundaries FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Conflict Zones ---"
        "$SQLITE3" "$DB_PATH" "SELECT conflict_zones FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Blocked By ---"
        "$SQLITE3" "$DB_PATH" "SELECT blocked_by FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Tests ---"
        "$SQLITE3" "$DB_PATH" "SELECT tests FROM tasks WHERE id = ${TID};"
        echo ""
        echo "--- Steps ---"
        q "SELECT step_number AS '#', title, status, files_touched AS files, depends_on AS deps
           FROM task_steps WHERE task_id = ${TID} ORDER BY step_number;"
        echo ""
        echo "--- Notes ---"
        q "SELECT author, content, substr(timestamp, 1, 16) AS time
           FROM task_notes WHERE task_id = ${TID} ORDER BY timestamp;"
        echo ""
        echo "--- Recent Edits ---"
        q "SELECT file_path, edit_summary, substr(timestamp, 1, 16) AS time
           FROM task_edits WHERE task_id = ${TID} ORDER BY timestamp DESC LIMIT 10;"
        ;;

    json-tasks)
        PROJECT_FILTER=""
        PHASE_FILTER=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --phase) shift; PHASE_FILTER="AND ph.phase_number = $1" ;;
                *) PID=$(resolve_project "$1"); PROJECT_FILTER="AND t.project_id = ${PID}" ;;
            esac
            shift
        done
        qjson "SELECT t.id, t.title, t.status, t.priority, t.spec_text AS spec,
                      COALESCE(t.phase_id, 0) AS phase_id,
                      COALESCE(ph.phase_number, 0) AS phase_number,
                      COALESCE(ph.title, '') AS phase_title,
                      COALESCE(t.objective, '') AS objective,
                      COALESCE(t.acceptance_criteria, '[]') AS acceptance_criteria,
                      COALESCE(t.file_boundaries, '[]') AS file_boundaries,
                      COALESCE(t.conflict_zones, '[]') AS conflict_zones,
                      COALESCE(t.blocked_by, '') AS blocked_by,
                      COALESCE(w.pane_id, 0) AS worker_pane,
                      COALESCE(w.session_id, '') AS worker_session,
                      (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') AS steps_done,
                      (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps_total,
                      t.updated_at
               FROM tasks t
               LEFT JOIN workers w ON w.id = t.assigned_worker_id
               LEFT JOIN phases ph ON ph.id = t.phase_id
               WHERE 1=1 ${PROJECT_FILTER} ${PHASE_FILTER}
               ORDER BY t.priority ASC, t.id;"
        ;;

    json-workers)
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            qjson "SELECT w.id, w.pane_id, w.session_id, w.status,
                          COALESCE(t.title, '') AS current_task, w.last_seen_at
                   FROM workers w
                   LEFT JOIN tasks t ON t.id = w.current_task_id
                   WHERE w.project_id = ${PID}
                   ORDER BY w.last_seen_at DESC;"
        else
            qjson "SELECT w.id, p.name AS project, w.pane_id, w.session_id, w.status,
                          COALESCE(t.title, '') AS current_task, w.last_seen_at
                   FROM workers w
                   JOIN projects p ON p.id = w.project_id
                   LEFT JOIN tasks t ON t.id = w.current_task_id
                   ORDER BY w.last_seen_at DESC;"
        fi
        ;;

    json-events)
        LIMIT="${2:-20}"
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            qjson "SELECT e.id, e.event_type, e.payload_json, e.created_at,
                          COALESCE(w.session_id, '') AS worker_session
                   FROM events e
                   LEFT JOIN workers w ON w.id = e.worker_id
                   WHERE e.project_id = ${PID}
                   ORDER BY e.created_at DESC LIMIT ${LIMIT};"
        else
            qjson "SELECT e.id, p.name AS project, e.event_type, e.payload_json, e.created_at
                   FROM events e JOIN projects p ON p.id = e.project_id
                   ORDER BY e.created_at DESC LIMIT ${LIMIT};"
        fi
        ;;

    json-task-detail)
        [ $# -lt 1 ] && { echo "Usage: query.sh json-task-detail <task-id>" >&2; exit 1; }
        TID="$1"
        TASK=$(qjson "SELECT t.id, t.title, t.status, t.priority, t.spec_text AS spec,
                            COALESCE(t.objective, '') AS objective,
                            COALESCE(t.context, '') AS context,
                            COALESCE(t.acceptance_criteria, '[]') AS acceptance_criteria,
                            COALESCE(t.known_exists, '[]') AS known_exists,
                            COALESCE(t.known_gaps, '[]') AS known_gaps,
                            COALESCE(t.tests, '[]') AS tests,
                            COALESCE(t.visual_verification, '') AS visual_verification,
                            COALESCE(t.file_boundaries, '[]') AS file_boundaries,
                            COALESCE(t.conflict_zones, '[]') AS conflict_zones,
                            COALESCE(t.blocked_by, '') AS blocked_by,
                            t.max_workers,
                            COALESCE(t.changelog_entry, '') AS changelog_entry,
                            COALESCE(t.phase_id, 0) AS phase_id,
                            COALESCE(ph.title, '') AS phase_title,
                            COALESCE(w.pane_id, 0) AS worker_pane,
                            COALESCE(w.session_id, '') AS worker_session,
                            t.created_by, t.created_at, t.updated_at
                     FROM tasks t
                     LEFT JOIN workers w ON w.id = t.assigned_worker_id
                     LEFT JOIN phases ph ON ph.id = t.phase_id
                     WHERE t.id = ${TID};")
        STEPS=$(qjson "SELECT step_number, title, status, description,
                             COALESCE(files_touched, '[]') AS files_touched,
                             COALESCE(depends_on, '[]') AS depends_on
                      FROM task_steps WHERE task_id = ${TID} ORDER BY step_number;" 2>/dev/null || echo '[]')
        NOTES=$(qjson "SELECT author, content, substr(timestamp, 1, 16) AS timestamp
                      FROM task_notes WHERE task_id = ${TID} ORDER BY timestamp;" 2>/dev/null || echo '[]')
        EDITS=$(qjson "SELECT file_path, edit_summary, diff_snippet, substr(timestamp, 1, 16) AS timestamp
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

    *)
        echo "Unknown command: ${CMD}" >&2
        usage
        ;;
esac
