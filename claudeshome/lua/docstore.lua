--[[
  docstore.lua -- Schema-free document store over SQLite

  Gives users a MongoDB-like API where they just throw JSON objects at
  collections and query them back. No schema, no migrations, no SQL.
  Under the hood it's a single SQLite table using json_extract() for queries.

  Usage:
    local docstore = require("lua.docstore")
    local db = docstore.open("game.db")    -- or docstore.open() for in-memory

    db:save("players", { name = "Link", hp = 100 })
    db:save("players", { name = "Zelda", hp = 80, role = "princess" })

    local all = db:find("players")
    local strong = db:find("players", { hp = { gte = 50 } })
    local link = db:findOne("players", { name = "Link" })

    db:update("players", link._id, { hp = 120 })
    db:remove("players", link._id)

  Query operators:
    { field = value }                -- exact match (eq)
    { field = { gt = 10 } }         -- greater than
    { field = { gte = 10 } }        -- greater than or equal
    { field = { lt = 10 } }         -- less than
    { field = { lte = 10 } }        -- less than or equal
    { field = { ne = "x" } }        -- not equal
    { field = { like = "%pat%" } }  -- SQL LIKE pattern
    { field = { contains = "x" } }  -- JSON array contains value

  Multiple fields are AND'd together.

  Requires: lua/sqlite.lua (loaded automatically)
]]

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then error("[docstore] JSON library required") end

local sqlite = require("lua.sqlite")

local DocStore = {}
DocStore.available = sqlite.available

if not sqlite.available then
  return DocStore
end

-- ============================================================================
-- UUID generation (simple random hex)
-- ============================================================================

local function uuid()
  local template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  return (template:gsub("[xy]", function(c)
    local v = (c == "x") and math.random(0, 15) or math.random(8, 11)
    return string.format("%x", v)
  end))
end

-- ============================================================================
-- Query builder — translates Mongo-like queries to SQL WHERE clauses
-- ============================================================================

local OPERATORS = {
  eq   = "=",
  gt   = ">",
  gte  = ">=",
  lt   = "<",
  lte  = "<=",
  ne   = "!=",
  like = "LIKE",
}

--- Sanitize a field name to prevent SQL injection.
--- Allows alphanumeric, underscore, and dot (for nested paths like "stats.hp").
--- Strips everything else.
local function sanitizeField(field)
  return field:gsub("[^%w_%.]", "")
end

