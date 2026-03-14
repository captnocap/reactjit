--[[
  sqlite.lua -- SQLite3 via LuaJIT FFI

  Provides a clean Lua API over libsqlite3.so using the same FFI pattern
  as bridge_quickjs.lua and videos.lua. No external Lua modules needed —
  just the system libsqlite3 shared library.

  Use cases:
    - Game saves / state persistence
    - Playground save/restore
    - Spell check dictionaries
    - User preferences
    - Any structured data that benefits from SQL queries

  Usage:
    local sqlite = require("lua.sqlite")
    local db = sqlite.open("saves.db")      -- or sqlite.open() for in-memory
    db:exec("CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY, data TEXT)")
    db:exec("INSERT INTO saves (data) VALUES (?)", "hello world")
    local rows = db:query("SELECT * FROM saves")
    for _, row in ipairs(rows) do print(row.id, row.data) end
    db:close()

  Requires: libsqlite3.so (apt install libsqlite3-0)
  Fallback: Returns a stub module with .available = false if libsqlite3 not found.
]]

local ffi = require("ffi")

local SQLite = {}
SQLite.available = false

-- ============================================================================
-- FFI declarations — SQLite3 C API subset
-- ============================================================================

ffi.cdef[[
  // Opaque types
  typedef struct sqlite3 sqlite3;
  typedef struct sqlite3_stmt sqlite3_stmt;

  // Return codes
  enum {
    SQLITE_OK         = 0,
    SQLITE_ERROR      = 1,
    SQLITE_BUSY       = 5,
    SQLITE_LOCKED     = 6,
    SQLITE_ROW        = 100,
    SQLITE_DONE       = 101,
    SQLITE_OPEN_READWRITE = 0x00000002,
    SQLITE_OPEN_CREATE    = 0x00000004,
    SQLITE_OPEN_FULLMUTEX = 0x00010000
  };

  // Column types
  enum {
    SQLITE_INTEGER = 1,
    SQLITE_FLOAT   = 2,
    SQLITE_TEXT    = 3,
    SQLITE_BLOB    = 4,
    SQLITE_NULL    = 5
  };

  // Core
  int sqlite3_open_v2(const char *filename, sqlite3 **ppDb, int flags, const char *zVfs);
  int sqlite3_close(sqlite3 *db);
  const char *sqlite3_errmsg(sqlite3 *db);
  int sqlite3_changes(sqlite3 *db);
  long long sqlite3_last_insert_rowid(sqlite3 *db);
  int sqlite3_busy_timeout(sqlite3 *db, int ms);

  // Simple exec (for DDL, simple statements)
  int sqlite3_exec(sqlite3 *db, const char *sql, void *callback, void *arg, char **errmsg);
  void sqlite3_free(void *ptr);

  // Prepared statements
  int sqlite3_prepare_v2(sqlite3 *db, const char *zSql, int nByte, sqlite3_stmt **ppStmt, const char **pzTail);
  int sqlite3_step(sqlite3_stmt *stmt);
  int sqlite3_finalize(sqlite3_stmt *stmt);
  int sqlite3_reset(sqlite3_stmt *stmt);
  int sqlite3_clear_bindings(sqlite3_stmt *stmt);

  // Bind parameters (1-based index)
  int sqlite3_bind_int(sqlite3_stmt *stmt, int idx, int value);
  int sqlite3_bind_int64(sqlite3_stmt *stmt, int idx, long long value);
  int sqlite3_bind_double(sqlite3_stmt *stmt, int idx, double value);
  int sqlite3_bind_text(sqlite3_stmt *stmt, int idx, const char *text, int nBytes, void(*destructor)(void*));
  int sqlite3_bind_blob(sqlite3_stmt *stmt, int idx, const void *data, int nBytes, void(*destructor)(void*));
  int sqlite3_bind_null(sqlite3_stmt *stmt, int idx);
  int sqlite3_bind_parameter_count(sqlite3_stmt *stmt);

  // Column results (0-based index)
  int sqlite3_column_count(sqlite3_stmt *stmt);
  const char *sqlite3_column_name(sqlite3_stmt *stmt, int col);
  int sqlite3_column_type(sqlite3_stmt *stmt, int col);
  int sqlite3_column_int(sqlite3_stmt *stmt, int col);
  long long sqlite3_column_int64(sqlite3_stmt *stmt, int col);
  double sqlite3_column_double(sqlite3_stmt *stmt, int col);
  const unsigned char *sqlite3_column_text(sqlite3_stmt *stmt, int col);
  const void *sqlite3_column_blob(sqlite3_stmt *stmt, int col);
  int sqlite3_column_bytes(sqlite3_stmt *stmt, int col);
]]

