--[[
  tilecache.lua — Tile storage, fetching, and GPU texture management

  Three-tier cascading lookup:
    1. LRU memory cache (Love2D Image objects, ~200 tiles max)
    2. SQLite database (MBTiles-compatible, persistent on disk)
    3. HTTP fetch (async via lua/http.lua, stored to SQLite on arrival)

  Tile sources are pluggable URL templates ({z}/{x}/{y} substitution).
  Supports offline region downloads with progress tracking.

  Usage:
    local TileCache = require("lua.tilecache")
    local cache = TileCache.open("maps.db")
    TileCache.addSource(cache, "osm", {
      urlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      minZoom = 0, maxZoom = 19,
    })
    local img = TileCache.getTile(cache, "osm", 13, 4093, 2723)
    -- img is a Love2D Image or nil (will arrive next frame if fetching)

  Requires: lua/sqlite.lua, lua/http.lua (optional, for network fetches)
]]

local TileCache = {}

local SQLite = nil  -- lazy-loaded
local Http = nil    -- lazy-loaded

-- ============================================================================
-- Constants
-- ============================================================================

local MAX_MEMORY_TILES = 200     -- max Love2D Image objects in GPU memory
local MAX_PENDING_FETCHES = 8    -- max concurrent HTTP tile requests
local TMS_FLIP = true            -- MBTiles uses TMS Y-flip convention

-- ============================================================================
-- Built-in tile source aliases
-- ============================================================================

local BUILTIN_SOURCES = {
  osm = {
    urlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    type = "raster",
    minZoom = 0,
    maxZoom = 19,
    tileSize = 256,
    attribution = "© OpenStreetMap contributors",
  },
  ["osm-cycle"] = {
    urlTemplate = "https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png",
    type = "raster",
    minZoom = 0,
    maxZoom = 18,
    tileSize = 256,
    attribution = "© Thunderforest, © OpenStreetMap contributors",
  },
}

-- ============================================================================
-- Internal: LRU texture cache
-- ============================================================================

local function createLRU(maxSize)
  return {
    maxSize = maxSize,
    entries = {},   -- key → { image, prev, next }
    head = nil,     -- most recently used
    tail = nil,     -- least recently used
    count = 0,
  }
end

local function lruTouch(lru, key)
  local entry = lru.entries[key]
  if not entry then return nil end

  -- Already at head
  if lru.head == entry then return entry.image end

  -- Remove from current position
  if entry.prev then entry.prev.next = entry.next end
  if entry.next then entry.next.prev = entry.prev end
  if lru.tail == entry then lru.tail = entry.prev end

  -- Move to head
  entry.prev = nil
  entry.next = lru.head
  if lru.head then lru.head.prev = entry end
  lru.head = entry
  if not lru.tail then lru.tail = entry end

  return entry.image
end

local function lruPut(lru, key, image)
  -- If already exists, update and touch
  local existing = lru.entries[key]
  if existing then
    existing.image = image
    lruTouch(lru, key)
    return
  end

  -- Evict LRU if at capacity
  while lru.count >= lru.maxSize and lru.tail do
    local evict = lru.tail
    lru.tail = evict.prev
    if lru.tail then lru.tail.next = nil end
    if lru.head == evict then lru.head = nil end
    lru.entries[evict.key] = nil
    if evict.image then
      evict.image:release()
    end
    lru.count = lru.count - 1
  end

  -- Insert at head
  local entry = { key = key, image = image, prev = nil, next = lru.head }
  if lru.head then lru.head.prev = entry end
  lru.head = entry
  if not lru.tail then lru.tail = entry end
  lru.entries[key] = entry
  lru.count = lru.count + 1
end

local function lruGet(lru, key)
  return lruTouch(lru, key)
end

local function lruClear(lru)
  local entry = lru.head
  while entry do
    if entry.image then entry.image:release() end
    entry = entry.next
  end
  lru.entries = {}
  lru.head = nil
  lru.tail = nil
  lru.count = 0
end

-- ============================================================================
-- Tile key helpers
-- ============================================================================

local function tileKey(source, z, x, y)
  return source .. "/" .. z .. "/" .. x .. "/" .. y
end

--- Convert XYZ to TMS Y coordinate (MBTiles convention).
local function xyzToTmsY(y, z)
  return math.pow(2, z) - 1 - y
end

-- ============================================================================
-- Blob → Love2D Image
-- ============================================================================

