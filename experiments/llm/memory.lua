--[[
  memory.lua -- M3A (Multi-Modal Memory Architecture) via SQLite + LuaJIT

  Five-layer cognitive memory system ported from TypeScript.
  Backed entirely by SQLite (via lua/sqlite.lua FFI bindings).

  Layers:
    L1  River     — sliding window buffer (recent context)
    L2  Feeling   — affective state classification with decay
    L3  Echo      — triple redundant encoding:
                    L3.1 Vectors  (brute-force cosine similarity)
                    L3.2 Lexical  (FTS5 full-text search)
                    L3.3 Graph    (entity-relation graph, BFS traversal)
    L4  Wound     — salience markers (important moments)
    L5  Companion — co-occurrence graph with temporal decay

  Usage:
    local Memory = require("memory")
    local mem = Memory.open("brain.db")
    mem:process_message("chat1", "msg1", "Hello world")
    local results = mem:retrieve({ chat_id = "chat1", query = "hello", top_k = 5 })
    mem:close()

  Requires: libsqlite3 (system or bundled)
]]

local ffi = require("ffi")

-- ============================================================================
-- SQLite dependency
-- ============================================================================

-- Try standalone mode first (relative to this file), then framework mode
local sqlite
do
  -- Find the monorepo root by walking up from this file's location
  local info = debug.getinfo(1, "S")
  local dir = ""
  if info and info.source and info.source:sub(1, 1) == "@" then
    dir = info.source:sub(2):match("(.+)/[^/]+$") or ""
  end

  -- Add monorepo root to package.path so require("lua.sqlite") works
  if dir ~= "" then
    local root = dir .. "/../.."
    package.path = root .. "/?.lua;" .. root .. "/?/init.lua;" .. package.path
  end

  local ok, mod = pcall(require, "lua.sqlite")
  if ok and mod.available then
    sqlite = mod
  else
    -- Fallback: try bare require (works if lua/ is already in path)
    ok, mod = pcall(require, "sqlite")
    if ok and mod.available then
      sqlite = mod
    end
  end
end

if not sqlite or not sqlite.available then
  return { available = false }
end

-- ============================================================================
-- Module
-- ============================================================================

local Memory = {}
Memory.available = true

-- ============================================================================
-- Nil-safe SQLite helpers
-- ============================================================================

-- sqlite.lua uses ipairs() to bind params, which stops at nil holes.
-- We need a wrapper that passes all params including nil in the middle.
-- Strategy: build the SQL with literal NULLs for nil-valued params and
-- only bind non-nil values. This avoids the ipairs truncation entirely.

