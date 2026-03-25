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
Usage: plan.sh <command> [args...]

Commands:
  create <project> <title> [--goal "text"] [--motivation "text"] [--approach "text"]
         [--constraints "json"] [--non-goals "json"] [--key-decisions "json"]
         [--starting-point "json"] [--risks "json"] [--file-map "json"]
         [--boundaries "json"] [--max-workers N] [--shared-files "json"]
         [--done-criteria "json"] [--rollback "text"]
  phase-add <plan_id> <title> [--desc "text"] [--gate "text"] [--depends "1,2"]
  phase-status <plan_id> <phase#> <status>
  status <plan_id> <status>           Set plan status (draft/active/paused/completed/abandoned)
  list [project] [--status X]         List plans
  detail <plan_id>                    Full view: phases, tasks per phase, progress, milestones
  milestone-add <plan_id> <after_phase#> <check_desc> [--who user|supervisor|automated]
  milestone-pass <milestone_id>       Mark milestone as passed
  note <plan_id> <author> "content"   Add a timestamped note
  json [project]                      Plans + phases as JSON for UI
  json-detail <plan_id>               Single plan with phases + tasks + milestones as JSON
  refresh [plan_id]                   Write JSON files for UI polling
HELP
    exit 1
}

ensure_db

[ $# -lt 1 ] && usage

CMD="$1"
shift

case "$CMD" in
    create)
        [ $# -lt 2 ] && { echo "Usage: plan.sh create <project> <title> [options...]" >&2; exit 1; }
        PID=$(resolve_project "$1")
        TITLE_E=$(esc "$2")
        shift 2
        GOAL=""; MOTIVATION=""; APPROACH=""
        CONSTRAINTS="[]"; NON_GOALS="[]"; KEY_DECISIONS="[]"
        STARTING_POINT="[]"; RISKS="[]"; FILE_MAP="[]"
        BOUNDARIES="[]"; MAX_WORKERS=1; SHARED_FILES="[]"
        DONE_CRITERIA="[]"; ROLLBACK=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --goal) shift; GOAL=$(esc "$1") ;;
                --motivation) shift; MOTIVATION=$(esc "$1") ;;
                --approach) shift; APPROACH=$(esc "$1") ;;
                --constraints) shift; CONSTRAINTS=$(esc "$1") ;;
                --non-goals) shift; NON_GOALS=$(esc "$1") ;;
                --key-decisions) shift; KEY_DECISIONS=$(esc "$1") ;;
                --starting-point) shift; STARTING_POINT=$(esc "$1") ;;
                --risks) shift; RISKS=$(esc "$1") ;;
                --file-map) shift; FILE_MAP=$(esc "$1") ;;
                --boundaries) shift; BOUNDARIES=$(esc "$1") ;;
                --max-workers) shift; MAX_WORKERS="$1" ;;
                --shared-files) shift; SHARED_FILES=$(esc "$1") ;;
                --done-criteria) shift; DONE_CRITERIA=$(esc "$1") ;;
                --rollback) shift; ROLLBACK=$(esc "$1") ;;
            esac
            shift
        done
        NEW_ID=$("$SQLITE3" "$DB_PATH" "INSERT INTO plans (project_id, title, goal, motivation, approach,
                                constraints, non_goals, key_decisions,
                                starting_point, risks, file_map, boundaries,
                                max_concurrent_workers, shared_files,
                                done_criteria, rollback_plan)
             VALUES (${PID}, '${TITLE_E}', '${GOAL}', '${MOTIVATION}', '${APPROACH}',
                     '${CONSTRAINTS}', '${NON_GOALS}', '${KEY_DECISIONS}',
                     '${STARTING_POINT}', '${RISKS}', '${FILE_MAP}', '${BOUNDARIES}',
                     ${MAX_WORKERS}, '${SHARED_FILES}',
                     '${DONE_CRITERIA}', '${ROLLBACK}');
             SELECT last_insert_rowid();")
        echo "Created plan #${NEW_ID}"
        ;;

    phase-add)
        [ $# -lt 2 ] && { echo "Usage: plan.sh phase-add <plan_id> <title> [--desc ...] [--gate ...] [--depends ...]" >&2; exit 1; }
        PLAN_ID="$1"
        TITLE_E=$(esc "$2")
        shift 2
        DESC=""; GATE=""; DEPENDS="[]"
        while [ $# -gt 0 ]; do
            case "$1" in
                --desc) shift; DESC=$(esc "$1") ;;
                --gate) shift; GATE=$(esc "$1") ;;
                --depends) shift; DEPENDS="[$(echo "$1" | sed 's/,/, /g')]" ;;
            esac
            shift
        done
        NEXT=$(sql "SELECT COALESCE(MAX(phase_number), 0) + 1 FROM phases WHERE plan_id = ${PLAN_ID};")
        sql "INSERT INTO phases (plan_id, phase_number, title, description, gate_description, depends_on)
             VALUES (${PLAN_ID}, ${NEXT}, '${TITLE_E}', '${DESC}', '${GATE}', '${DEPENDS}');"
        echo "Added phase #${NEXT} to plan #${PLAN_ID}"
        ;;

    phase-status)
        [ $# -lt 3 ] && { echo "Usage: plan.sh phase-status <plan_id> <phase#> <status>" >&2; exit 1; }
        PLAN_ID="$1"; PHASE="$2"; STATUS="$3"
        case "$STATUS" in
            pending|in-progress|done) ;;
            *) echo "Error: Status must be pending, in-progress, or done" >&2; exit 1 ;;
        esac
        sql "UPDATE phases SET status = '${STATUS}', updated_at = '$(ts_now)'
             WHERE plan_id = ${PLAN_ID} AND phase_number = ${PHASE};"
        echo "Phase #${PHASE} of plan #${PLAN_ID} → ${STATUS}"
        ;;

    status)
        [ $# -lt 2 ] && { echo "Usage: plan.sh status <plan_id> <status>" >&2; exit 1; }
        PLAN_ID="$1"; STATUS="$2"
        case "$STATUS" in
            draft|active|paused|completed|abandoned) ;;
            *) echo "Error: Status must be draft, active, paused, completed, or abandoned" >&2; exit 1 ;;
        esac
        sql "UPDATE plans SET status = '${STATUS}', updated_at = '$(ts_now)' WHERE id = ${PLAN_ID};"
        echo "Plan #${PLAN_ID} → ${STATUS}"
        ;;

    list)
        PROJECT_FILTER=""
        STATUS_FILTER=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --status) shift; STATUS_FILTER="AND pl.status = '$(esc "$1")'" ;;
                *) PID=$(resolve_project "$1"); PROJECT_FILTER="AND pl.project_id = ${PID}" ;;
            esac
            shift
        done
        sqlh "SELECT pl.id, pl.title, pl.status,
                     (SELECT count(*) FROM phases ph WHERE ph.plan_id = pl.id) AS phases,
                     (SELECT count(*) FROM phases ph WHERE ph.plan_id = pl.id AND ph.status = 'done') AS done,
                     (SELECT count(*) FROM tasks t JOIN phases ph ON ph.id = t.phase_id WHERE ph.plan_id = pl.id) AS tasks,
                     pl.max_concurrent_workers AS workers,
                     substr(pl.updated_at, 1, 16) AS updated
              FROM plans pl
              WHERE 1=1 ${PROJECT_FILTER} ${STATUS_FILTER}
              ORDER BY pl.id;"
        ;;

    detail)
        [ $# -lt 1 ] && { echo "Usage: plan.sh detail <plan_id>" >&2; exit 1; }
        PID="$1"
        echo "=== PLAN #${PID} ==="
        sqlh "SELECT pl.id, pl.title, pl.status, p.name AS project,
                     pl.max_concurrent_workers AS max_workers,
                     pl.created_at, pl.updated_at
              FROM plans pl JOIN projects p ON p.id = pl.project_id WHERE pl.id = ${PID};"
        echo ""
        echo "--- Goal ---"
        sql "SELECT goal FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Motivation ---"
        sql "SELECT motivation FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Approach ---"
        sql "SELECT approach FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Constraints ---"
        sql "SELECT constraints FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Non-Goals ---"
        sql "SELECT non_goals FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Risks ---"
        sql "SELECT risks FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Shared Files ---"
        sql "SELECT shared_files FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Done Criteria ---"
        sql "SELECT done_criteria FROM plans WHERE id = ${PID};"
        echo ""
        echo "--- Phases ---"
        sqlh "SELECT ph.phase_number AS '#', ph.title, ph.status, ph.gate_description AS gate,
                     ph.depends_on AS deps,
                     (SELECT count(*) FROM tasks t WHERE t.phase_id = ph.id) AS tasks,
                     (SELECT count(*) FROM tasks t WHERE t.phase_id = ph.id AND t.status = 'done') AS done
              FROM phases ph WHERE ph.plan_id = ${PID} ORDER BY ph.phase_number;"
        echo ""
        echo "--- Tasks by Phase ---"
        sqlh "SELECT ph.phase_number AS phase, t.id, t.title, t.status, t.priority AS pri,
                     (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') || '/' ||
                     (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps,
                     COALESCE(w.pane_id, '-') AS pane
              FROM tasks t
              JOIN phases ph ON ph.id = t.phase_id
              LEFT JOIN workers w ON w.id = t.assigned_worker_id
              WHERE ph.plan_id = ${PID}
              ORDER BY ph.phase_number, t.priority, t.id;"
        echo ""
        echo "--- Milestones ---"
        sqlh "SELECT m.id, m.after_phase, m.check_desc AS checkpoint, m.who_approves,
                     CASE m.passed WHEN 1 THEN 'PASSED' ELSE 'pending' END AS status,
                     COALESCE(m.passed_at, '-') AS passed_at
              FROM milestones m WHERE m.plan_id = ${PID} ORDER BY m.after_phase;"
        ;;

    milestone-add)
        [ $# -lt 3 ] && { echo "Usage: plan.sh milestone-add <plan_id> <after_phase#> <check_desc> [--who user|supervisor|automated]" >&2; exit 1; }
        PLAN_ID="$1"; AFTER="$2"; CHECK=$(esc "$3")
        shift 3
        WHO="user"
        while [ $# -gt 0 ]; do
            case "$1" in
                --who) shift; WHO="$1" ;;
            esac
            shift
        done
        sql "INSERT INTO milestones (plan_id, after_phase, check_desc, who_approves)
             VALUES (${PLAN_ID}, ${AFTER}, '${CHECK}', '${WHO}');"
        echo "Milestone added after phase #${AFTER} of plan #${PLAN_ID}"
        ;;

    milestone-pass)
        [ $# -lt 1 ] && { echo "Usage: plan.sh milestone-pass <milestone_id>" >&2; exit 1; }
        sql "UPDATE milestones SET passed = 1, passed_at = '$(ts_now)' WHERE id = $1;"
        echo "Milestone #$1 marked passed"
        ;;

    note)
        [ $# -lt 3 ] && { echo "Usage: plan.sh note <plan_id> <author> \"content\"" >&2; exit 1; }
        PLAN_ID="$1"; AUTHOR="$2"; CONTENT=$(esc "$3")
        NOW=$(ts_now)
        # Append to JSON array in plans.notes
        EXISTING=$(sql "SELECT notes FROM plans WHERE id = ${PLAN_ID};")
        if [ -z "$EXISTING" ] || [ "$EXISTING" = "[]" ]; then
            NEW_NOTES="[{\"author\":\"${AUTHOR}\",\"content\":\"${CONTENT}\",\"timestamp\":\"${NOW}\"}]"
        else
            # Strip trailing ] and append
            NEW_NOTES="${EXISTING%]},{\"author\":\"${AUTHOR}\",\"content\":\"${CONTENT}\",\"timestamp\":\"${NOW}\"}]"
        fi
        sql "UPDATE plans SET notes = '$(esc "$NEW_NOTES")', updated_at = '${NOW}' WHERE id = ${PLAN_ID};"
        echo "Note added to plan #${PLAN_ID}"
        ;;

    json)
        PROJECT_FILTER=""
        if [ $# -ge 1 ]; then
            PID=$(resolve_project "$1")
            PROJECT_FILTER="WHERE pl.project_id = ${PID}"
        fi
        PLANS=$(sqlj "SELECT pl.id, pl.title, pl.status, pl.goal, pl.motivation, pl.approach,
                             pl.max_concurrent_workers,
                             (SELECT count(*) FROM phases ph WHERE ph.plan_id = pl.id) AS phase_count,
                             (SELECT count(*) FROM phases ph WHERE ph.plan_id = pl.id AND ph.status = 'done') AS phases_done,
                             (SELECT count(*) FROM tasks t JOIN phases ph ON ph.id = t.phase_id WHERE ph.plan_id = pl.id) AS task_count,
                             (SELECT count(*) FROM tasks t JOIN phases ph ON ph.id = t.phase_id WHERE ph.plan_id = pl.id AND t.status = 'done') AS tasks_done,
                             pl.updated_at
                      FROM plans pl ${PROJECT_FILTER}
                      ORDER BY pl.id;" 2>/dev/null || echo '[]')
        printf '{"plans":%s}\n' "${PLANS:-[]}"
        ;;

    json-detail)
        [ $# -lt 1 ] && { echo "Usage: plan.sh json-detail <plan_id>" >&2; exit 1; }
        PID="$1"
        PLAN=$(sqlj "SELECT id, title, status, goal, motivation, approach,
                            constraints, non_goals, key_decisions,
                            starting_point, risks, file_map, boundaries,
                            max_concurrent_workers, shared_files,
                            done_criteria, rollback_plan, notes,
                            updated_at
                     FROM plans WHERE id = ${PID};" 2>/dev/null || echo '[]')
        PHASES=$(sqlj "SELECT ph.id, ph.phase_number, ph.title, ph.description, ph.status,
                              ph.gate_description AS gate, ph.depends_on,
                              (SELECT count(*) FROM tasks t WHERE t.phase_id = ph.id) AS task_count,
                              (SELECT count(*) FROM tasks t WHERE t.phase_id = ph.id AND t.status = 'done') AS tasks_done
                       FROM phases ph WHERE ph.plan_id = ${PID}
                       ORDER BY ph.phase_number;" 2>/dev/null || echo '[]')
        TASKS=$(sqlj "SELECT t.id, t.title, t.status, t.priority, t.phase_id,
                             ph.phase_number,
                             COALESCE(t.objective, '') AS objective,
                             COALESCE(t.file_boundaries, '[]') AS file_boundaries,
                             COALESCE(t.conflict_zones, '[]') AS conflict_zones,
                             (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id AND s.status = 'done') AS steps_done,
                             (SELECT count(*) FROM task_steps s WHERE s.task_id = t.id) AS steps_total,
                             COALESCE(w.pane_id, 0) AS worker_pane
                      FROM tasks t
                      JOIN phases ph ON ph.id = t.phase_id
                      LEFT JOIN workers w ON w.id = t.assigned_worker_id
                      WHERE ph.plan_id = ${PID}
                      ORDER BY ph.phase_number, t.priority, t.id;" 2>/dev/null || echo '[]')
        MILESTONES=$(sqlj "SELECT id, after_phase, check_desc, who_approves, passed, passed_at
                           FROM milestones WHERE plan_id = ${PID}
                           ORDER BY after_phase;" 2>/dev/null || echo '[]')
        printf '{"plan":%s,"phases":%s,"tasks":%s,"milestones":%s}' \
            "$PLAN" "${PHASES:-[]}" "${TASKS:-[]}" "${MILESTONES:-[]}" | \
        python3 -c "
import sys,json
d=json.load(sys.stdin)
p=d['plan'][0] if isinstance(d['plan'],list) else d['plan']
p['phases']=d['phases']
p['tasks']=d['tasks']
p['milestones']=d['milestones']
# Parse JSON string fields
for k in ('constraints','non_goals','key_decisions','starting_point','risks',
          'file_map','boundaries','shared_files','done_criteria','notes',
          'parallel_tracks','critical_path','commit_trail'):
    if k in p and isinstance(p[k],str):
        try: p[k]=json.loads(p[k])
        except: pass
print(json.dumps(p))
" 2>/dev/null || {
            PLAN_INNER=$(printf '%s' "$PLAN" | tr -d '[]')
            PLAN_INNER="${PLAN_INNER%\}}"
            printf '%s,"phases":%s,"tasks":%s,"milestones":%s}\n' "$PLAN_INNER" "${PHASES:-[]}" "${TASKS:-[]}" "${MILESTONES:-[]}"
        }
        ;;

    refresh)
        OUT_DIR="/run/user/${UID:-1000}/claude-sessions"
        "$0" json > "${OUT_DIR}/plans_view.json" 2>/dev/null
        if [ $# -ge 1 ]; then
            "$0" json-detail "$1" > "${OUT_DIR}/plan_detail.json" 2>/dev/null
        fi
        ;;

    *)
        echo "Unknown command: ${CMD}" >&2
        usage
        ;;
esac