-- ============================================================================
-- Load libsqlite3
-- ============================================================================

local lib

--- Resolve a relative path to absolute using love.filesystem.getSource().
--- dlopen resolves relative paths from process CWD, not Love2D's game dir.
--- Same approach as bridge_quickjs.lua.
local function resolveLibPath(relpath)
  if relpath:sub(1, 1) == "/" then return relpath end
  if love and love.filesystem then
    local source = love.filesystem.getSource()
    if source then
      local isFused = love.filesystem.isFused and love.filesystem.isFused()
      local isLoveFile = source:match("%.love$")
      if isFused or isLoveFile then
        source = source:match("(.+)/[^/]+$") or source
      end
      return source .. "/" .. relpath
    end
  end
  return relpath
end

local function loadLibrary()
  -- Try paths in order: project-local bundled, then system
  local isLinux = ffi.os == "Linux"
  local paths
  if isLinux then
    paths = {
      resolveLibPath("lib/libsqlite3.so.0"),  -- project-local (bundled by CLI, .so.0)
      resolveLibPath("lib/libsqlite3.so"),     -- project-local (symlink variant)
      "libsqlite3.so.0",                       -- system (Linux)
      "libsqlite3",                            -- system (let dlopen resolve)
      "sqlite3",                               -- system (canonical name)
    }
  else
    paths = {
      resolveLibPath("lib/libsqlite3.0.dylib"),   -- project-local (bundled by CLI)
      resolveLibPath("lib/libsqlite3.dylib"),      -- project-local (symlink variant)
      "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib",  -- Homebrew (Apple Silicon)
      "/usr/local/opt/sqlite/lib/libsqlite3.dylib",     -- Homebrew (Intel)
      "/usr/lib/libsqlite3.dylib",                       -- macOS system
      "libsqlite3",                                      -- system (let dlopen resolve)
      "sqlite3",                                         -- system (canonical name)
    }
  end

  for _, path in ipairs(paths) do
    local ok, result = pcall(ffi.load, path)
    if ok then
      lib = result
      if _G._reactjit_verbose then io.write("[sqlite] Loaded from " .. path .. "\n"); io.flush() end
      return true
    end
  end

  io.write("[sqlite] WARNING: libsqlite3 not found — SQLite features unavailable\n"); io.flush()
  return false
end

if not loadLibrary() then
  return SQLite  -- .available = false
end

SQLite.available = true

-- ============================================================================
-- Constants
-- ============================================================================

local SQLITE_OK         = 0
local SQLITE_BUSY       = 5
local SQLITE_LOCKED     = 6
local SQLITE_ROW        = 100
local SQLITE_DONE       = 101
local SQLITE_INTEGER    = 1
local SQLITE_FLOAT      = 2
local SQLITE_TEXT       = 3
local SQLITE_BLOB       = 4
local SQLITE_NULL       = 5
local SQLITE_TRANSIENT  = ffi.cast("void(*)(void*)", -1)  -- SQLITE_TRANSIENT = ((void(*)(void*))-1)

-- Default busy timeout in ms. sqlite3_busy_timeout makes SQLite retry internally,
-- but if the lock outlasts this, we do our own app-level retries on top.
local DEFAULT_BUSY_TIMEOUT = 5000
local BUSY_RETRY_ATTEMPTS  = 3
local BUSY_RETRY_DELAY_MS  = 50  -- sleep between app-level retries

-- ============================================================================
-- Busy-resilient helpers
-- ============================================================================

--- Cross-platform millisecond sleep (LuaJIT FFI).
local function sleep_ms(ms)
  local sec = math.floor(ms / 1000)
  local nsec = (ms % 1000) * 1000000
  ffi.C.nanosleep(ffi.new("struct timespec", {sec, nsec}), nil)
end

