--[[
  localstore.lua — SQLite-backed key-value persistence (browser localStorage analog)

  Provides namespaced key-value storage backed by a single SQLite database.
  Values are JSON-encoded. Designed for QoL persistence: theme selection,
  playground code, text input memory, user preferences.

  Usage (Lua-side):
    local localstore = require("lua.localstore")
    localstore.init()
    localstore.set("theme", "selected", "catppuccin")
    local theme = localstore.get("theme", "selected")  -- "catppuccin"

  Usage (React-side via RPC):
    const [value, setValue] = useLocalStore('key', defaultValue, { namespace: 'app' })

  Database: localstore.db in Love2D's save directory.
  Requires: lua/sqlite.lua (libsqlite3)
]]

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then json = nil end

local sqlite = require("lua.sqlite")

local LocalStore = {}

local db = nil  -- lazily opened Database instance

-- ── Initialization ────────────────────────────────────────

--- Open (or create) the localstore database.
--- Safe to call multiple times — subsequent calls are no-ops.
function LocalStore.init()
  if db then return true end
  if not sqlite.available then
    if _G._reactjit_verbose then io.write("[localstore] SQLite unavailable — local store disabled\n"); io.flush() end
    return false
  end

  local ok, result = pcall(sqlite.open, "localstore.db")
  if not ok then
    if _G._reactjit_verbose then io.write("[localstore] Failed to open database: " .. tostring(result) .. "\n"); io.flush() end
    return false
  end

  db = result

  db:exec([[
    CREATE TABLE IF NOT EXISTS store (
      namespace TEXT NOT NULL,
      key       TEXT NOT NULL,
      value     TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (namespace, key)
    )
  ]])

  if _G._reactjit_verbose then io.write("[localstore] Initialized (" .. db.path .. ")\n"); io.flush() end
  return true
end

-- ── Core API ──────────────────────────────────────────────

--- Get a value by namespace and key.
--- @param namespace string
--- @param key string
--- @return any|nil  Decoded JSON value, or nil if not found
function LocalStore.get(namespace, key)
  if not db then return nil end
  local raw = db:scalar(
    "SELECT value FROM store WHERE namespace = ? AND key = ?",
    namespace, key
  )
  if raw == nil then return nil end
  if not json then return raw end
  local ok, decoded = pcall(json.decode, raw)
  if ok then return decoded end
  return raw  -- fallback: return raw string if JSON decode fails
end

--- Set a value by namespace and key.
--- @param namespace string
--- @param key string
--- @param value any  Will be JSON-encoded
function LocalStore.set(namespace, key, value)
  if not db then return false end
  local encoded
  if json then
    encoded = json.encode(value)
  else
    encoded = tostring(value)
  end
  db:exec(
    "INSERT OR REPLACE INTO store (namespace, key, value, updated_at) VALUES (?, ?, ?, ?)",
    namespace, key, encoded, os.time()
  )
  return true
end

--- Delete a single key.
--- @param namespace string
--- @param key string
function LocalStore.delete(namespace, key)
  if not db then return false end
  db:exec("DELETE FROM store WHERE namespace = ? AND key = ?", namespace, key)
  return true
end

--- List all keys in a namespace.
--- @param namespace string
--- @return string[]
function LocalStore.keys(namespace)
  if not db then return {} end
  local rows = db:query("SELECT key FROM store WHERE namespace = ? ORDER BY key", namespace)
  local keys = {}
  for _, row in ipairs(rows) do
    keys[#keys + 1] = row.key
  end
  return keys
end

--- Clear all entries in a namespace, or all namespaces if nil.
--- @param namespace string|nil
function LocalStore.clear(namespace)
  if not db then return false end
  if namespace then
    db:exec("DELETE FROM store WHERE namespace = ?", namespace)
  else
    db:exec("DELETE FROM store")
  end
  return true
end

-- ── RPC handler registry ──────────────────────────────────

function LocalStore.getHandlers()
  return {
    ["localstore:get"] = function(args)
      return LocalStore.get(args.namespace or "app", args.key)
    end,
    ["localstore:set"] = function(args)
      return LocalStore.set(args.namespace or "app", args.key, args.value)
    end,
    ["localstore:delete"] = function(args)
      return LocalStore.delete(args.namespace or "app", args.key)
    end,
    ["localstore:keys"] = function(args)
      return LocalStore.keys(args.namespace or "app")
    end,
    ["localstore:clear"] = function(args)
      return LocalStore.clear(args.namespace)
    end,
  }
end

return LocalStore
