/*
 * supervisor_shim.c — FFI bridge for supervisor dashboard
 *
 * Queries supervisor.db using the linked sqlite3 library (no external CLI).
 * Writes a combined JSON view file that the script layer reads via __fs_readfile.
 * Called by useFFI(sv_refresh, 3000) as a polling trigger.
 */

#include <sqlite3.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define BUF_SIZE (64 * 1024)
#define DB_PATH_FMT  "/run/user/%d/claude-sessions/supervisor.db"
#define OUT_PATH_FMT "/run/user/%d/claude-sessions/supervisor_view.json"

static char g_buf[BUF_SIZE];
static char g_db_path[256];
static char g_out_path[256];
static int  g_paths_init = 0;
static int  buf_pos;

static void init_paths(void) {
    if (g_paths_init) return;
    int uid = (int)getuid();
    snprintf(g_db_path, sizeof(g_db_path), DB_PATH_FMT, uid);
    snprintf(g_out_path, sizeof(g_out_path), OUT_PATH_FMT, uid);
    g_paths_init = 1;
}

static void buf_reset(void) { buf_pos = 0; g_buf[0] = '\0'; }

static void buf_cat(const char *s) {
    int len = (int)strlen(s);
    if (buf_pos + len >= BUF_SIZE - 1) return;
    memcpy(g_buf + buf_pos, s, len);
    buf_pos += len;
    g_buf[buf_pos] = '\0';
}

static void buf_esc(const char *s) {
    if (!s) { buf_cat("\"\""); return; }
    buf_cat("\"");
    for (const char *p = s; *p; p++) {
        if (buf_pos >= BUF_SIZE - 8) break;
        switch (*p) {
            case '"':  buf_cat("\\\""); break;
            case '\\': buf_cat("\\\\"); break;
            case '\n': buf_cat("\\n");  break;
            case '\r': buf_cat("\\r");  break;
            case '\t': buf_cat("\\t");  break;
            default:   g_buf[buf_pos++] = *p; g_buf[buf_pos] = '\0';
        }
    }
    buf_cat("\"");
}

static void buf_int(int v) {
    char tmp[20];
    snprintf(tmp, sizeof(tmp), "%d", v);
    buf_cat(tmp);
}

static void emit_tasks(sqlite3 *db) {
    buf_cat("\"tasks\":[");
    sqlite3_stmt *stmt = NULL;
    const char *sql =
        "SELECT t.id, t.title, t.status, t.spec_text,"
        "       COALESCE(w.session_id, ''), COALESCE(w.pane_id, 0)"
        " FROM tasks t"
        " LEFT JOIN workers w ON w.id = t.assigned_worker_id"
        " WHERE t.project_id = (SELECT id FROM projects WHERE name = 'reactjit')"
        " ORDER BY t.id";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
        int first = 1;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) buf_cat(",");
            first = 0;
            buf_cat("{\"id\":"); buf_int(sqlite3_column_int(stmt, 0));
            buf_cat(",\"title\":"); buf_esc((const char*)sqlite3_column_text(stmt, 1));
            buf_cat(",\"status\":"); buf_esc((const char*)sqlite3_column_text(stmt, 2));
            buf_cat(",\"spec\":"); buf_esc((const char*)sqlite3_column_text(stmt, 3));
            buf_cat(",\"worker_session\":"); buf_esc((const char*)sqlite3_column_text(stmt, 4));
            buf_cat(",\"worker_pane\":"); buf_int(sqlite3_column_int(stmt, 5));
            buf_cat("}");
        }
        sqlite3_finalize(stmt);
    }
    buf_cat("]");
}

static void emit_workers(sqlite3 *db) {
    buf_cat("\"workers\":[");
    sqlite3_stmt *stmt = NULL;
    const char *sql =
        "SELECT w.id, w.pane_id, w.session_id, w.status,"
        "       COALESCE(t.title, ''), w.last_seen_at"
        " FROM workers w"
        " LEFT JOIN tasks t ON t.id = w.current_task_id"
        " WHERE w.project_id = (SELECT id FROM projects WHERE name = 'reactjit')"
        " ORDER BY w.last_seen_at DESC";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
        int first = 1;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) buf_cat(",");
            first = 0;
            buf_cat("{\"id\":"); buf_int(sqlite3_column_int(stmt, 0));
            buf_cat(",\"pane_id\":"); buf_int(sqlite3_column_int(stmt, 1));
            buf_cat(",\"session_id\":"); buf_esc((const char*)sqlite3_column_text(stmt, 2));
            buf_cat(",\"status\":"); buf_esc((const char*)sqlite3_column_text(stmt, 3));
            buf_cat(",\"current_task\":"); buf_esc((const char*)sqlite3_column_text(stmt, 4));
            buf_cat(",\"last_seen_at\":"); buf_esc((const char*)sqlite3_column_text(stmt, 5));
            buf_cat("}");
        }
        sqlite3_finalize(stmt);
    }
    buf_cat("]");
}

static void emit_events(sqlite3 *db) {
    buf_cat("\"events\":[");
    sqlite3_stmt *stmt = NULL;
    const char *sql =
        "SELECT e.id, e.event_type, e.payload_json, e.created_at,"
        "       COALESCE(w.session_id, '')"
        " FROM events e"
        " LEFT JOIN workers w ON w.id = e.worker_id"
        " WHERE e.project_id = (SELECT id FROM projects WHERE name = 'reactjit')"
        " ORDER BY e.created_at DESC LIMIT 20";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
        int first = 1;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) buf_cat(",");
            first = 0;
            buf_cat("{\"id\":"); buf_int(sqlite3_column_int(stmt, 0));
            buf_cat(",\"event_type\":"); buf_esc((const char*)sqlite3_column_text(stmt, 1));
            buf_cat(",\"payload_json\":"); buf_esc((const char*)sqlite3_column_text(stmt, 2));
            buf_cat(",\"created_at\":"); buf_esc((const char*)sqlite3_column_text(stmt, 3));
            buf_cat(",\"worker_session\":"); buf_esc((const char*)sqlite3_column_text(stmt, 4));
            buf_cat("}");
        }
        sqlite3_finalize(stmt);
    }
    buf_cat("]");
}

long sv_refresh(void) {
    init_paths();

    sqlite3 *db = NULL;
    if (sqlite3_open_v2(g_db_path, &db, SQLITE_OPEN_READONLY, NULL) != SQLITE_OK) {
        if (db) sqlite3_close(db);
        return 0;
    }

    buf_reset();
    buf_cat("{");
    emit_tasks(db);
    buf_cat(",");
    emit_workers(db);
    buf_cat(",");
    emit_events(db);
    buf_cat("}");

    sqlite3_close(db);

    /* Write atomically: tmp file + rename */
    char tmp_path[280];
    snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", g_out_path);
    FILE *f = fopen(tmp_path, "w");
    if (f) {
        fwrite(g_buf, 1, buf_pos, f);
        fclose(f);
        rename(tmp_path, g_out_path);
    }

    return 1;
}