-- nanosleep struct declaration (safe to call multiple times in cdef)
pcall(ffi.cdef, [[
  struct timespec { long tv_sec; long tv_nsec; };
  int nanosleep(const struct timespec *req, struct timespec *rem);
]])

--- Step a prepared statement with automatic BUSY/LOCKED retry.
--- Returns the final result code. Only errors on non-BUSY failures.
local function busyStep(db, stmt)
  for attempt = 1, BUSY_RETRY_ATTEMPTS + 1 do
    local rc = lib.sqlite3_step(stmt)
    if rc ~= SQLITE_BUSY and rc ~= SQLITE_LOCKED then
      return rc
    end
    -- Last attempt — give up
    if attempt > BUSY_RETRY_ATTEMPTS then
      io.write("[sqlite] Database locked after " .. BUSY_RETRY_ATTEMPTS .. " retries (path: " .. (db.path or "?") .. ")\n")
      io.flush()
      return rc
    end
    -- Reset the statement so it can be re-stepped after the lock clears
    lib.sqlite3_reset(stmt)
    sleep_ms(BUSY_RETRY_DELAY_MS * attempt)  -- linear backoff
  end
end

--- Like sqlite3_exec but retries on BUSY/LOCKED.
local function busyExec(db, sql)
  local errmsg_ptr = ffi.new("char*[1]")
  for attempt = 1, BUSY_RETRY_ATTEMPTS + 1 do
    local rc = lib.sqlite3_exec(db._db, sql, nil, nil, errmsg_ptr)
    if rc ~= SQLITE_BUSY and rc ~= SQLITE_LOCKED then
      return rc, errmsg_ptr
    end
    if errmsg_ptr[0] ~= nil then
      lib.sqlite3_free(errmsg_ptr[0])
      errmsg_ptr[0] = nil
    end
    if attempt > BUSY_RETRY_ATTEMPTS then
      io.write("[sqlite] Database locked after " .. BUSY_RETRY_ATTEMPTS .. " retries on exec (path: " .. (db.path or "?") .. ")\n")
      io.flush()
      return rc, errmsg_ptr
    end
    sleep_ms(BUSY_RETRY_DELAY_MS * attempt)
  end
end

-- ============================================================================
-- Database object
-- ============================================================================

local Database = {}
Database.__index = Database

--- Open a SQLite database.
--- @param path string|nil  File path, or nil/":memory:" for in-memory database.
---                          Relative paths resolve from Love2D's save directory.
--- @return Database
function SQLite.open(path)
  path = path or ":memory:"

  -- For non-memory, non-absolute paths, resolve via Love2D save directory
  -- so game saves persist properly across runs
  if path ~= ":memory:" and path:sub(1, 1) ~= "/" then
    if love and love.filesystem then
      local saveDir = love.filesystem.getSaveDirectory()
      -- Ensure save directory exists
      love.filesystem.createDirectory("")
      path = saveDir .. "/" .. path
    end
  end

  local db_ptr = ffi.new("sqlite3*[1]")
  local flags = 0x00000002 + 0x00000004 + 0x00010000  -- READWRITE | CREATE | FULLMUTEX
  local rc = lib.sqlite3_open_v2(path, db_ptr, flags, nil)

  if rc ~= SQLITE_OK then
    local err = "Failed to open database"
    if db_ptr[0] ~= nil then
      err = ffi.string(lib.sqlite3_errmsg(db_ptr[0]))
      lib.sqlite3_close(db_ptr[0])
    end
    error("[sqlite] " .. err .. " (path: " .. path .. ")")
  end

  local self = setmetatable({
    _stmtCache = {},    -- prepared statement cache
    _closed = false,
    path = path,
  }, Database)

  -- GC safety: store the GC-wrapped pointer as _db itself so it stays alive
  -- as long as the Database object exists. If the user forgets to close(),
  -- the finalizer will clean up when the Database is collected.
  self._db = ffi.gc(db_ptr[0], function(ptr)
    if not self._closed then self:close() end
  end)

  -- Set busy timeout FIRST so the WAL pragma doesn't crash on a locked db.
  -- This makes SQLite internally retry for up to N ms before returning SQLITE_BUSY.
  lib.sqlite3_busy_timeout(self._db, DEFAULT_BUSY_TIMEOUT)

  -- Enable WAL mode for better concurrent read/write performance
  self:exec("PRAGMA journal_mode=WAL")
  -- Foreign keys on by default
  self:exec("PRAGMA foreign_keys=ON")

  return self