--- Create a Love2D Image from raw PNG/JPEG data.
--- @param blob string  Raw image data (PNG, JPEG, etc.)
--- @return love.Image|nil  The loaded image, or nil on failure
local function blobToImage(blob)
  if not blob or #blob == 0 then return nil end
  local ok, result = pcall(function()
    local fileData = love.filesystem.newFileData(blob, "tile.png")
    local imageData = love.image.newImageData(fileData)
    local image = love.graphics.newImage(imageData)
    image:setFilter("linear", "linear")
    return image
  end)
  if ok then return result end
  return nil
end

-- ============================================================================
-- Cache handle (one per map instance)
-- ============================================================================

--- Open a tile cache backed by an SQLite database.
--- @param dbPath string|nil  Path for persistent storage (nil = in-memory only)
--- @return table  Cache handle
function TileCache.open(dbPath)
  -- Lazy-load SQLite
  if not SQLite then
    local ok, mod = pcall(require, "lua.sqlite")
    if ok and mod.available then
      SQLite = mod
    end
  end

  local db = nil
  if SQLite then
    db = SQLite.open(dbPath or "tilecache.db")
    -- Create MBTiles-compatible schema
    db:exec([[
      CREATE TABLE IF NOT EXISTS tiles (
        source TEXT NOT NULL,
        zoom_level INTEGER NOT NULL,
        tile_column INTEGER NOT NULL,
        tile_row INTEGER NOT NULL,
        tile_data BLOB NOT NULL,
        fetched_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (source, zoom_level, tile_column, tile_row)
      )
    ]])
    db:exec([[
      CREATE TABLE IF NOT EXISTS metadata (
        name TEXT PRIMARY KEY,
        value TEXT
      )
    ]])
    db:exec("CREATE INDEX IF NOT EXISTS idx_tiles_fetched ON tiles(fetched_at)")
  end

  local handle = {
    db = db,
    lru = createLRU(MAX_MEMORY_TILES),
    sources = {},           -- name → source config
    pendingFetches = {},    -- tileKey → true (in-flight HTTP requests)
    pendingCount = 0,
    fetchIdCounter = 0,
    fetchCallbacks = {},    -- fetchId → tileKey (to correlate HTTP responses)
    downloads = {},         -- regionId → download state
    downloadIdCounter = 0,
  }

  return handle
end

--- Close a tile cache. Releases all GPU textures and closes the database.
function TileCache.close(handle)
  if not handle then return end
  lruClear(handle.lru)
  if handle.db then
    handle.db:close()
    handle.db = nil
  end
end

-- ============================================================================
-- Tile Sources
-- ============================================================================

--- Add a tile source to the cache.
--- @param handle table  Cache handle
--- @param name string  Source name (e.g. "osm", "satellite", "my-game-tiles")
--- @param opts table  Source configuration
function TileCache.addSource(handle, name, opts)
  -- Check built-in aliases
  local base = BUILTIN_SOURCES[name]
  if base and not opts.urlTemplate then
    opts = {}
    for k, v in pairs(base) do opts[k] = v end
  end

  handle.sources[name] = {
    urlTemplate = opts.urlTemplate or "",
    type = opts.type or "raster",
    minZoom = opts.minZoom or 0,
    maxZoom = opts.maxZoom or 19,
    tileSize = opts.tileSize or 256,
    attribution = opts.attribution or "",
    headers = opts.headers or {},
  }
end

--- Build a tile URL from a source's template.
local function buildTileUrl(source, z, x, y)
  local url = source.urlTemplate
  url = url:gsub("{z}", tostring(z))
  url = url:gsub("{x}", tostring(x))
  url = url:gsub("{y}", tostring(y))
  return url
end

-- ============================================================================
-- Tile Retrieval (3-tier cascade)
-- ============================================================================