--- Build a WHERE clause and params array from a query table.
--- Returns sql_fragment, params_array
---
--- Supports dot notation for nested fields:
---   { ["stats.hp"] = { gte = 50 } }  →  json_extract(data, '$.stats.hp') >= 50
local function buildWhere(collection, query)
  local clauses = { "collection = ?" }
  local params = { collection }

  if query then
    for field, condition in pairs(query) do
      local safeField = sanitizeField(field)
      if safeField == "" then goto continue end

      if type(condition) == "table" then
        -- Check if this is an operator query or a nested value
        -- Operator tables have string keys that match known operators
        local isOperator = false
        for op, _ in pairs(condition) do
          if OPERATORS[op] or op == "contains" then
            isOperator = true
            break
          end
        end

        if isOperator then
          for op, value in pairs(condition) do
            if op == "contains" then
              -- JSON array contains: EXISTS (SELECT 1 FROM json_each(data, '$.field') WHERE value = ?)
              clauses[#clauses + 1] = string.format(
                "EXISTS (SELECT 1 FROM json_each(data, '$.%s') WHERE value = ?)",
                safeField
              )
              params[#params + 1] = value
            elseif OPERATORS[op] then
              clauses[#clauses + 1] = string.format(
                "json_extract(data, '$.%s') %s ?", safeField, OPERATORS[op]
              )
              params[#params + 1] = value
            end
          end
        else
          -- Not an operator — treat as exact match on the JSON value
          clauses[#clauses + 1] = string.format("json_extract(data, '$.%s') = ?", safeField)
          params[#params + 1] = json.encode(condition)
        end
      else
        -- Direct value: exact match
        clauses[#clauses + 1] = string.format("json_extract(data, '$.%s') = ?", safeField)
        params[#params + 1] = condition
      end

      ::continue::
    end
  end

  return table.concat(clauses, " AND "), params
end

-- ============================================================================
-- Store object
-- ============================================================================

local Store = {}
Store.__index = Store

--- Open a document store backed by a SQLite database.
--- @param path string|nil  Database file path, or nil for in-memory.
--- @return Store
function DocStore.open(path)
  local db = sqlite.open(path)

  -- Create the documents table if it doesn't exist
  db:exec([[
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      data JSON NOT NULL,
      created_at REAL NOT NULL DEFAULT (julianday('now')),
      updated_at REAL NOT NULL DEFAULT (julianday('now'))
    )
  ]])
  db:exec([[
    CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection)
  ]])

  return setmetatable({
    _db = db,
    _closed = false,
  }, Store)
end

--- Close the store.
function Store:close()
  if self._closed then return end
  self._closed = true
  self._db:close()
end

--- Check if store is open.
function Store:isOpen()
  return not self._closed
end

-- ============================================================================
-- CRUD operations
-- ============================================================================

--- Save a document to a collection. Returns the document with _id set.
---
--- If the document has an _id field, it upserts (insert or replace).
--- If not, a UUID is generated.
---
---   local doc = db:save("players", { name = "Link", hp = 100 })
---   print(doc._id)  -- "a1b2c3d4-..."
---
--- @param collection string  Collection name
--- @param doc table           Document to save
--- @return table              The saved document (with _id)
function Store:save(collection, doc)
  assert(not self._closed, "[docstore] Store is closed")

  local id = doc._id or uuid()
  -- Store a clean copy without _id in the JSON (it's the row PK)
  local data = {}
  for k, v in pairs(doc) do
    if k ~= "_id" then data[k] = v end
  end

  local jsonStr = json.encode(data)
  self._db:exec(
    [[INSERT INTO documents (id, collection, data, created_at, updated_at)
      VALUES (?, ?, json(?), julianday('now'), julianday('now'))
      ON CONFLICT(id) DO UPDATE SET
        data = json(excluded.data),
        updated_at = julianday('now')]],
    id, collection, jsonStr
  )

  doc._id = id
  return doc
end

--- Find all documents in a collection matching an optional query.
---
---   local all = db:find("players")
---   local strong = db:find("players", { hp = { gte = 50 } })
---
--- @param collection string     Collection name
--- @param query table|nil        Query filter (optional)
--- @param opts table|nil         Options: { limit, offset, sort, order }
--- @return table[]               Array of documents (each with _id)
function Store:find(collection, query, opts)
  assert(not self._closed, "[docstore] Store is closed")

  local where, params = buildWhere(collection, query)
  local sql = "SELECT id, data FROM documents WHERE " .. where

  -- Sorting
  if opts and opts.sort then
    local order = (opts.order == "desc") and "DESC" or "ASC"
    sql = sql .. string.format(" ORDER BY json_extract(data, '$.%s') %s", sanitizeField(opts.sort), order)
  else
    sql = sql .. " ORDER BY created_at ASC"
  end

  -- Pagination
  if opts and opts.limit then
    sql = sql .. " LIMIT ?"
    params[#params + 1] = opts.limit
    if opts.offset then
      sql = sql .. " OFFSET ?"
      params[#params + 1] = opts.offset
    end
  end

  local rows = self._db:query(sql, params)
  local docs = {}
  for i, row in ipairs(rows) do
    local doc = json.decode(row.data)
    doc._id = row.id
    docs[i] = doc
  end
  return docs
end

--- Find the first document matching a query, or nil.
---
---   local link = db:findOne("players", { name = "Link" })
---
--- @param collection string     Collection name
--- @param query table|nil        Query filter
--- @return table|nil             Document with _id, or nil
function Store:findOne(collection, query)
  assert(not self._closed, "[docstore] Store is closed")

  local where, params = buildWhere(collection, query)
  local sql = "SELECT id, data FROM documents WHERE " .. where .. " LIMIT 1"

  local row = self._db:queryOne(sql, params)
  if not row then return nil end

  local doc = json.decode(row.data)
  doc._id = row.id
  return doc
end

--- Get a document by its _id.
---
---   local doc = db:get("players", "a1b2c3d4-...")
---
--- @param collection string  Collection name
--- @param id string           Document ID
--- @return table|nil          Document, or nil if not found
function Store:get(collection, id)
  assert(not self._closed, "[docstore] Store is closed")

  local row = self._db:queryOne(
    "SELECT id, data FROM documents WHERE id = ? AND collection = ?",
    id, collection
  )
  if not row then return nil end

  local doc = json.decode(row.data)
  doc._id = row.id
  return doc
end

--- Update a document by merging fields. Existing fields not in the patch are preserved.
---
---   db:update("players", link._id, { hp = 120, status = "powered up" })
---
--- @param collection string  Collection name
--- @param id string           Document ID
--- @param patch table         Fields to merge into the document
--- @return table|nil          Updated document, or nil if not found
function Store:update(collection, id, patch)
  assert(not self._closed, "[docstore] Store is closed")

  -- Fetch current document
  local row = self._db:queryOne(
    "SELECT data FROM documents WHERE id = ? AND collection = ?",
    id, collection
  )
  if not row then return nil end

  local doc = json.decode(row.data)
  -- Merge patch
  for k, v in pairs(patch) do
    if k ~= "_id" then doc[k] = v end
  end

  local jsonStr = json.encode(doc)
  self._db:exec(
    "UPDATE documents SET data = json(?), updated_at = julianday('now') WHERE id = ? AND collection = ?",
    jsonStr, id, collection
  )

  doc._id = id
  return doc
end

--- Remove a document by its _id.
---
---   db:remove("players", link._id)
---
--- @param collection string  Collection name
--- @param id string           Document ID
--- @return boolean            True if a document was deleted
function Store:remove(collection, id)
  assert(not self._closed, "[docstore] Store is closed")
  self._db:exec("DELETE FROM documents WHERE id = ? AND collection = ?", id, collection)
  return self._db:changes() > 0
end

--- Remove all documents matching a query.
---
---   db:removeWhere("players", { hp = { lte = 0 } })
---
--- @param collection string  Collection name
--- @param query table|nil     Query filter (nil = remove all in collection)
--- @return number             Number of documents removed
function Store:removeWhere(collection, query)
  assert(not self._closed, "[docstore] Store is closed")
  local where, params = buildWhere(collection, query)
  self._db:exec("DELETE FROM documents WHERE " .. where, params)
  return self._db:changes()
end

--- Count documents in a collection, optionally filtered.
---
---   local total = db:count("players")
---   local alive = db:count("players", { hp = { gt = 0 } })
---
--- @param collection string  Collection name
--- @param query table|nil     Query filter (optional)
--- @return number
function Store:count(collection, query)
  assert(not self._closed, "[docstore] Store is closed")
  local where, params = buildWhere(collection, query)
  return self._db:scalar("SELECT COUNT(*) FROM documents WHERE " .. where, params)
end

--- List all collection names in the store.
---
---   local collections = db:collections()  -- {"players", "items", "saves"}
---
--- @return string[]
function Store:collections()
  assert(not self._closed, "[docstore] Store is closed")
  local rows = self._db:query("SELECT DISTINCT collection FROM documents ORDER BY collection")
  local names = {}
  for i, row in ipairs(rows) do
    names[i] = row.collection
  end
  return names
end

--- Drop an entire collection (delete all documents).
---
---   db:drop("temp_data")
---
--- @param collection string  Collection name
--- @return number            Number of documents removed
function Store:drop(collection)
  assert(not self._closed, "[docstore] Store is closed")
  self._db:exec("DELETE FROM documents WHERE collection = ?", collection)
  return self._db:changes()
end

--- Execute a function inside a transaction.
---
---   db:transaction(function()
---     db:save("ledger", { from = "alice", to = "bob", amount = 50 })
---     db:update("players", alice._id, { gold = alice.gold - 50 })
---     db:update("players", bob._id, { gold = bob.gold + 50 })
---   end)
---
function Store:transaction(fn)
  assert(not self._closed, "[docstore] Store is closed")
  self._db:transaction(fn)
end

--- Access the underlying SQLite database for raw SQL when needed.
--- @return Database
function Store:rawDb()
  return self._db
end

return DocStore