end

--- Close the database. Safe to call multiple times.
function Database:close()
  if self._closed then return end
  self._closed = true

  -- Finalize all cached statements
  for sql, stmt in pairs(self._stmtCache) do
    lib.sqlite3_finalize(stmt)
  end
  self._stmtCache = {}

  lib.sqlite3_close(self._db)
  self._db = nil
end

--- Check if database is open.
function Database:isOpen()
  return not self._closed
end

-- ============================================================================
-- Error handling
-- ============================================================================

local function checkOk(db, rc)
  if rc == SQLITE_OK then return end
  if rc == SQLITE_BUSY or rc == SQLITE_LOCKED then
    error("[sqlite] Database is locked — another connection holds the lock (path: " .. (db.path or "?") .. ")")
  end
  error("[sqlite] " .. ffi.string(lib.sqlite3_errmsg(db._db)))
end

-- ============================================================================
-- Binding helpers
-- ============================================================================

--- Bind a Lua value to a prepared statement parameter.
local function bindValue(stmt, idx, value)
  if value == nil then
    return lib.sqlite3_bind_null(stmt, idx)
  end

  local t = type(value)
  if t == "number" then
    -- Use int64 for integers, double for floats
    if value == math.floor(value) and value >= -2^53 and value <= 2^53 then
      return lib.sqlite3_bind_int64(stmt, idx, value)
    else
      return lib.sqlite3_bind_double(stmt, idx, value)
    end
  elseif t == "string" then
    return lib.sqlite3_bind_text(stmt, idx, value, #value, SQLITE_TRANSIENT)
  elseif t == "boolean" then
    return lib.sqlite3_bind_int(stmt, idx, value and 1 or 0)
  elseif t == "cdata" then
    -- Assume blob
    return lib.sqlite3_bind_blob(stmt, idx, value, ffi.sizeof(value), SQLITE_TRANSIENT)
  else
    return lib.sqlite3_bind_null(stmt, idx)
  end
end

--- Bind all parameters to a prepared statement.
local function bindAll(db, stmt, params)
  if not params then return end

  if type(params) == "table" then
    for i, v in ipairs(params) do
      local rc = bindValue(stmt, i, v)
      if rc ~= SQLITE_OK then
        checkOk(db, rc)
      end
    end
  else
    -- Single value (convenience for single-param queries)
    local rc = bindValue(stmt, 1, params)
    if rc ~= SQLITE_OK then
      checkOk(db, rc)
    end
  end
end

-- ============================================================================
-- Column extraction
-- ============================================================================

--- Extract a column value from a result row.
local function extractColumn(stmt, col)
  local colType = lib.sqlite3_column_type(stmt, col)

  if colType == SQLITE_NULL then
    return nil
  elseif colType == SQLITE_INTEGER then
    return tonumber(lib.sqlite3_column_int64(stmt, col))
  elseif colType == SQLITE_FLOAT then
    return lib.sqlite3_column_double(stmt, col)
  elseif colType == SQLITE_TEXT then
    return ffi.string(lib.sqlite3_column_text(stmt, col))
  elseif colType == SQLITE_BLOB then
    local size = lib.sqlite3_column_bytes(stmt, col)
    if size == 0 then return "" end
    return ffi.string(lib.sqlite3_column_blob(stmt, col), size)
  end
  return nil
end

--- Extract a full row as a table with column-name keys.
local function extractRow(stmt)
  local count = lib.sqlite3_column_count(stmt)
  local row = {}
  for i = 0, count - 1 do
    local name = ffi.string(lib.sqlite3_column_name(stmt, i))
    row[name] = extractColumn(stmt, i)
  end
  return row
end

-- ============================================================================
-- Statement preparation (with caching)
-- ============================================================================

--- Get or create a prepared statement. Cached statements are reused.
local function prepare(db, sql)
  local cached = db._stmtCache[sql]
  if cached then
    lib.sqlite3_reset(cached)
    lib.sqlite3_clear_bindings(cached)
    return cached
  end

  local stmt_ptr = ffi.new("sqlite3_stmt*[1]")
  local rc = lib.sqlite3_prepare_v2(db._db, sql, #sql, stmt_ptr, nil)
  if rc ~= SQLITE_OK then
    checkOk(db, rc)
  end

  db._stmtCache[sql] = stmt_ptr[0]
  return stmt_ptr[0]
end

-- ============================================================================
-- Public query API
-- ============================================================================

--- Execute a SQL statement with optional parameters. Returns nothing.
--- Good for INSERT, UPDATE, DELETE, CREATE, DDL.
---
--- Parameters can be passed as varargs after the SQL string:
---   db:exec("INSERT INTO t VALUES (?, ?)", "hello", 42)
---
--- Or as a table:
---   db:exec("INSERT INTO t VALUES (?, ?)", {"hello", 42})
---
--- @param sql string  SQL statement
--- @param ... any     Parameters to bind
function Database:exec(sql, ...)
  assert(not self._closed, "[sqlite] Database is closed")

  local args = {...}
  local params

  -- No params: use simple exec for DDL/multi-statement
  if #args == 0 then
    local rc, errmsg_ptr = busyExec(self, sql)
    if rc ~= SQLITE_OK then
      if rc == SQLITE_BUSY or rc == SQLITE_LOCKED then
        error("[sqlite] Database is locked — timed out after retries (path: " .. (self.path or "?") .. ")")
      end
      local err = ffi.string(errmsg_ptr[0])
      lib.sqlite3_free(errmsg_ptr[0])
      error("[sqlite] " .. err)
    end
    return
  end

  -- Has params: use prepared statement
  if #args == 1 and type(args[1]) == "table" then
    params = args[1]
  else
    params = args
  end

  local stmt = prepare(self, sql)
  bindAll(self, stmt, params)

  local rc = busyStep(self, stmt)
  if rc ~= SQLITE_DONE and rc ~= SQLITE_ROW then
    checkOk(self, rc)
  end
end

--- Execute a query and return all result rows as an array of tables.
--- Each row is a table with column names as keys.
---
---   local rows = db:query("SELECT * FROM users WHERE age > ?", 18)
---   for _, row in ipairs(rows) do print(row.name, row.age) end
---
--- @param sql string  SQL query
--- @param ... any     Parameters to bind
--- @return table[]    Array of row tables
function Database:query(sql, ...)
  assert(not self._closed, "[sqlite] Database is closed")

  local args = {...}
  local params
  if #args == 1 and type(args[1]) == "table" then
    params = args[1]
  elseif #args > 0 then
    params = args
  end

  local stmt = prepare(self, sql)
  bindAll(self, stmt, params)

  local rows = {}
  while true do
    local rc = busyStep(self, stmt)
    if rc == SQLITE_ROW then
      rows[#rows + 1] = extractRow(stmt)
    elseif rc == SQLITE_DONE then
      break
    else
      checkOk(self, rc)
    end
  end

  return rows
end

--- Execute a query and return the first row, or nil.
---
---   local user = db:queryOne("SELECT * FROM users WHERE id = ?", 1)
---   if user then print(user.name) end
---
--- @param sql string  SQL query
--- @param ... any     Parameters to bind
--- @return table|nil  Single row table, or nil if no results
function Database:queryOne(sql, ...)
  assert(not self._closed, "[sqlite] Database is closed")

  local args = {...}
  local params
  if #args == 1 and type(args[1]) == "table" then
    params = args[1]
  elseif #args > 0 then
    params = args
  end

  local stmt = prepare(self, sql)
  bindAll(self, stmt, params)

  local rc = busyStep(self, stmt)
  if rc == SQLITE_ROW then
    return extractRow(stmt)
  elseif rc == SQLITE_DONE then
    return nil
  else
    checkOk(self, rc)
  end
end

--- Execute a query and return a single scalar value (first column of first row).
---
---   local count = db:scalar("SELECT COUNT(*) FROM users")
---   local name = db:scalar("SELECT name FROM users WHERE id = ?", 1)
---
--- @param sql string  SQL query
--- @param ... any     Parameters to bind
--- @return any|nil    Scalar value, or nil if no results
function Database:scalar(sql, ...)
  assert(not self._closed, "[sqlite] Database is closed")

  local args = {...}
  local params
  if #args == 1 and type(args[1]) == "table" then
    params = args[1]
  elseif #args > 0 then
    params = args
  end

  local stmt = prepare(self, sql)
  bindAll(self, stmt, params)

  local rc = busyStep(self, stmt)
  if rc == SQLITE_ROW then
    return extractColumn(stmt, 0)
  elseif rc == SQLITE_DONE then
    return nil
  else
    checkOk(self, rc)
  end
end

--- Check if a query returns any rows (EXISTS shortcut).
---
---   if db:exists("SELECT 1 FROM users WHERE name = ?", "alice") then ... end
---
--- @param sql string  SQL query
--- @param ... any     Parameters to bind
--- @return boolean
function Database:exists(sql, ...)
  return self:scalar(sql, ...) ~= nil
end

-- ============================================================================
-- Transactions
-- ============================================================================

--- Execute a function inside a transaction.
--- If the function succeeds, the transaction is committed.
--- If it throws, the transaction is rolled back and the error re-thrown.
---
---   db:transaction(function()
---     db:exec("INSERT INTO accounts (name, balance) VALUES (?, ?)", "alice", 100)
---     db:exec("INSERT INTO accounts (name, balance) VALUES (?, ?)", "bob", 200)
---   end)
---
--- @param fn function  Function to execute inside the transaction
function Database:transaction(fn)
  assert(not self._closed, "[sqlite] Database is closed")
  self:exec("BEGIN")
  local ok, err = pcall(fn)
  if ok then
    self:exec("COMMIT")
  else
    self:exec("ROLLBACK")
    error(err)
  end
end

-- ============================================================================
-- Utility
-- ============================================================================

--- Return the number of rows changed by the last INSERT/UPDATE/DELETE.
function Database:changes()
  assert(not self._closed, "[sqlite] Database is closed")
  return tonumber(lib.sqlite3_changes(self._db))
end

--- Return the rowid of the last INSERT.
function Database:lastInsertId()
  assert(not self._closed, "[sqlite] Database is closed")
  return tonumber(lib.sqlite3_last_insert_rowid(self._db))
end

--- Clear the prepared statement cache. Call if schema changes.
function Database:clearCache()
  for sql, stmt in pairs(self._stmtCache) do
    lib.sqlite3_finalize(stmt)
  end
  self._stmtCache = {}
end

--- Set the busy timeout in milliseconds. Default is 5000ms.
--- SQLite will internally retry for up to this duration before returning SQLITE_BUSY.
--- @param ms number  Timeout in milliseconds (0 = no waiting, fail immediately)
function Database:setBusyTimeout(ms)
  assert(not self._closed, "[sqlite] Database is closed")
  lib.sqlite3_busy_timeout(self._db, ms)
end

--- Safe exec — returns true on success, or false + error message on failure.
--- Use this when you want to handle errors without crashing.
---
---   local ok, err = db:tryExec("INSERT INTO t VALUES (?)", data)
---   if not ok then print("Write failed: " .. err) end
---
--- @param sql string  SQL statement
--- @param ... any     Parameters to bind
--- @return boolean, string|nil
function Database:tryExec(sql, ...)
  local ok, err = pcall(self.exec, self, sql, ...)
  if ok then return true end
  return false, tostring(err)
end

--- Safe query — returns rows on success, or nil + error message on failure.
---
---   local rows, err = db:tryQuery("SELECT * FROM t")
---   if not rows then print("Query failed: " .. err) end
---
--- @param sql string  SQL query
--- @param ... any     Parameters to bind
--- @return table[]|nil, string|nil
function Database:tryQuery(sql, ...)
  local ok, result = pcall(self.query, self, sql, ...)
  if ok then return result end
  return nil, tostring(result)
end

--- Safe transaction — returns true on success, or false + error message on failure.
--- The transaction is rolled back on failure.
---
---   local ok, err = db:tryTransaction(function()
---     db:exec("INSERT INTO t VALUES (?)", data)
---   end)
---   if not ok then print("Transaction failed: " .. err) end
---
--- @param fn function  Function to execute inside the transaction
--- @return boolean, string|nil
function Database:tryTransaction(fn)
  local ok, err = pcall(self.transaction, self, fn)
  if ok then return true end
  return false, tostring(err)
end

return SQLite