--- Execute SQL with params that may contain nil values.
--- Replaces nil-positioned ?'s with NULL and only binds non-nil params.
local function safe_exec(db, sql, ...)
  local n = select('#', ...)
  if n == 0 then
    return db:exec(sql)
  end

  -- Collect all args including nils
  local all = {}
  for i = 1, n do
    all[i] = select(i, ...)
  end

  -- Check if any nil values exist
  local has_nil = false
  for i = 1, n do
    if all[i] == nil then has_nil = true; break end
  end

  if not has_nil then
    -- No nils, safe to use normal exec
    return db:exec(sql, ...)
  end

  -- Replace ?'s at nil positions with NULL in the SQL,
  -- and build a dense param list of non-nil values
  local dense = {}
  local param_idx = 0
  local new_sql = sql:gsub("%?", function()
    param_idx = param_idx + 1
    if all[param_idx] == nil then
      return "NULL"
    else
      dense[#dense + 1] = all[param_idx]
      return "?"
    end
  end)

  if #dense == 0 then
    return db:exec(new_sql)
  else
    return db:exec(new_sql, dense)
  end
end

--- Query with params that may contain nil values.
local function safe_query(db, sql, ...)
  local n = select('#', ...)
  if n == 0 then
    return db:query(sql)
  end

  local all = {}
  for i = 1, n do all[i] = select(i, ...) end

  local has_nil = false
  for i = 1, n do
    if all[i] == nil then has_nil = true; break end
  end

  if not has_nil then
    return db:query(sql, ...)
  end

  local dense = {}
  local param_idx = 0
  local new_sql = sql:gsub("%?", function()
    param_idx = param_idx + 1
    if all[param_idx] == nil then
      return "NULL"
    else
      dense[#dense + 1] = all[param_idx]
      return "?"
    end
  end)

  if #dense == 0 then
    return db:query(new_sql)
  else
    return db:query(new_sql, dense)
  end
end

--- QueryOne with params that may contain nil values.
local function safe_queryOne(db, sql, ...)
  local n = select('#', ...)
  if n == 0 then
    return db:queryOne(sql)
  end

  local all = {}
  for i = 1, n do all[i] = select(i, ...) end

  local has_nil = false
  for i = 1, n do
    if all[i] == nil then has_nil = true; break end
  end

  if not has_nil then
    return db:queryOne(sql, ...)
  end

  local dense = {}
  local param_idx = 0
  local new_sql = sql:gsub("%?", function()
    param_idx = param_idx + 1
    if all[param_idx] == nil then
      return "NULL"
    else
      dense[#dense + 1] = all[param_idx]
      return "?"
    end
  end)

  if #dense == 0 then
    return db:queryOne(new_sql)
  else
    return db:queryOne(new_sql, dense)
  end
end

-- ============================================================================
-- ID generation
-- ============================================================================

-- Simple random hex IDs. Good enough for local single-user use.
local random = math.random
math.randomseed(os.time() + os.clock() * 1000)

local function new_id(prefix)
  local hex = ""
  for _ = 1, 16 do
    hex = hex .. string.format("%02x", random(0, 255))
  end
  return (prefix or "") .. hex
end

local function timestamp()
  return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

-- ============================================================================
-- Constants
-- ============================================================================

local DEFAULT_WEIGHTS = {
  L1 = 0.20,
  L2 = 0.20,
  L3 = 0.25,
  L4 = 0.20,
  L5 = 0.15,
}

local DEFAULT_CONFIG = {
  memory_enabled       = true,
  l1_max_tokens        = 8000,
  l1_overflow_callback = "consolidate",
  l2_affect_threshold  = 0.3,
  l2_decay_rate        = 0.95,
  l4_salience_threshold = 0.7,
  l5_temporal_decay_rate = 0.98,
}

local AFFECT_CATEGORIES = {
  "FRUSTRATED", "CONFUSED", "CURIOUS", "SATISFIED", "URGENT", "REFLECTIVE"
}

-- ============================================================================
-- Schema
-- ============================================================================

local SCHEMA = [[
  -- L1: River (sliding window buffer)
  CREATE TABLE IF NOT EXISTS l1_river (
    id          TEXT PRIMARY KEY,
    chat_id     TEXT NOT NULL,
    message_id  TEXT NOT NULL,
    content     TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    timestamp   TEXT NOT NULL,
    evicted_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_l1_river_chat ON l1_river(chat_id, evicted_at);

  -- L2: Feeling (affective state)
  CREATE TABLE IF NOT EXISTS l2_affect (
    id               TEXT PRIMARY KEY,
    chat_id          TEXT NOT NULL,
    message_id       TEXT NOT NULL,
    affect_category  TEXT NOT NULL,
    intensity        REAL NOT NULL DEFAULT 0.0,
    reasoning        TEXT,
    decay_factor     REAL NOT NULL DEFAULT 1.0,
    is_muted         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_l2_affect_chat ON l2_affect(chat_id, is_muted);

  -- L3.1: Vectors (embeddings)
  CREATE TABLE IF NOT EXISTS l3_vectors (
    id              TEXT PRIMARY KEY,
    chat_id         TEXT NOT NULL,
    message_id      TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    embedding_blob  BLOB NOT NULL,
    embedding_model TEXT NOT NULL,
    dimensions      INTEGER NOT NULL,
    boost_factor    REAL NOT NULL DEFAULT 1.0,
    is_muted        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_l3_vectors_chat ON l3_vectors(chat_id, is_muted);

  -- L3.2: Lexical FTS5 (full-text search)
  CREATE VIRTUAL TABLE IF NOT EXISTS l3_lexical_fts USING fts5(
    content, chat_id, message_id
  );

  CREATE TABLE IF NOT EXISTS l3_lexical_meta (
    message_id   TEXT PRIMARY KEY,
    chat_id      TEXT NOT NULL,
    boost_factor REAL NOT NULL DEFAULT 1.0,
    is_muted     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
  );

  -- L3.3: Entity-relation graph
  CREATE TABLE IF NOT EXISTS l3_entities (
    id              TEXT PRIMARY KEY,
    entity_type     TEXT NOT NULL,
    entity_value    TEXT NOT NULL,
    canonical_form  TEXT,
    chat_id         TEXT,
    first_seen_at   TEXT NOT NULL,
    last_seen_at    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_l3_entities_type_val ON l3_entities(entity_type, entity_value);

  CREATE TABLE IF NOT EXISTS l3_relations (
    id                 TEXT PRIMARY KEY,
    source_entity_id   TEXT NOT NULL REFERENCES l3_entities(id),
    target_entity_id   TEXT NOT NULL REFERENCES l3_entities(id),
    relation_type      TEXT NOT NULL,
    context_message_id TEXT NOT NULL,
    confidence         REAL NOT NULL DEFAULT 1.0,
    is_muted           INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_l3_relations_src ON l3_relations(source_entity_id, is_muted);
  CREATE INDEX IF NOT EXISTS idx_l3_relations_tgt ON l3_relations(target_entity_id, is_muted);

  -- L4: Wound (salience markers)
  CREATE TABLE IF NOT EXISTS l4_salience (
    id                 TEXT PRIMARY KEY,
    chat_id            TEXT NOT NULL,
    message_id         TEXT NOT NULL,
    content            TEXT NOT NULL,
    salience_score     REAL NOT NULL,
    prediction_error   REAL,
    user_pinned        INTEGER NOT NULL DEFAULT 0,
    retention_priority INTEGER NOT NULL DEFAULT 0,
    is_muted           INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL,
    last_accessed_at   TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_l4_salience_msg ON l4_salience(message_id);
  CREATE INDEX IF NOT EXISTS idx_l4_salience_chat ON l4_salience(chat_id, is_muted);

  -- L5: Companion (co-occurrence graph)
  CREATE TABLE IF NOT EXISTS l5_nodes (
    id            TEXT PRIMARY KEY,
    node_type     TEXT NOT NULL,
    node_value    TEXT NOT NULL,
    chat_id       TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_l5_nodes_type_val ON l5_nodes(node_type, node_value);

  CREATE TABLE IF NOT EXISTS l5_edges (
    id                 TEXT PRIMARY KEY,
    source_node_id     TEXT NOT NULL REFERENCES l5_nodes(id),
    target_node_id     TEXT NOT NULL REFERENCES l5_nodes(id),
    weight             REAL NOT NULL DEFAULT 1.0,
    temporal_decay     REAL NOT NULL DEFAULT 1.0,
    last_reinforced_at TEXT NOT NULL,
    created_at         TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_l5_edges_pair ON l5_edges(source_node_id, target_node_id);

  -- Consolidation tracking
  CREATE TABLE IF NOT EXISTS consolidation_runs (
    id                 TEXT PRIMARY KEY,
    chat_id            TEXT NOT NULL,
    trigger_type       TEXT NOT NULL,
    items_processed    INTEGER NOT NULL DEFAULT 0,
    summaries_created  INTEGER NOT NULL DEFAULT 0,
    conflicts_detected INTEGER NOT NULL DEFAULT 0,
    started_at         TEXT NOT NULL,
    completed_at       TEXT
  );

  -- Configuration (key-value)
  CREATE TABLE IF NOT EXISTS memory_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Embedding cache
  CREATE TABLE IF NOT EXISTS embedding_cache (
    content_hash    TEXT PRIMARY KEY,
    embedding_blob  BLOB NOT NULL,
    embedding_model TEXT NOT NULL,
    dimensions      INTEGER NOT NULL,
    created_at      TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL
  );
]]

-- ============================================================================
-- Store object
-- ============================================================================

local Store = {}
Store.__index = Store

--- Open a memory store backed by a SQLite database.
--- @param path string|nil  Database path, or nil/":memory:" for in-memory
--- @return Store
function Memory.open(path)
  local db = sqlite.open(path)

  -- Initialize schema
  db:exec(SCHEMA)

  local self = setmetatable({
    _db = db,
    _closed = false,
  }, Store)

  return self
end

function Store:close()
  if self._closed then return end
  self._closed = true
  self._db:close()
end

-- ============================================================================
-- Utility
-- ============================================================================

--- Estimate token count (rough: ~4 chars per token for English)
local function estimate_tokens(text)
  return math.ceil(#text / 4)
end

--- Hash content for deduplication (simple FNV-1a)
local function hash_content(text)
  local h = 2166136261
  for i = 1, #text do
    h = bit.bxor(h, text:byte(i))
    h = h * 16777619
    h = bit.band(h, 0xFFFFFFFF)
  end
  return string.format("%08x", h)
end

-- ============================================================================
-- Vector math (LuaJIT FFI for speed)
-- ============================================================================

--- Serialize a Lua array of floats to a binary blob
local function serialize_embedding(vec)
  local n = #vec
  local buf = ffi.new("float[?]", n)
  for i = 1, n do
    buf[i - 1] = vec[i]
  end
  return ffi.string(buf, n * 4)
end

--- Deserialize a binary blob back to a Lua array of floats
local function deserialize_embedding(blob)
  local n = #blob / 4
  local buf = ffi.cast("float*", ffi.cast("const char*", blob))
  local vec = {}
  for i = 0, n - 1 do
    vec[i + 1] = buf[i]
  end
  return vec, n
end

--- Cosine similarity between two float arrays
local function cosine_similarity(a, b)
  local n = math.min(#a, #b)
  if n == 0 then return 0 end

  local dot, norm_a, norm_b = 0, 0, 0
  for i = 1, n do
    dot    = dot    + a[i] * b[i]
    norm_a = norm_a + a[i] * a[i]
    norm_b = norm_b + b[i] * b[i]
  end

  local denom = math.sqrt(norm_a) * math.sqrt(norm_b)
  if denom == 0 then return 0 end
  return dot / denom
end

-- ============================================================================
-- L1: RIVER — Sliding Window Buffer
-- ============================================================================

--- Add entry to L1 river.
function Store:l1_add(chat_id, message_id, content, token_count)
  token_count = token_count or estimate_tokens(content)
  local id = new_id("l1_")
  local ts = timestamp()

  self._db:exec(
    "INSERT INTO l1_river (id, chat_id, message_id, content, token_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    id, chat_id, message_id, content, token_count, ts
  )

  return { id = id, chat_id = chat_id, message_id = message_id,
           content = content, token_count = token_count, timestamp = ts }
end

--- Get recent entries from L1 river.
function Store:l1_get(chat_id, limit)
  limit = limit or 100
  return self._db:query(
    "SELECT * FROM l1_river WHERE chat_id = ? AND evicted_at IS NULL ORDER BY timestamp DESC LIMIT ?",
    chat_id, limit
  )
end

--- Get total token count in L1 river for a chat.
function Store:l1_token_count(chat_id)
  local row = self._db:queryOne(
    "SELECT COALESCE(SUM(token_count), 0) as total FROM l1_river WHERE chat_id = ? AND evicted_at IS NULL",
    chat_id
  )
  return row and row.total or 0
end

--- Get L1 river statistics.
function Store:l1_stats(chat_id)
  return self._db:queryOne(
    [[SELECT COUNT(*) as total_entries, COALESCE(SUM(token_count), 0) as total_tokens,
      MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM l1_river WHERE chat_id = ? AND evicted_at IS NULL]],
    chat_id
  )
end

--- Evict oldest entries until under token limit. Returns evicted entries.
function Store:l1_evict(chat_id, max_tokens)
  local current = self:l1_token_count(chat_id)
  if current <= max_tokens then return {} end

  local rows = self._db:query(
    "SELECT * FROM l1_river WHERE chat_id = ? AND evicted_at IS NULL ORDER BY timestamp ASC",
    chat_id
  )

  local evicted = {}
  local remaining = current
  local now = timestamp()

  for _, row in ipairs(rows) do
    if remaining <= max_tokens then break end
    self._db:exec("UPDATE l1_river SET evicted_at = ? WHERE id = ?", now, row.id)
    evicted[#evicted + 1] = row
    remaining = remaining - row.token_count
  end

  return evicted
end

-- ============================================================================
-- L2: FEELING — Affective State Index
-- ============================================================================

--- Add an affect entry.
function Store:l2_add(chat_id, message_id, category, intensity, reasoning)
  local id = new_id("l2_")
  local now = timestamp()

  self._db:exec(
    [[INSERT INTO l2_affect (id, chat_id, message_id, affect_category, intensity, reasoning, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)]],
    id, chat_id, message_id, category, intensity, reasoning, now, now
  )

  return { id = id, chat_id = chat_id, message_id = message_id,
           affect_category = category, intensity = intensity,
           reasoning = reasoning, decay_factor = 1.0, is_muted = 0,
           created_at = now, last_accessed_at = now }
end

--- Get affect entries, optionally filtered.
function Store:l2_get(chat_id, opts)
  opts = opts or {}
  local category = opts.category
  local min_intensity = opts.min_intensity or 0
  local limit = opts.limit or 100
  local include_muted = opts.include_muted or false

  local sql = "SELECT * FROM l2_affect WHERE chat_id = ? AND intensity >= ?"
  local params = { chat_id, min_intensity }

  if not include_muted then
    sql = sql .. " AND is_muted = 0"
  end

  if category then
    sql = sql .. " AND affect_category = ?"
    params[#params + 1] = category
  end

  sql = sql .. " ORDER BY (intensity * decay_factor) DESC LIMIT ?"
  params[#params + 1] = limit

  local rows = self._db:query(sql, params)

  -- Update last_accessed_at
  if #rows > 0 then
    local now = timestamp()
    local ids = {}
    for _, r in ipairs(rows) do ids[#ids + 1] = "'" .. r.id .. "'" end
    self._db:exec(
      "UPDATE l2_affect SET last_accessed_at = ? WHERE id IN (" .. table.concat(ids, ",") .. ")",
      now
    )
  end

  return rows
end

--- Apply decay to all affect entries for a chat.
function Store:l2_decay(chat_id, decay_rate)
  decay_rate = decay_rate or DEFAULT_CONFIG.l2_decay_rate
  self._db:exec("UPDATE l2_affect SET decay_factor = decay_factor * ? WHERE chat_id = ?", decay_rate, chat_id)
  return self._db:changes()
end

-- ============================================================================
-- L3.1: ECHO — Vector Embeddings
-- ============================================================================

--- Add a vector embedding.
--- @param embedding table  Array of floats (Lua table)
function Store:l3_vector_add(chat_id, message_id, content, embedding, model_name)
  local id = new_id("l3v_")
  local content_hash = hash_content(content)
  local blob = serialize_embedding(embedding)
  local now = timestamp()

  self._db:exec(
    [[INSERT INTO l3_vectors (id, chat_id, message_id, content_hash, embedding_blob, embedding_model, dimensions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)]],
    id, chat_id, message_id, content_hash, blob, model_name, #embedding, now
  )

  return { id = id, chat_id = chat_id, message_id = message_id,
           content_hash = content_hash, dimensions = #embedding,
           boost_factor = 1.0, created_at = now }
end

--- Search for similar vectors (brute-force cosine similarity).
function Store:l3_vector_search(chat_id, query_embedding, top_k, include_muted)
  top_k = top_k or 10
  local sql = "SELECT * FROM l3_vectors WHERE chat_id = ?"
  if not include_muted then
    sql = sql .. " AND is_muted = 0"
  end

  local rows = self._db:query(sql, chat_id)
  local scored = {}

  for _, row in ipairs(rows) do
    local emb = deserialize_embedding(row.embedding_blob)
    local score = cosine_similarity(query_embedding, emb) * (row.boost_factor or 1.0)
    scored[#scored + 1] = { entry = row, score = score }
  end

  -- Sort by score descending
  table.sort(scored, function(a, b) return a.score > b.score end)

  -- Return top K
  local results = {}
  for i = 1, math.min(top_k, #scored) do
    results[i] = scored[i]
  end
  return results
end

-- ============================================================================
-- L3.2: ECHO — Lexical FTS5
-- ============================================================================

--- Add content to the lexical FTS index.
function Store:l3_lexical_add(chat_id, message_id, content)
  local now = timestamp()

  self._db:exec(
    "INSERT INTO l3_lexical_fts (content, chat_id, message_id) VALUES (?, ?, ?)",
    content, chat_id, message_id
  )

  -- Use tryExec for metadata since the PK might already exist
  self._db:tryExec(
    "INSERT OR IGNORE INTO l3_lexical_meta (message_id, chat_id, created_at) VALUES (?, ?, ?)",
    message_id, chat_id, now
  )
end

--- Search the lexical FTS index. Returns {message_id, content, score}.
function Store:l3_lexical_search(chat_id, query, top_k, include_muted)
  top_k = top_k or 10

  local sql = [[
    SELECT fts.message_id, fts.content, bm25(l3_lexical_fts) as score,
           COALESCE(meta.boost_factor, 1.0) as boost
    FROM l3_lexical_fts fts
    LEFT JOIN l3_lexical_meta meta ON fts.message_id = meta.message_id
    WHERE fts.chat_id = ? AND l3_lexical_fts MATCH ?
  ]]

  if not include_muted then
    sql = sql .. " AND COALESCE(meta.is_muted, 0) = 0"
  end

  sql = sql .. " ORDER BY (bm25(l3_lexical_fts) * COALESCE(meta.boost_factor, 1.0)) LIMIT ?"

  local rows, err = self._db:tryQuery(sql, chat_id, query, top_k)
  if not rows then return {} end

  -- BM25 returns negative scores — flip them
  for _, row in ipairs(rows) do
    row.score = math.abs(row.score) * row.boost
  end

  return rows
end

-- ============================================================================
-- L3.3: ECHO — Entity-Relation Graph
-- ============================================================================

--- Add or update an entity.
function Store:l3_entity_add(entity_type, entity_value, chat_id, canonical_form)
  local now = timestamp()

  -- Check for existing
  local existing = safe_queryOne(self._db,
    "SELECT * FROM l3_entities WHERE entity_type = ? AND entity_value = ? AND chat_id IS ?",
    entity_type, entity_value, chat_id
  )

  if existing then
    self._db:exec("UPDATE l3_entities SET last_seen_at = ? WHERE id = ?", now, existing.id)
    existing.last_seen_at = now
    return existing
  end

  local id = new_id("ent_")
  safe_exec(self._db,
    [[INSERT INTO l3_entities (id, entity_type, entity_value, canonical_form, chat_id, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)]],
    id, entity_type, entity_value, canonical_form, chat_id, now, now
  )

  return { id = id, entity_type = entity_type, entity_value = entity_value,
           canonical_form = canonical_form, chat_id = chat_id,
           first_seen_at = now, last_seen_at = now }
end

--- Add a relation between entities.
function Store:l3_relation_add(source_entity_id, target_entity_id, relation_type, context_message_id, confidence)
  confidence = confidence or 1.0
  local id = new_id("rel_")
  local now = timestamp()

  self._db:exec(
    [[INSERT INTO l3_relations (id, source_entity_id, target_entity_id, relation_type, context_message_id, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)]],
    id, source_entity_id, target_entity_id, relation_type, context_message_id, confidence, now
  )

  return { id = id, source_entity_id = source_entity_id,
           target_entity_id = target_entity_id,
           relation_type = relation_type, confidence = confidence,
           created_at = now }
end

--- Get related entities via BFS graph traversal.
function Store:l3_related_entities(entity_value, chat_id, hops)
  hops = hops or 2

  -- Find starting entities
  local sql = "SELECT * FROM l3_entities WHERE entity_value = ?"
  local params = { entity_value }
  if chat_id then
    sql = sql .. " AND (chat_id = ? OR chat_id IS NULL)"
    params[#params + 1] = chat_id
  end
  local start = self._db:query(sql, params)

  -- BFS
  local visited = {}
  local results = {}
  local queue = {}

  for _, e in ipairs(start) do
    queue[#queue + 1] = { id = e.id, distance = 0 }
  end

  while #queue > 0 do
    local current = table.remove(queue, 1)
    if visited[current.id] or current.distance > hops then goto continue end
    visited[current.id] = true

    if current.distance > 0 then
      local entity = self._db:queryOne("SELECT * FROM l3_entities WHERE id = ?", current.id)
      if entity then
        results[#results + 1] = { entity = entity, distance = current.distance }
      end
    end

    -- Get neighbors (bidirectional)
    local neighbors = self._db:query(
      [[SELECT target_entity_id as neighbor FROM l3_relations WHERE source_entity_id = ? AND is_muted = 0
        UNION
        SELECT source_entity_id as neighbor FROM l3_relations WHERE target_entity_id = ? AND is_muted = 0]],
      current.id, current.id
    )

    for _, rel in ipairs(neighbors) do
      if not visited[rel.neighbor] then
        queue[#queue + 1] = { id = rel.neighbor, distance = current.distance + 1 }
      end
    end

    ::continue::
  end

  return results
end

-- ============================================================================
-- L4: WOUND — Salience Markers
-- ============================================================================

--- Add a salience entry.
function Store:l4_add(chat_id, message_id, content, salience_score, prediction_error)
  local id = new_id("l4_")
  local now = timestamp()
  local priority = math.floor(salience_score * 100)

  safe_exec(self._db,
    [[INSERT OR REPLACE INTO l4_salience
      (id, chat_id, message_id, content, salience_score, prediction_error, retention_priority, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)]],
    id, chat_id, message_id, content, salience_score, prediction_error, priority, now, now
  )

  return { id = id, chat_id = chat_id, message_id = message_id,
           content = content, salience_score = salience_score,
           retention_priority = priority, created_at = now }
end

--- Pin a message (user action — max salience).
function Store:l4_pin(chat_id, message_id, content)
  local id = new_id("l4_")
  local now = timestamp()

  self._db:exec(
    [[INSERT INTO l4_salience
      (id, chat_id, message_id, content, salience_score, user_pinned, retention_priority, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, 1.0, 1, 100, ?, ?)
      ON CONFLICT(message_id) DO UPDATE SET
        user_pinned = 1, salience_score = 1.0, retention_priority = 100, last_accessed_at = ?]],
    id, chat_id, message_id, content, now, now, now
  )
end

--- Get salient entries.
function Store:l4_get(chat_id, opts)
  opts = opts or {}
  local min_score = opts.min_score or 0
  local pinned_only = opts.pinned_only or false
  local limit = opts.limit or 50
  local include_muted = opts.include_muted or false

  local sql = "SELECT * FROM l4_salience WHERE chat_id = ? AND salience_score >= ?"
  local params = { chat_id, min_score }

  if not include_muted then
    sql = sql .. " AND is_muted = 0"
  end
  if pinned_only then
    sql = sql .. " AND user_pinned = 1"
  end

  sql = sql .. " ORDER BY retention_priority DESC, salience_score DESC LIMIT ?"
  params[#params + 1] = limit

  local rows = self._db:query(sql, params)

  -- Update last_accessed_at
  if #rows > 0 then
    local now = timestamp()
    local ids = {}
    for _, r in ipairs(rows) do ids[#ids + 1] = "'" .. r.id .. "'" end
    self._db:exec(
      "UPDATE l4_salience SET last_accessed_at = ? WHERE id IN (" .. table.concat(ids, ",") .. ")",
      now
    )
  end

  return rows
end

-- ============================================================================
-- L5: COMPANION — Co-occurrence Graph
-- ============================================================================

--- Add or update a co-occurrence node.
function Store:l5_node_add(node_type, node_value, chat_id)
  local now = timestamp()

  local existing = safe_queryOne(self._db,
    "SELECT * FROM l5_nodes WHERE node_type = ? AND node_value = ? AND chat_id IS ?",
    node_type, node_value, chat_id
  )

  if existing then
    self._db:exec("UPDATE l5_nodes SET last_seen_at = ? WHERE id = ?", now, existing.id)
    existing.last_seen_at = now
    return existing
  end

  local id = new_id("l5n_")
  safe_exec(self._db,
    "INSERT INTO l5_nodes (id, node_type, node_value, chat_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    id, node_type, node_value, chat_id, now, now
  )

  return { id = id, node_type = node_type, node_value = node_value,
           chat_id = chat_id, first_seen_at = now, last_seen_at = now }
end

--- Add or reinforce a co-occurrence edge.
function Store:l5_edge_add(source_node_id, target_node_id, strength)
  strength = strength or 1.0
  local now = timestamp()

  local existing = self._db:queryOne(
    "SELECT * FROM l5_edges WHERE source_node_id = ? AND target_node_id = ?",
    source_node_id, target_node_id
  )

  if existing then
    -- Reinforce: weight = old * decay + new * (1 - decay)
    local decay = 0.7
    local new_weight = existing.weight * decay + strength * (1 - decay)
    self._db:exec(
      "UPDATE l5_edges SET weight = ?, last_reinforced_at = ?, temporal_decay = 1.0 WHERE id = ?",
      new_weight, now, existing.id
    )
    existing.weight = new_weight
    existing.last_reinforced_at = now
    return existing
  end

  local id = new_id("l5e_")
  self._db:exec(
    "INSERT INTO l5_edges (id, source_node_id, target_node_id, weight, created_at, last_reinforced_at) VALUES (?, ?, ?, ?, ?, ?)",
    id, source_node_id, target_node_id, strength, now, now
  )

  return { id = id, source_node_id = source_node_id, target_node_id = target_node_id,
           weight = strength, temporal_decay = 1.0, created_at = now }
end

--- Get co-occurring nodes.
function Store:l5_cooccurring(node_id, top_k)
  top_k = top_k or 10
  return self._db:query(
    [[SELECT n.*, e.weight
      FROM l5_edges e
      JOIN l5_nodes n ON (
        (e.source_node_id = ? AND e.target_node_id = n.id) OR
        (e.target_node_id = ? AND e.source_node_id = n.id)
      )
      ORDER BY e.weight * e.temporal_decay DESC
      LIMIT ?]],
    node_id, node_id, top_k
  )
end

--- Apply temporal decay to all edges.
function Store:l5_decay_edges(decay_rate)
  decay_rate = decay_rate or DEFAULT_CONFIG.l5_temporal_decay_rate
  self._db:exec("UPDATE l5_edges SET temporal_decay = temporal_decay * ?", decay_rate)
  return self._db:changes()
end

--- Prune weak edges.
function Store:l5_prune(threshold)
  threshold = threshold or 0.1
  self._db:exec("DELETE FROM l5_edges WHERE weight * temporal_decay < ?", threshold)
  return self._db:changes()
end

-- ============================================================================
-- SALIENCE COMPUTATION (heuristic scorer)
-- ============================================================================

--- Compute salience score using regex heuristics (no LLM needed).
local function compute_salience(content, opts)
  opts = opts or {}
  local score = 0
  local lower = content:lower()
  local token_count = opts.token_count or estimate_tokens(content)

  -- Factor 1: Message length
  if token_count > 100 then score = score + 0.1 end
  if token_count > 500 then score = score + 0.1 end

  -- Factor 2: Questions
  local _, question_count = content:gsub("%?", "")
  score = score + math.min(question_count * 0.1, 0.2)

  -- Factor 3: Error/problem indicators (high salience)
  if lower:match("%f[%a]error%f[%A]") or lower:match("%f[%a]bug%f[%A]")
    or lower:match("%f[%a]broken%f[%A]") or lower:match("%f[%a]failed%f[%A]")
    or lower:match("%f[%a]crash%f[%A]") or lower:match("%f[%a]issue%f[%A]")
    or lower:match("%f[%a]problem%f[%A]") or lower:match("%f[%a]wrong%f[%A]")
    or lower:match("%f[%a]fix%f[%A]") then
    score = score + 0.3
  end

  -- Factor 4: Decision/solution indicators
  if lower:match("%f[%a]decided%f[%A]") or lower:match("%f[%a]solution%f[%A]")
    or lower:match("%f[%a]solved%f[%A]") or lower:match("%f[%a]fixed%f[%A]")
    or lower:match("%f[%a]resolved%f[%A]") or lower:match("%f[%a]answer%f[%A]")
    or lower:match("figured out") then
    score = score + 0.25
  end

  -- Factor 5: Learning indicators
  if lower:match("%f[%a]learned%f[%A]") or lower:match("%f[%a]realized%f[%A]")
    or lower:match("%f[%a]discovered%f[%A]") or lower:match("%f[%a]understand%f[%A]")
    or lower:match("now i know") then
    score = score + 0.2
  end

  -- Factor 6: Affect intensity
  if opts.affect_intensity and opts.affect_intensity > 0.5 then
    score = score + opts.affect_intensity * 0.2
  end

  -- Factor 7: Code blocks
  if content:find("```") or content:find("`") then
    score = score + 0.15
  end

  -- Factor 8: URLs
  if content:find("https?://") then
    score = score + 0.1
  end

  -- Factor 9: Lists
  if content:match("^[%-%*%d%.]+%s") then
    score = score + 0.1
  end

  return math.min(score, 1.0)
end

-- ============================================================================
-- CONCEPT EXTRACTION (heuristic, no LLM)
-- ============================================================================

--- Extract key concepts from text using simple heuristics.
--- Returns an array of concept strings.
local function extract_concepts(content)
  local concepts = {}
  local seen = {}

  -- Extract words that look like concepts (capitalized, 3+ chars, not common)
  local common_words = {
    ["the"]=1, ["and"]=1, ["for"]=1, ["are"]=1, ["but"]=1, ["not"]=1, ["you"]=1, ["all"]=1,
    ["can"]=1, ["has"]=1, ["her"]=1, ["was"]=1, ["one"]=1, ["our"]=1, ["out"]=1, ["this"]=1,
    ["that"]=1, ["with"]=1, ["have"]=1, ["from"]=1, ["they"]=1, ["been"]=1, ["said"]=1,
    ["each"]=1, ["which"]=1, ["their"]=1, ["will"]=1, ["would"]=1, ["there"]=1,
    ["what"]=1, ["about"]=1, ["when"]=1, ["make"]=1, ["like"]=1, ["just"]=1, ["over"]=1,
    ["such"]=1, ["take"]=1, ["than"]=1, ["them"]=1, ["very"]=1, ["some"]=1, ["into"]=1,
    ["also"]=1, ["after"]=1, ["should"]=1, ["could"]=1, ["being"]=1,
  }

  -- Method 1: Capitalized words (proper nouns, tech terms)
  for word in content:gmatch("[A-Z][a-zA-Z]+") do
    local lower = word:lower()
    if #word >= 3 and not common_words[lower] and not seen[lower] then
      seen[lower] = true
      concepts[#concepts + 1] = lower
    end
  end

  -- Method 2: Technical terms (camelCase, snake_case, with dots)
  for word in content:gmatch("[a-zA-Z][a-zA-Z0-9_%.]+[a-zA-Z0-9]") do
    if word:find("[_%.]") or word:find("[a-z][A-Z]") then
      local lower = word:lower()
      if not seen[lower] then
        seen[lower] = true
        concepts[#concepts + 1] = lower
      end
    end
  end

  -- Method 3: Quoted strings
  for word in content:gmatch('"([^"]+)"') do
    if #word > 2 and #word < 50 then
      local lower = word:lower()
      if not seen[lower] then
        seen[lower] = true
        concepts[#concepts + 1] = lower
      end
    end
  end

  -- Limit to 20 concepts
  if #concepts > 20 then
    local trimmed = {}
    for i = 1, 20 do trimmed[i] = concepts[i] end
    return trimmed
  end

  return concepts
end

-- ============================================================================
-- WRITE PIPELINE
-- ============================================================================

--- Process a message through all memory layers.
--- This is the main entry point for writing to memory.
---
--- Options:
---   llm_classify   function(content) -> {category, intensity, reasoning}  (for L2)
---   llm_entities   function(content) -> {entities={...}, relations={...}} (for L3.3)
---   embed          function(content) -> {embedding={...}, model="..."}    (for L3.1)
---   skip_affect    boolean  (skip L2)
---   skip_vectors   boolean  (skip L3.1)
---   skip_entities  boolean  (skip L3.3)
---   skip_salience  boolean  (skip L4)
---   skip_cooccurrence boolean (skip L5)
function Store:process_message(chat_id, message_id, content, opts)
  opts = opts or {}
  local token_count = estimate_tokens(content)

  local result = {
    l1 = { success = false },
    l2 = { success = false, skipped = false },
    l3_vector = { success = false, skipped = false },
    l3_lexical = { success = false },
    l3_graph = { success = false },
    l4 = { success = false, skipped = false },
    l5 = { success = false },
    consolidation_triggered = false,
  }

  -- L1: Add to river (always)
  local ok, l1_entry = pcall(self.l1_add, self, chat_id, message_id, content, token_count)
  if ok then
    result.l1 = { success = true, id = l1_entry.id }
  end

  -- Check for overflow
  local current_tokens = self:l1_token_count(chat_id)
  if current_tokens > DEFAULT_CONFIG.l1_max_tokens then
    result.consolidation_triggered = true
    pcall(self.l1_evict, self, chat_id, DEFAULT_CONFIG.l1_max_tokens)
  end

  -- L2: Classify affect (if LLM classifier provided)
  if not opts.skip_affect and opts.llm_classify then
    local ok2, affect = pcall(opts.llm_classify, content)
    if ok2 and affect and affect.intensity >= DEFAULT_CONFIG.l2_affect_threshold then
      local ok3, entry = pcall(self.l2_add, self, chat_id, message_id,
        affect.category, affect.intensity, affect.reasoning)
      if ok3 then
        result.l2 = { success = true, id = entry.id }
      end
    else
      result.l2.skipped = true
    end
  else
    result.l2.skipped = true
  end

  -- L3.1: Vector embedding (if embed function provided)
  if not opts.skip_vectors and opts.embed then
    local ok2, emb_result = pcall(opts.embed, content)
    if ok2 and emb_result and emb_result.embedding then
      local ok3, entry = pcall(self.l3_vector_add, self, chat_id, message_id,
        content, emb_result.embedding, emb_result.model or "local")
      if ok3 then
        result.l3_vector = { success = true, id = entry.id }
      end
    else
      result.l3_vector.skipped = true
    end
  else
    result.l3_vector.skipped = true
  end

  -- L3.2: Lexical FTS (always)
  local ok2 = pcall(self.l3_lexical_add, self, chat_id, message_id, content)
  if ok2 then
    result.l3_lexical = { success = true }
  end

  -- L3.3: Entity extraction (if LLM extractor provided)
  if not opts.skip_entities and opts.llm_entities then
    local ok3, extraction = pcall(opts.llm_entities, content)
    if ok3 and extraction then
      local entity_count = 0
      local relation_count = 0
      local entity_ids = {}

      for _, ent in ipairs(extraction.entities or {}) do
        local ok4, e = pcall(self.l3_entity_add, self,
          ent.type or ent.entity_type, ent.value or ent.entity_value,
          chat_id, ent.canonical_form)
        if ok4 then
          entity_ids[ent.value or ent.entity_value] = e.id
          entity_count = entity_count + 1
        end
      end

      for _, rel in ipairs(extraction.relations or {}) do
        local src_id = entity_ids[rel.source or (rel.source_entity and rel.source_entity.value)]
        local tgt_id = entity_ids[rel.target or (rel.target_entity and rel.target_entity.value)]
        if src_id and tgt_id then
          local ok4 = pcall(self.l3_relation_add, self,
            src_id, tgt_id, rel.relation_type or rel.type, message_id, rel.confidence or 1.0)
          if ok4 then relation_count = relation_count + 1 end
        end
      end

      result.l3_graph = { success = true, entities = entity_count, relations = relation_count }
    end
  end

  -- L4: Salience computation (heuristic, no LLM needed)
  if not opts.skip_salience then
    local salience = compute_salience(content, {
      token_count = token_count,
      affect_intensity = result.l2.success and nil or 0.3,
    })

    if salience >= DEFAULT_CONFIG.l4_salience_threshold then
      local ok3, entry = pcall(self.l4_add, self, chat_id, message_id, content, salience)
      if ok3 then
        result.l4 = { success = true, id = entry.id }
      end
    else
      result.l4.skipped = true
    end
  else
    result.l4.skipped = true
  end

  -- L5: Co-occurrence graph (heuristic concept extraction)
  if not opts.skip_cooccurrence then
    local concepts = extract_concepts(content)
    local node_count = 0
    local edge_count = 0
    local node_ids = {}

    for _, concept in ipairs(concepts) do
      local ok3, node = pcall(self.l5_node_add, self, "CONCEPT", concept, chat_id)
      if ok3 then
        node_ids[#node_ids + 1] = node.id
        node_count = node_count + 1
      end
    end

    -- Pairwise edges
    for i = 1, #node_ids do
      for j = i + 1, #node_ids do
        local ok3 = pcall(self.l5_edge_add, self, node_ids[i], node_ids[j], 1.0)
        if ok3 then edge_count = edge_count + 1 end
      end
    end

    result.l5 = { success = true, nodes = node_count, edges = edge_count }
  end

  return result
end

-- ============================================================================
-- ENSEMBLE RETRIEVAL
-- ============================================================================

--- Compute dynamic weights based on query signals.
local function compute_weights(query)
  local weights = {}
  for k, v in pairs(DEFAULT_WEIGHTS) do weights[k] = v end

  local q = (query.query or ""):lower()

  -- Temporal references boost L1
  if q:match("%f[%a]recent%f[%A]") or q:match("%f[%a]just%f[%A]")
    or q:match("%f[%a]earlier%f[%A]") or q:match("%f[%a]before%f[%A]")
    or q:match("%f[%a]last%f[%A]") or q:match("%f[%a]now%f[%A]") then
    weights.L1 = weights.L1 + 0.25
  end

  -- Affect boost L2
  if query.affect_boost then
    weights.L2 = weights.L2 + 0.20
  end

  -- Certainty language boosts L3
  if q:match("%f[%a]definitely%f[%A]") or q:match("%f[%a]certainly%f[%A]")
    or q:match("%f[%a]always%f[%A]") or q:match("%f[%a]never%f[%A]")
    or q:match("%f[%a]exactly%f[%A]") then
    weights.L3 = weights.L3 + 0.20
  end

  -- Disruption references boost L4
  if q:match("%f[%a]broke%f[%A]") or q:match("%f[%a]failed%f[%A]")
    or q:match("%f[%a]error%f[%A]") or q:match("%f[%a]crash%f[%A]")
    or q:match("%f[%a]bug%f[%A]") or q:match("%f[%a]issue%f[%A]")
    or q:match("%f[%a]problem%f[%A]") or q:match("%f[%a]wrong%f[%A]") then
    weights.L4 = weights.L4 + 0.25
  end

  -- Social references boost L5
  if q:match("%f[%a]usually%f[%A]") or q:match("%f[%a]typically%f[%A]")
    or q:match("%f[%a]common%f[%A]") or q:match("%f[%a]often%f[%A]") then
    weights.L5 = weights.L5 + 0.20
  end

  -- Temporal bias adjustments
  if query.temporal_bias == "recent" then
    weights.L1 = weights.L1 + 0.15
    weights.L4 = weights.L4 - 0.10
  elseif query.temporal_bias == "salient" then
    weights.L4 = weights.L4 + 0.15
    weights.L1 = weights.L1 - 0.10
  end

  -- Normalize to sum to 1.0
  local total = 0
  for _, v in pairs(weights) do total = total + v end
  for k, v in pairs(weights) do weights[k] = v / total end

  return weights
end

--- Retrieve memories using ensemble scoring across all layers.
---
--- Query table:
---   chat_id        string   (required)
---   query          string   (required — the search text)
---   top_k          number   (default 10)
---   layers         table    (optional — e.g. {"L1","L3","L4"})
---   affect_boost   string[] (optional — affect categories to boost)
---   temporal_bias  string   (optional — "recent" | "salient" | "balanced")
---   query_embedding table   (optional — float array for vector search)
function Store:retrieve(query)
  local chat_id = query.chat_id
  local top_k = query.top_k or 10
  local enabled_layers = query.layers or { "L1", "L2", "L3", "L4", "L5" }
  local weights = compute_weights(query)

  -- Candidate map: message_id -> {content, scores, metadata}
  local candidates = {}

  local function has_layer(name)
    for _, l in ipairs(enabled_layers) do
      if l == name then return true end
    end
    return false
  end

  local function get_or_create(msg_id, content, ts)
    if not candidates[msg_id] then
      candidates[msg_id] = {
        content = content or "",
        message_id = msg_id,
        scores = {},
        metadata = { timestamp = ts or timestamp() },
      }
    end
    return candidates[msg_id]
  end

  -- L1: Recent entries
  if has_layer("L1") then
    local ok, entries = pcall(self.l1_get, self, chat_id, top_k * 2)
    if ok then
      local now_sec = os.time()
      for _, entry in ipairs(entries) do
        local c = get_or_create(entry.message_id, entry.content, entry.timestamp)
        -- Recency score: exponential decay with ~1-day half-life
        -- Parse timestamp roughly (good enough for scoring)
        local age_hours = 24 -- default fallback
        local y, m, d, h, mi, s = (entry.timestamp or ""):match("(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
        if y then
          local entry_time = os.time({year=tonumber(y), month=tonumber(m), day=tonumber(d),
                                       hour=tonumber(h), min=tonumber(mi), sec=tonumber(s)})
          age_hours = math.max(0, (now_sec - entry_time) / 3600)
        end
        c.scores.L1 = math.exp(-age_hours / 24)
      end
    end
  end

  -- L2: Affect-based
  if has_layer("L2") then
    local l2_opts = { limit = top_k * 2 }
    if query.affect_boost and #query.affect_boost > 0 then
      l2_opts.category = query.affect_boost[1]
    end
    local ok, entries = pcall(self.l2_get, self, chat_id, l2_opts)
    if ok then
      for _, entry in ipairs(entries) do
        local c = get_or_create(entry.message_id, "", entry.created_at)
        c.scores.L2 = entry.intensity * entry.decay_factor
        c.metadata.affect_category = entry.affect_category
        c.metadata.affect_intensity = entry.intensity
      end
    end
  end

  -- L3: Vector + Lexical
  if has_layer("L3") then
    -- Vector search (if embedding provided)
    if query.query_embedding then
      local ok, scored = pcall(self.l3_vector_search, self, chat_id, query.query_embedding, top_k * 2)
      if ok then
        for _, item in ipairs(scored) do
          local c = get_or_create(item.entry.message_id, "", item.entry.created_at)
          c.scores.L3 = (c.scores.L3 or 0) + item.score * 0.6
        end
      end
    end

    -- Lexical search
    if query.query and #query.query > 0 then
      local ok, results = pcall(self.l3_lexical_search, self, chat_id, query.query, top_k * 2)
      if ok then
        for _, item in ipairs(results) do
          local c = get_or_create(item.message_id, item.content, nil)
          c.scores.L3 = (c.scores.L3 or 0) + item.score * 0.4
          if c.content == "" then c.content = item.content end
        end
      end
    end
  end

  -- L4: Salience
  if has_layer("L4") then
    local ok, entries = pcall(self.l4_get, self, chat_id, { limit = top_k * 2 })
    if ok then
      for _, entry in ipairs(entries) do
        local c = get_or_create(entry.message_id, entry.content, entry.created_at)
        local pin_boost = (entry.user_pinned == 1) and 1.5 or 1.0
        c.scores.L4 = entry.salience_score * pin_boost
        c.metadata.salience_score = entry.salience_score
        if c.content == "" then c.content = entry.content end
      end
    end
  end

  -- L5: Co-occurrence (skipped in retrieval for now — requires concept extraction from query)

  -- Compute ensemble scores
  local results = {}
  for msg_id, candidate in pairs(candidates) do
    local ensemble_score = 0
    local dominant_layer = "L1"
    local max_layer_score = 0

    for layer, score in pairs(candidate.scores) do
      local weighted = score * (weights[layer] or 0)
      ensemble_score = ensemble_score + weighted
      if weighted > max_layer_score then
        max_layer_score = weighted
        dominant_layer = layer
      end
    end

    results[#results + 1] = {
      id = msg_id,
      layer = dominant_layer,
      content = candidate.content,
      message_id = candidate.message_id,
      score = ensemble_score,
      metadata = candidate.metadata,
    }
  end

  -- Sort by score descending
  table.sort(results, function(a, b) return a.score > b.score end)

  -- Return top K
  if #results > top_k then
    local trimmed = {}
    for i = 1, top_k do trimmed[i] = results[i] end
    return trimmed
  end

  return results
end

-- ============================================================================
-- CURATION API
-- ============================================================================

--- Mute a message across all layers.
function Store:mute_message(message_id)
  local affected = {}

  local r2 = self._db:changes()
  self._db:tryExec("UPDATE l2_affect SET is_muted = 1 WHERE message_id = ?", message_id)
  if self._db:changes() > 0 then affected[#affected + 1] = "L2" end

  self._db:tryExec("UPDATE l3_vectors SET is_muted = 1 WHERE message_id = ?", message_id)
  if self._db:changes() > 0 then affected[#affected + 1] = "L3" end

  self._db:tryExec("UPDATE l3_lexical_meta SET is_muted = 1 WHERE message_id = ?", message_id)
  self._db:tryExec("UPDATE l3_relations SET is_muted = 1 WHERE context_message_id = ?", message_id)

  self._db:tryExec("UPDATE l4_salience SET is_muted = 1 WHERE message_id = ?", message_id)
  if self._db:changes() > 0 then affected[#affected + 1] = "L4" end

  return affected
end

--- Boost L3 encoding for a message.
function Store:boost_l3(message_id, factor)
  factor = factor or 2.0
  self._db:tryExec("UPDATE l3_vectors SET boost_factor = boost_factor * ? WHERE message_id = ?", factor, message_id)
  self._db:tryExec("UPDATE l3_lexical_meta SET boost_factor = boost_factor * ? WHERE message_id = ?", factor, message_id)
end

--- Delete a message from all layers.
function Store:delete_message(chat_id, message_id)
  self._db:tryExec("DELETE FROM l1_river WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
  self._db:tryExec("DELETE FROM l2_affect WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
  self._db:tryExec("DELETE FROM l3_vectors WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
  self._db:tryExec("DELETE FROM l3_lexical_fts WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
  self._db:tryExec("DELETE FROM l3_lexical_meta WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
  self._db:tryExec("DELETE FROM l4_salience WHERE chat_id = ? AND message_id = ?", chat_id, message_id)
end

-- ============================================================================
-- STATISTICS
-- ============================================================================

--- Get memory statistics for a chat.
function Store:stats(chat_id)
  local l1 = self._db:queryOne(
    "SELECT COUNT(*) as count, COALESCE(SUM(token_count), 0) as tokens FROM l1_river WHERE chat_id = ? AND evicted_at IS NULL",
    chat_id
  )

  local l2_rows = self._db:query(
    "SELECT affect_category, COUNT(*) as count FROM l2_affect WHERE chat_id = ? AND is_muted = 0 GROUP BY affect_category",
    chat_id
  )
  local l2_by_category = {}
  local l2_total = 0
  for _, cat in ipairs(AFFECT_CATEGORIES) do l2_by_category[cat] = 0 end
  for _, row in ipairs(l2_rows) do
    l2_by_category[row.affect_category] = row.count
    l2_total = l2_total + row.count
  end

  local l3_vectors = self._db:scalar(
    "SELECT COUNT(*) FROM l3_vectors WHERE chat_id = ? AND is_muted = 0", chat_id) or 0
  local l3_lexical = self._db:scalar(
    "SELECT COUNT(*) FROM l3_lexical_meta WHERE chat_id = ? AND is_muted = 0", chat_id) or 0
  local l3_entities = self._db:scalar(
    "SELECT COUNT(*) FROM l3_entities WHERE chat_id = ? OR chat_id IS NULL", chat_id) or 0
  local l3_relations = self._db:scalar(
    "SELECT COUNT(*) FROM l3_relations WHERE is_muted = 0") or 0

  local l4 = self._db:queryOne(
    "SELECT COUNT(*) as count, COALESCE(SUM(user_pinned), 0) as pinned FROM l4_salience WHERE chat_id = ? AND is_muted = 0",
    chat_id
  )

  local l5_nodes = self._db:scalar(
    "SELECT COUNT(*) FROM l5_nodes WHERE chat_id = ? OR chat_id IS NULL", chat_id) or 0
  local l5_edges = self._db:scalar("SELECT COUNT(*) FROM l5_edges") or 0

  return {
    chat_id = chat_id,
    l1 = { entries = l1.count, total_tokens = l1.tokens },
    l2 = { entries = l2_total, by_category = l2_by_category },
    l3 = { vectors = l3_vectors, lexical_entries = l3_lexical,
           entities = l3_entities, relations = l3_relations },
    l4 = { entries = l4.count, pinned = l4.pinned },
    l5 = { nodes = l5_nodes, edges = l5_edges },
  }
end

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

--- Get a config value (returns default if not set).
function Store:get_config(key)
  local row = self._db:queryOne("SELECT value FROM memory_config WHERE key = ?", key)
  if row then return row.value end
  return DEFAULT_CONFIG[key]
end

--- Set a config value.
function Store:set_config(key, value)
  local now = timestamp()
  self._db:exec(
    "INSERT OR REPLACE INTO memory_config (key, value, updated_at) VALUES (?, ?, ?)",
    key, tostring(value), now
  )
end

--- Get all config as a table.
function Store:get_all_config()
  local config = {}
  for k, v in pairs(DEFAULT_CONFIG) do config[k] = v end

  local rows = self._db:query("SELECT key, value FROM memory_config")
  for _, row in ipairs(rows) do
    local v = row.value
    -- Type coerce
    if v == "true" then v = true
    elseif v == "false" then v = false
    elseif tonumber(v) then v = tonumber(v)
    end
    config[row.key] = v
  end

  return config
end

-- ============================================================================
-- CONSOLIDATION TRACKING
-- ============================================================================

function Store:record_consolidation(chat_id, trigger_type)
  local id = new_id("cons_")
  local now = timestamp()
  self._db:exec(
    "INSERT INTO consolidation_runs (id, chat_id, trigger_type, started_at) VALUES (?, ?, ?, ?)",
    id, chat_id, trigger_type, now
  )
  return id
end

function Store:complete_consolidation(run_id, items_processed, summaries_created, conflicts_detected)
  local now = timestamp()
  self._db:exec(
    "UPDATE consolidation_runs SET completed_at = ?, items_processed = ?, summaries_created = ?, conflicts_detected = ? WHERE id = ?",
    now, items_processed or 0, summaries_created or 0, conflicts_detected or 0, run_id
  )
end

-- ============================================================================
-- EMBEDDING CACHE
-- ============================================================================

function Store:get_cached_embedding(content_hash, model_name)
  local row = self._db:queryOne(
    "SELECT embedding_blob FROM embedding_cache WHERE content_hash = ? AND embedding_model = ?",
    content_hash, model_name
  )
  if row then
    self._db:exec("UPDATE embedding_cache SET last_accessed_at = ? WHERE content_hash = ?",
      timestamp(), content_hash)
    return deserialize_embedding(row.embedding_blob)
  end
  return nil
end

function Store:cache_embedding(content_hash, embedding, model_name)
  local now = timestamp()
  local blob = serialize_embedding(embedding)
  self._db:exec(
    "INSERT OR REPLACE INTO embedding_cache (content_hash, embedding_blob, embedding_model, dimensions, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?)",
    content_hash, blob, model_name, #embedding, now, now
  )
end

-- ============================================================================
-- Expose utilities for external use
-- ============================================================================

Memory.estimate_tokens = estimate_tokens
Memory.hash_content = hash_content
Memory.compute_salience = compute_salience
Memory.extract_concepts = extract_concepts
Memory.cosine_similarity = cosine_similarity
Memory.serialize_embedding = serialize_embedding
Memory.deserialize_embedding = deserialize_embedding

return Memory