--- Get a tile image, triggering async fetch if not cached.
--- Returns immediately with nil if the tile is still loading.
--- @param handle table  Cache handle
--- @param sourceName string  Source name
--- @param z number  Zoom level
--- @param x number  Tile X
--- @param y number  Tile Y
--- @return love.Image|nil  The tile image, or nil if not yet available
function TileCache.getTile(handle, sourceName, z, x, y)
  local key = tileKey(sourceName, z, x, y)

  -- Tier 1: LRU memory cache
  local img = lruGet(handle.lru, key)
  if img then return img end

  -- Tier 2: SQLite database
  if handle.db then
    local tmsY = xyzToTmsY(y, z)
    local row = handle.db:queryOne(
      "SELECT tile_data FROM tiles WHERE source = ? AND zoom_level = ? AND tile_column = ? AND tile_row = ?",
      sourceName, z, x, tmsY
    )
    if row and row.tile_data then
      img = blobToImage(row.tile_data)
      if img then
        lruPut(handle.lru, key, img)
        -- Update LRU timestamp in DB
        handle.db:exec(
          "UPDATE tiles SET fetched_at = ? WHERE source = ? AND zoom_level = ? AND tile_column = ? AND tile_row = ?",
          os.time(), sourceName, z, x, tmsY
        )
        return img
      end
    end
  end

  -- Tier 3: HTTP fetch (async)
  if not handle.pendingFetches[key] and handle.pendingCount < MAX_PENDING_FETCHES then
    local source = handle.sources[sourceName]
    if source and source.urlTemplate ~= "" then
      -- Lazy-load HTTP
      if not Http then
        local ok, mod = pcall(require, "lua.http")
        if ok then Http = mod end
      end

      if Http then
        handle.fetchIdCounter = handle.fetchIdCounter + 1
        local fetchId = "tile:" .. handle.fetchIdCounter
        local url = buildTileUrl(source, z, x, y)

        Http.request(fetchId, {
          url = url,
          method = "GET",
          headers = source.headers,
        })

        handle.pendingFetches[key] = true
        handle.pendingCount = handle.pendingCount + 1
        handle.fetchCallbacks[fetchId] = {
          key = key,
          sourceName = sourceName,
          z = z, x = x, y = y,
        }
      end
    end
  end

  return nil  -- not yet available
end

--- Poll for completed tile fetches. Call once per frame.
--- @param handle table  Cache handle
--- @return number  Number of new tiles loaded this frame
function TileCache.poll(handle)
  if not Http then return 0 end

  local responses = Http.poll()
  local loaded = 0

  for _, resp in ipairs(responses) do
    local meta = handle.fetchCallbacks[resp.id]
    if meta then
      handle.fetchCallbacks[resp.id] = nil
      handle.pendingFetches[meta.key] = nil
      handle.pendingCount = handle.pendingCount - 1

      if resp.status == 200 and resp.body and #resp.body > 0 then
        -- Store in SQLite
        if handle.db then
          local tmsY = xyzToTmsY(meta.y, meta.z)
          handle.db:exec(
            "INSERT OR REPLACE INTO tiles (source, zoom_level, tile_column, tile_row, tile_data, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
            { meta.sourceName, meta.z, meta.x, tmsY, resp.body, os.time() }
          )
        end

        -- Load into GPU and LRU
        local img = blobToImage(resp.body)
        if img then
          lruPut(handle.lru, meta.key, img)
          loaded = loaded + 1
        end
      end
    end
  end

  return loaded
end

-- ============================================================================
-- Offline Region Downloads
-- ============================================================================

