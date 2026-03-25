-- Supervisor Dashboard Schema — Unified
-- SQLite 3.x — Full plan/phase/task/step hierarchy
-- This is the single source of truth. task-schema.sql and plan-schema.sql are legacy.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- Core tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    repo_path   TEXT DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id),
    pane_id         INTEGER NOT NULL,
    session_id      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'stuck')),
    current_task_id INTEGER,  -- FK added after tasks table exists
    registered_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_seen_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id),
    worker_id    INTEGER REFERENCES workers(id),
    event_type   TEXT NOT NULL,
    payload_json TEXT DEFAULT '{}',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    worker_id  INTEGER REFERENCES workers(id),
    jsonl_path TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ended_at   TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    timestamp  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Full-text search on message content
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

-- =============================================================================
-- Plans: high-level goals broken into phases
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'abandoned')),
    goal            TEXT DEFAULT '',
    motivation      TEXT DEFAULT '',
    approach        TEXT DEFAULT '',
    constraints     TEXT DEFAULT '[]',   -- JSON array
    non_goals       TEXT DEFAULT '[]',   -- JSON array
    key_decisions   TEXT DEFAULT '[]',   -- JSON array
    starting_point  TEXT DEFAULT '[]',   -- JSON array
    known_problems  TEXT DEFAULT '[]',   -- JSON array
    dependencies    TEXT DEFAULT '[]',   -- JSON array
    risks           TEXT DEFAULT '[]',   -- JSON array
    file_map        TEXT DEFAULT '[]',   -- JSON array
    boundaries      TEXT DEFAULT '[]',   -- JSON array — off-limits areas
    parallel_tracks TEXT DEFAULT '[]',   -- JSON array
    critical_path   TEXT DEFAULT '[]',   -- JSON array
    max_concurrent_workers INTEGER NOT NULL DEFAULT 1,
    shared_files    TEXT DEFAULT '[]',   -- JSON array
    done_criteria   TEXT DEFAULT '[]',   -- JSON array
    rollback_plan   TEXT DEFAULT '',
    changelog_entry TEXT DEFAULT '',
    commit_trail    TEXT DEFAULT '[]',   -- JSON array of {hash, summary}
    notes           TEXT DEFAULT '[]',   -- JSON array of {author, content, timestamp}
    created_by      TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('supervisor', 'user')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Phases: ordered groups of tasks within a plan
-- =============================================================================

CREATE TABLE IF NOT EXISTS phases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    phase_number     INTEGER NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in-progress', 'done')),
    gate_description TEXT DEFAULT '',
    depends_on       TEXT DEFAULT '[]',   -- JSON array of phase numbers
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Milestones: checkpoints between phases
-- =============================================================================

CREATE TABLE IF NOT EXISTS milestones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id       INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    after_phase   INTEGER NOT NULL,      -- phase_number this follows
    check_desc    TEXT NOT NULL,
    who_approves  TEXT NOT NULL DEFAULT 'user' CHECK (who_approves IN ('user', 'supervisor', 'automated')),
    passed        INTEGER NOT NULL DEFAULT 0,
    passed_at     TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Tasks: actionable work with steps (full task-schema.md fields)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id          INTEGER NOT NULL REFERENCES projects(id),
    phase_id            INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    spec_text           TEXT DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'backlog'
                        CHECK (status IN ('backlog', 'assigned', 'in-progress', 'review', 'done', 'blocked')),
    priority            INTEGER NOT NULL DEFAULT 3,
    -- Description fields
    objective           TEXT DEFAULT '',
    context             TEXT DEFAULT '',
    acceptance_criteria TEXT DEFAULT '[]',   -- JSON array of strings
    -- Existing state
    known_exists        TEXT DEFAULT '[]',   -- JSON array
    known_gaps          TEXT DEFAULT '[]',   -- JSON array
    -- Validation
    tests               TEXT DEFAULT '[]',   -- JSON array of {test_name, test_type, test_command, expected_result}
    visual_verification TEXT DEFAULT '',
    -- Documentation
    docs_required       TEXT DEFAULT '[]',   -- JSON array of {doc_path, doc_scope}
    commit_trail        TEXT DEFAULT '[]',   -- JSON array of {hash, summary}
    changelog_entry     TEXT DEFAULT '',
    -- Worker assignment
    max_workers         INTEGER NOT NULL DEFAULT 1,
    assigned_worker_id  INTEGER REFERENCES workers(id),
    file_boundaries     TEXT DEFAULT '[]',   -- JSON array of directory/file paths
    conflict_zones      TEXT DEFAULT '[]',   -- JSON array of files needing sequential access
    -- Status
    blocked_by          TEXT DEFAULT '',     -- task id or description
    created_by          TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('supervisor', 'user')),
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Task steps: atomic units of work
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in-progress', 'done', 'blocked')),
    files_touched TEXT DEFAULT '[]',   -- JSON array of file paths
    depends_on    TEXT DEFAULT '[]',   -- JSON array of step numbers
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Task edits: file changes logged per task
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_edits (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_id      INTEGER REFERENCES task_steps(id) ON DELETE SET NULL,
    worker_id    INTEGER REFERENCES workers(id),
    file_path    TEXT NOT NULL,
    edit_summary TEXT NOT NULL DEFAULT '',
    diff_snippet TEXT DEFAULT '',
    timestamp    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Task notes: discussion thread per task
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_notes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author    TEXT NOT NULL CHECK (author IN ('supervisor', 'worker', 'user')),
    content   TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Worker assignments: tracks which workers handle which phases/tasks
-- =============================================================================

CREATE TABLE IF NOT EXISTS worker_assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id     INTEGER REFERENCES plans(id) ON DELETE CASCADE,
    task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id   INTEGER NOT NULL REFERENCES workers(id),
    assigned_steps TEXT DEFAULT '[]',  -- JSON array of step numbers
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Violation rules: semantic nets that flag worker behavior
-- =============================================================================

CREATE TABLE IF NOT EXISTS violation_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,
    pattern     TEXT NOT NULL,          -- regex pattern to match against worker output/edits
    action      TEXT NOT NULL DEFAULT 'flag'
                CHECK (action IN ('flag', 'pause', 'deny')),
    description TEXT DEFAULT '',
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS violation_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id     INTEGER NOT NULL REFERENCES violation_rules(id),
    worker_id   INTEGER REFERENCES workers(id),
    task_id     INTEGER REFERENCES tasks(id),
    matched_text TEXT NOT NULL,         -- the text that triggered the rule
    action_taken TEXT NOT NULL,         -- flag/pause/deny
    resolved    INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority  ON tasks(project_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_phase     ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_workers_project ON workers(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project  ON events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_plans_project   ON plans(project_id, status);
CREATE INDEX IF NOT EXISTS idx_phases_plan     ON phases(plan_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_steps_task      ON task_steps(task_id, step_number);
CREATE INDEX IF NOT EXISTS idx_edits_task      ON task_edits(task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_notes_task      ON task_notes(task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_milestones_plan ON milestones(plan_id, after_phase);
CREATE INDEX IF NOT EXISTS idx_worker_assign   ON worker_assignments(plan_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_violation_rules ON violation_rules(project_id, enabled);
CREATE INDEX IF NOT EXISTS idx_violation_log   ON violation_log(rule_id, created_at);
