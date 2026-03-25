#!/usr/bin/env bash
set -euo pipefail

DB_DIR="/run/user/${UID:-1000}/claude-sessions"
DB_PATH="${DB_DIR}/supervisor.db"
SCHEMA_DIR="$(cd "$(dirname "$0")" && pwd)"
SQLITE3="${SQLITE3:-$(command -v sqlite3 2>/dev/null || echo /home/siah/miniconda3/bin/sqlite3)}"

mkdir -p "$DB_DIR"

echo "Initializing supervisor DB at ${DB_PATH}"

# Apply unified schema (idempotent — all CREATE IF NOT EXISTS)
"$SQLITE3" "$DB_PATH" < "${SCHEMA_DIR}/schema.sql"

# Seed projects
"$SQLITE3" "$DB_PATH" <<'SQL'
INSERT OR IGNORE INTO projects (name, description, repo_path)
VALUES
    ('supervisor', 'Supervisor dashboard itself', ''),
    ('reactjit', 'ReactJIT framework — tsz compiler + runtime', '/home/siah/creative/reactjit');
SQL

echo "Done. Projects seeded:"
"$SQLITE3" "$DB_PATH" "SELECT id, name, repo_path FROM projects;"