--- Start downloading tiles for an offline region.
--- @param handle table  Cache handle
--- @param sourceName string  Source name
--- @param bounds table  { swLat, swLng, neLat, neLng }
--- @param minZoom number  Minimum zoom level to download
--- @param maxZoom number  Maximum zoom level to download
--- @return string  Region ID for tracking progress
function TileCache.downloadRegion(handle, sourceName, bounds, minZoom, maxZoom)
  local Geo = require("lua.geo")

  handle.downloadIdCounter = handle.downloadIdCounter + 1
  local regionId = "region:" .. handle.downloadIdCounter

  -- Compute all tile coordinates in the region
  local tiles = {}
  for z = minZoom, maxZoom do
    local minTx, minTy = Geo.latlngToTile(bounds.neLat, bounds.swLng, z)
    local maxTx, maxTy = Geo.latlngToTile(bounds.swLat, bounds.neLng, z)
    for tx = minTx, maxTx do
      for ty = minTy, maxTy do
        tiles[#tiles + 1] = { z = z, x = Geo.wrapTileX(tx, z), y = ty }
      end
    end
  end

  handle.downloads[regionId] = {
    sourceName = sourceName,
    tiles = tiles,
    total = #tiles,
    done = 0,
    failed = 0,
    cursor = 1,       -- next tile to fetch
    cancelled = false,
  }

  return regionId
end

--- Cancel an in-progress region download.
function TileCache.cancelDownload(handle, regionId)
  local dl = handle.downloads[regionId]
  if dl then dl.cancelled = true end
end

--- Get download progress for a region.
--- @return table|nil  { total, done, failed, percent } or nil if not found
function TileCache.getDownloadProgress(handle, regionId)
  local dl = handle.downloads[regionId]
  if not dl then return nil end
  return {
    total = dl.total,
    done = dl.done,
    failed = dl.failed,
    percent = dl.total > 0 and (dl.done / dl.total * 100) or 0,
    cancelled = dl.cancelled,
    complete = dl.done + dl.failed >= dl.total,
  }
end

--- Advance region downloads. Call once per frame after TileCache.poll().
--- Queues a few tiles per frame to avoid flooding the HTTP pool.
--- @param handle table  Cache handle
function TileCache.advanceDownloads(handle)
  for regionId, dl in pairs(handle.downloads) do
    if dl.cancelled or dl.cursor > dl.total then
      goto continue
    end

    -- Queue up to 2 tiles per frame per region
    local queued = 0
    while dl.cursor <= dl.total and queued < 2 and handle.pendingCount < MAX_PENDING_FETCHES do
      local tile = dl.tiles[dl.cursor]
      dl.cursor = dl.cursor + 1

      -- Check if already in SQLite
      local alreadyCached = false
      if handle.db then
        local tmsY = xyzToTmsY(tile.y, tile.z)
        alreadyCached = handle.db:exists(
          "SELECT 1 FROM tiles WHERE source = ? AND zoom_level = ? AND tile_column = ? AND tile_row = ?",
          dl.sourceName, tile.z, tile.x, tmsY
        )
      end

      if alreadyCached then
        dl.done = dl.done + 1
      else
        -- Fetch via HTTP
        TileCache.getTile(handle, dl.sourceName, tile.z, tile.x, tile.y)
        queued = queued + 1
      end
    end

    ::continue::
  end
end

-- ============================================================================
-- Cache Management
-- ============================================================================

--- Get cache statistics.
--- @param handle table  Cache handle
--- @return table  { memoryTiles, dbTiles, dbBytes, sources }
function TileCache.cacheStats(handle)
  local stats = {
    memoryTiles = handle.lru.count,
    dbTiles = 0,
    dbBytes = 0,
    sources = {},
  }

  if handle.db then
    local row = handle.db:queryOne("SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(tile_data)), 0) as bytes FROM tiles")
    if row then
      stats.dbTiles = row.cnt or 0
      stats.dbBytes = row.bytes or 0
    end

    local sourceRows = handle.db:query("SELECT source, COUNT(*) as cnt FROM tiles GROUP BY source")
    for _, sr in ipairs(sourceRows) do
      stats.sources[sr.source] = sr.cnt
    end
  end

  return stats
end

--- Evict tiles from the SQLite database to stay under a byte limit.
--- Removes oldest-fetched tiles first.
--- @param handle table  Cache handle
--- @param maxBytes number  Maximum total size in bytes
function TileCache.evict(handle, maxBytes)
  if not handle.db then return end

  local row = handle.db:queryOne("SELECT COALESCE(SUM(LENGTH(tile_data)), 0) as total FROM tiles")
  if not row or row.total <= maxBytes then return end

  local toRemove = row.total - maxBytes
  local removed = 0

  -- Delete oldest tiles until under budget
  while removed < toRemove do
    local oldest = handle.db:queryOne(
      "SELECT source, zoom_level, tile_column, tile_row, LENGTH(tile_data) as size FROM tiles ORDER BY fetched_at ASC LIMIT 1"
    )
    if not oldest then break end

    handle.db:exec(
      "DELETE FROM tiles WHERE source = ? AND zoom_level = ? AND tile_column = ? AND tile_row = ?",
      oldest.source, oldest.zoom_level, oldest.tile_column, oldest.tile_row
    )
    removed = removed + (oldest.size or 0)
  end
end

--- Clear all tiles for a specific source.
--- @param handle table  Cache handle
--- @param sourceName string  Source to clear
function TileCache.clearSource(handle, sourceName)
  -- Clear from LRU
  local prefix = sourceName .. "/"
  local toRemove = {}
  for key, entry in pairs(handle.lru.entries) do
    if key:sub(1, #prefix) == prefix then
      toRemove[#toRemove + 1] = key
    end
  end
  for _, key in ipairs(toRemove) do
    local entry = handle.lru.entries[key]
    if entry then
      -- Remove from linked list
      if entry.prev then entry.prev.next = entry.next end
      if entry.next then entry.next.prev = entry.prev end
      if handle.lru.head == entry then handle.lru.head = entry.next end
      if handle.lru.tail == entry then handle.lru.tail = entry.prev end
      if entry.image then entry.image:release() end
      handle.lru.entries[key] = nil
      handle.lru.count = handle.lru.count - 1
    end
  end

  -- Clear from SQLite
  if handle.db then
    handle.db:exec("DELETE FROM tiles WHERE source = ?", sourceName)
  end
end

return TileCache
