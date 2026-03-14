--[[
  httpserver.lua — Non-blocking HTTP server for Love2D

  Serves static files directly from the OS filesystem (zero bridge overhead)
  and forwards dynamic route requests to the React layer via bridge events.

  Modeled on wsserver.lua. Uses LuaSocket TCP in non-blocking mode.

  Usage (from React via RPC):
    httpserver:listen  { serverId, port, host?, routes }
    httpserver:respond { serverId, clientId, status, headers, body }
    httpserver:close   { serverId }

  Routes format:
    { { path = "/media", type = "static", root = "/home/user/music" },
      { path = "/api/health", type = "handler" },
      { path = "/api/users/:id", type = "handler" } }
]]

local socket = require("socket")

-- ============================================================================
-- MIME type lookup (media-focused)
-- ============================================================================

local MIME_TYPES = {
  -- Audio
  mp3  = "audio/mpeg",
  ogg  = "audio/ogg",
  wav  = "audio/wav",
  flac = "audio/flac",
  aac  = "audio/aac",
  m4a  = "audio/mp4",
  opus = "audio/opus",
  wma  = "audio/x-ms-wma",
  -- Video
  mp4  = "video/mp4",
  webm = "video/webm",
  mkv  = "video/x-matroska",
  avi  = "video/x-msvideo",
  mov  = "video/quicktime",
  m4v  = "video/mp4",
  -- Images
  png  = "image/png",
  jpg  = "image/jpeg",
  jpeg = "image/jpeg",
  gif  = "image/gif",
  webp = "image/webp",
  svg  = "image/svg+xml",
  ico  = "image/x-icon",
  bmp  = "image/bmp",
  -- Text / code
  html = "text/html; charset=utf-8",
  htm  = "text/html; charset=utf-8",
  css  = "text/css; charset=utf-8",
  js   = "application/javascript; charset=utf-8",
  json = "application/json; charset=utf-8",
  txt  = "text/plain; charset=utf-8",
  xml  = "application/xml; charset=utf-8",
  csv  = "text/csv; charset=utf-8",
  md   = "text/markdown; charset=utf-8",
  -- Fonts
  woff  = "font/woff",
  woff2 = "font/woff2",
  ttf   = "font/ttf",
  otf   = "font/otf",
  -- Archives / misc
  pdf  = "application/pdf",
  zip  = "application/zip",
  gz   = "application/gzip",
  tar  = "application/x-tar",
  wasm = "application/wasm",
}

local function getMimeType(path)
  local ext = path:match("%.([^%.]+)$")
  if ext then
    return MIME_TYPES[ext:lower()] or "application/octet-stream"
  end
  return "application/octet-stream"
end

-- ============================================================================
-- Path matching
-- ============================================================================

--- Match a URL path against a route pattern.
--- Supports :param segments and * wildcards.
--- Returns params table on match, nil on miss.
local function matchPath(pattern, path)
  local params = {}

  -- Exact match (fast path)
  if pattern == path then return params end

  -- Wildcard catch-all
  if pattern:sub(-2) == "/*" then
    local prefix = pattern:sub(1, -3)
    if path == prefix or path:sub(1, #prefix + 1) == prefix .. "/" then
      params["*"] = path:sub(#prefix + 1)
      return params
    end
    return nil
  end

  -- Split into segments and match
  local patParts = {}
  for seg in pattern:gmatch("[^/]+") do patParts[#patParts + 1] = seg end

  local pathParts = {}
  for seg in path:gmatch("[^/]+") do pathParts[#pathParts + 1] = seg end

  if #patParts ~= #pathParts then return nil end

  for i = 1, #patParts do
    local pat = patParts[i]
    local val = pathParts[i]
    if pat:sub(1, 1) == ":" then
      params[pat:sub(2)] = val
    elseif pat ~= val then
      return nil
    end
  end

  return params
end

--- Check if a path is a prefix of another (for static routes).
--- Returns the relative path after the prefix, or nil.
local function matchPrefix(prefix, path)
  -- Normalize: strip trailing slash from prefix
  if prefix:sub(-1) == "/" then prefix = prefix:sub(1, -2) end
  if prefix == "" or prefix == "/" then
    -- Root static mount
    return path
  end
  if path == prefix then return "/" end
  if path:sub(1, #prefix + 1) == prefix .. "/" then
    return path:sub(#prefix + 1)
  end
  return nil
end

-- ============================================================================
-- Security: path traversal prevention
-- ============================================================================

local function sanitizePath(relPath)
  -- Reject any path containing ..
  if relPath:find("%.%.") then return nil end
  -- Reject null bytes
  if relPath:find("%z") then return nil end
  -- Normalize leading slash
  if relPath:sub(1, 1) ~= "/" then relPath = "/" .. relPath end
  return relPath
end

-- ============================================================================
-- HTTP response helpers
-- ============================================================================

local STATUS_TEXT = {
  [200] = "OK",
  [201] = "Created",
  [204] = "No Content",
  [301] = "Moved Permanently",
  [302] = "Found",
  [304] = "Not Modified",
  [400] = "Bad Request",
  [403] = "Forbidden",
  [404] = "Not Found",
  [405] = "Method Not Allowed",
  [413] = "Payload Too Large",
  [500] = "Internal Server Error",
}

local function sendResponse(sock, status, headers, body)
  body = body or ""
  headers = headers or {}

  local statusText = STATUS_TEXT[status] or "Unknown"
  local head = "HTTP/1.1 " .. status .. " " .. statusText .. "\r\n"

  -- Defaults
  if not headers["Content-Length"] and not headers["content-length"] then
    headers["Content-Length"] = tostring(#body)
  end
  if not headers["Connection"] and not headers["connection"] then
    headers["Connection"] = "close"
  end

  for k, v in pairs(headers) do
    head = head .. k .. ": " .. v .. "\r\n"
  end
  head = head .. "\r\n"

  local ok, err = sock:send(head .. body)
  return ok, err
end

local function send404(sock, path)
  sendResponse(sock, 404, {
    ["Content-Type"] = "text/plain; charset=utf-8",
  }, "404 Not Found: " .. path)
end

local function send403(sock)
  sendResponse(sock, 403, {
    ["Content-Type"] = "text/plain; charset=utf-8",
  }, "403 Forbidden")
end

local function send500(sock, msg)
  sendResponse(sock, 500, {
    ["Content-Type"] = "text/plain; charset=utf-8",
  }, "500 Internal Server Error: " .. (msg or ""))
end

-- ============================================================================
-- HTTP request parsing
-- ============================================================================

local function parseHeaders(raw)
  local headers = {}
  for line in raw:gmatch("[^\r\n]+") do
    local k, v = line:match("^([^:]+):%s*(.+)$")
    if k then
      headers[k:lower()] = v:match("^%s*(.-)%s*$")
    end
  end
  return headers
end

local function parseQueryString(qs)
  local params = {}
  if not qs or qs == "" then return params end
  for pair in qs:gmatch("[^&]+") do
    local k, v = pair:match("^([^=]+)=?(.*)")
    if k then
      -- Basic URL decode
      k = k:gsub("%%(%x%x)", function(h) return string.char(tonumber(h, 16)) end)
      v = v:gsub("%%(%x%x)", function(h) return string.char(tonumber(h, 16)) end)
      params[k] = v
    end
  end
  return params
end

-- ============================================================================
-- Server instance
-- ============================================================================

local Server = {}
Server.__index = Server

function Server.new(host, port, routes)
  local serverSock = socket.tcp()
  serverSock:settimeout(0)
  serverSock:setoption("reuseaddr", true)

  local ok, err = serverSock:bind(host or "0.0.0.0", port)
  if not ok then
    return nil, "Failed to bind: " .. tostring(err)
  end

  serverSock:listen(32)

  local m = {
    socket = serverSock,
    host = host or "0.0.0.0",
    port = port,
    routes = routes or {},   -- { { path, type, root?, method? }, ... }
    clients = {},
    nextClientId = 1,
    events = {},             -- pending events for bridge
  }

  setmetatable(m, Server)
  io.write("[httpserver] Listening on " .. m.host .. ":" .. port .. "\n"); io.flush()
  return m
end

--- Accept connections and process all clients. Returns pending events.
function Server:update()
  -- Accept new TCP connections
  while true do
    local client, err = self.socket:accept()
    if not client then break end

    client:settimeout(0)
    local id = self.nextClientId
    self.nextClientId = id + 1

    self.clients[id] = {
      sock = client,
      state = "reading_headers",
      buffer = "",
      bodyBuffer = "",
      bodyNeeded = 0,
      request = nil,
      startTime = socket.gettime(),
    }
  end

  -- Process each client
  local now = socket.gettime()
  for id, c in pairs(self.clients) do
    -- Timeout: 30s for reading, then drop
    if now - c.startTime > 30 then
      self:_removeClient(id)
    elseif c.state == "reading_headers" then
      self:_readHeaders(id, c)
    elseif c.state == "reading_body" then
      self:_readBody(id, c)
    elseif c.state == "ready" then
      self:_dispatch(id, c)
    end
  end

  -- Drain event queue
  local evts = self.events
  self.events = {}
  return evts
end

--- Read HTTP headers from client.
function Server:_readHeaders(id, c)
  while true do
    local data, err, partial = c.sock:receive("*l")
    if data then
      c.buffer = c.buffer .. data .. "\r\n"
      if data == "" or data == "\r" then break end
    elseif partial and #partial > 0 then
      c.buffer = c.buffer .. partial
      return
    else
      if err == "closed" then self:_removeClient(id) end
      return
    end
  end

  -- Check for complete headers
  if not (c.buffer:find("\r\n\r\n") or c.buffer:find("\n\n")) then
    return
  end

  -- Parse request line
  local method, rawPath, version = c.buffer:match("^([A-Z]+)%s+([^%s]+)%s+HTTP/(%d%.%d)")
  if not method then
    sendResponse(c.sock, 400, {}, "Bad Request")
    self:_removeClient(id)
    return
  end

  -- Separate path and query string
  local path, queryString = rawPath:match("^([^?]+)%??(.*)")
  path = path or rawPath

  -- Parse headers
  local headerBlock = c.buffer:match("\r\n(.+)$") or ""
  local headers = parseHeaders(headerBlock)
  local query = parseQueryString(queryString)

  c.request = {
    method = method,
    path = path,
    rawPath = rawPath,
    query = query,
    headers = headers,
    body = "",
  }

  -- Check for body
  local contentLength = tonumber(headers["content-length"] or "0")
  if contentLength > 0 then
    -- Limit body size to 10MB
    if contentLength > 10 * 1024 * 1024 then
      sendResponse(c.sock, 413, {}, "Payload Too Large")
      self:_removeClient(id)
      return
    end
    c.bodyNeeded = contentLength
    c.state = "reading_body"
  else
    c.state = "ready"
  end
end

--- Read HTTP body from client.
function Server:_readBody(id, c)
  local remaining = c.bodyNeeded - #c.bodyBuffer
  if remaining <= 0 then
    c.request.body = c.bodyBuffer
    c.state = "ready"
    return
  end

  local data, err, partial = c.sock:receive(remaining)
  if data then
    c.bodyBuffer = c.bodyBuffer .. data
  elseif partial and #partial > 0 then
    c.bodyBuffer = c.bodyBuffer .. partial
  elseif err == "closed" then
    self:_removeClient(id)
    return
  end

  if #c.bodyBuffer >= c.bodyNeeded then
    c.request.body = c.bodyBuffer
    c.state = "ready"
  end
end

--- Dispatch a fully-parsed request to the appropriate handler.
function Server:_dispatch(id, c)
  local req = c.request
  local path = req.path

  -- Try static routes first (longest prefix match)
  local bestStatic = nil
  local bestStaticLen = 0
  for _, route in ipairs(self.routes) do
    if route.type == "static" then
      local rel = matchPrefix(route.path, path)
      if rel and #route.path > bestStaticLen then
        bestStatic = route
        bestStaticLen = #route.path
        req._staticRel = rel
      end
    end
  end

  if bestStatic then
    self:_serveStatic(id, c, bestStatic, req._staticRel)
    return
  end

  -- Try index routes (serve cached JSON directly from Lua)
  for _, route in ipairs(self.routes) do
    if route.type == "index" then
      local params = matchPath(route.path, path)
      if params then
        local indexJson = self._indexCache or '{"files":[],"stats":{},"directories":[]}'
        -- Apply query filters
        local typeFilter = req.query and req.query.type
        local dirFilter = req.query and req.query.dir
        local searchFilter = req.query and req.query.q
        if typeFilter or dirFilter or searchFilter then
          indexJson = self:_filteredIndex(typeFilter, dirFilter, searchFilter)
        end
        sendResponse(c.sock, 200, {
          ["Content-Type"] = "application/json; charset=utf-8",
          ["Access-Control-Allow-Origin"] = "*",
          ["Cache-Control"] = "no-cache",
        }, indexJson)
        self:_removeClient(id)
        return
      end
    end
  end

  -- Try dynamic handler routes
  for _, route in ipairs(self.routes) do
    if route.type == "handler" then
      -- Method filter (nil = any method)
      if not route.method or route.method == req.method then
        local params = matchPath(route.path, path)
        if params then
          -- Forward to React via bridge event
          c.state = "responding"
          self.events[#self.events + 1] = {
            type = "httpserver:request",
            serverId = self._serverId,
            clientId = id,
            method = req.method,
            path = path,
            rawPath = req.rawPath,
            query = req.query,
            headers = req.headers,
            body = req.body,
            params = params,
            route = route.path,
          }
          return
        end
      end
    end
  end

  -- No route matched
  send404(c.sock, path)
  self:_removeClient(id)
end

--- Serve a static file from the OS filesystem.
function Server:_serveStatic(id, c, route, relPath)
  relPath = sanitizePath(relPath)
  if not relPath then
    send403(c.sock)
    self:_removeClient(id)
    return
  end

  -- Build filesystem path
  local root = route.root
  if root:sub(-1) == "/" then root = root:sub(1, -2) end
  local fsPath = root .. relPath

  -- Try as file first
  local f = io.open(fsPath, "rb")
  if not f then
    -- Try as directory with index.html
    local dirIndex = io.open(fsPath .. "/index.html", "rb")
    if dirIndex then
      f = dirIndex
      fsPath = fsPath .. "/index.html"
    else
      send404(c.sock, relPath)
      self:_removeClient(id)
      return
    end
  end

  local content = f:read("*a")
  f:close()

  local mime = getMimeType(fsPath)
  sendResponse(c.sock, 200, {
    ["Content-Type"] = mime,
    ["Cache-Control"] = "public, max-age=3600",
    ["Access-Control-Allow-Origin"] = "*",
  }, content)
  self:_removeClient(id)
end

--- Store a library index on this server (called after indexing).
function Server:setIndex(index)
  self._index = index
  -- Pre-serialize the full index for fast serving
  local json = require("lib.json")
  self._indexCache = json.encode(index)
  io.write("[httpserver] Indexed " .. (index.stats and index.stats.total or 0) .. " files\n"); io.flush()
end

--- Build a filtered JSON response from the cached index.
function Server:_filteredIndex(typeFilter, dirFilter, searchFilter)
  if not self._index then return '{"files":[],"stats":{},"directories":[]}' end
  local json = require("lib.json")

  local filtered = {}
  for _, f in ipairs(self._index.files) do
    local pass = true
    if typeFilter and f.category ~= typeFilter then pass = false end
    if dirFilter and f.dir ~= dirFilter then pass = false end
    if searchFilter and pass then
      local q = searchFilter:lower()
      local name = (f.name or ""):lower()
      local rel = (f.relPath or ""):lower()
      if not name:find(q, 1, true) and not rel:find(q, 1, true) then
        pass = false
      end
    end
    if pass then filtered[#filtered + 1] = f end
  end

  return json.encode({
    files = filtered,
    stats = { total = #filtered },
    directories = self._index.directories,
    filter = { type = typeFilter, dir = dirFilter, q = searchFilter },
  })
end

--- Send a response for a dynamic route request (called from React side).
function Server:respond(clientId, status, headers, body)
  local c = self.clients[clientId]
  if not c then return false, "Client not found" end

  -- Add CORS header by default
  headers = headers or {}
  if not headers["Access-Control-Allow-Origin"] and not headers["access-control-allow-origin"] then
    headers["Access-Control-Allow-Origin"] = "*"
  end

  sendResponse(c.sock, status, headers, body)
  self:_removeClient(clientId)
  return true
end

--- Remove a client and close its socket.
function Server:_removeClient(id)
  local c = self.clients[id]
  if not c then return end
  pcall(function() c.sock:close() end)
  self.clients[id] = nil
end

--- Shut down the server.
function Server:close()
  for id in pairs(self.clients) do
    self:_removeClient(id)
  end
  pcall(function() self.socket:close() end)
  io.write("[httpserver] Closed " .. self.host .. ":" .. self.port .. "\n"); io.flush()
end

-- ============================================================================
-- Library indexing — walk directories, build searchable file catalog
-- ============================================================================

local MEDIA_CATEGORIES = {
  -- Audio
  mp3 = "audio", ogg = "audio", wav = "audio", flac = "audio", aac = "audio",
  m4a = "audio", opus = "audio", wma = "audio", aiff = "audio",
  -- Video
  mp4 = "video", webm = "video", mkv = "video", avi = "video", mov = "video",
  m4v = "video", wmv = "video", flv = "video",
  -- Image
  png = "image", jpg = "image", jpeg = "image", gif = "image", webp = "image",
  svg = "image", bmp = "image", ico = "image", tiff = "image", raw = "image",
  -- Document
  pdf = "document", txt = "document", md = "document", doc = "document",
  docx = "document", csv = "document", json = "document", xml = "document",
  html = "document", htm = "document",
}

local function categorizeFile(ext)
  if not ext then return "other" end
  return MEDIA_CATEGORIES[ext:lower()] or "other"
end

--- Walk a directory tree using `find` and return file entries.
--- Each entry: { name, path, relPath, size, modified, ext, category, dir }
local function indexDirectory(dirPath, dirName)
  -- Normalize
  if dirPath:sub(-1) == "/" then dirPath = dirPath:sub(1, -2) end
  dirName = dirName or dirPath:match("([^/]+)$") or "root"

  -- Use find with -printf for size, mtime, and relative path in one pass
  -- %s = size in bytes, %T@ = modification time as epoch, %P = relative path
  local cmd = string.format(
    "find %s -type f -printf '%%s\\t%%T@\\t%%P\\n' 2>/dev/null",
    dirPath:gsub("'", "'\\''")  -- escape single quotes in path
  )
  local pipe = io.popen(cmd)
  if not pipe then return {} end

  local files = {}
  for line in pipe:lines() do
    local size, mtime, relPath = line:match("^(%d+)\t([%d%.]+)\t(.+)$")
    if relPath then
      local name = relPath:match("([^/]+)$") or relPath
      local ext = name:match("%.([^%.]+)$")

      files[#files + 1] = {
        name = name,
        path = dirPath .. "/" .. relPath,
        relPath = relPath,
        size = tonumber(size) or 0,
        modified = math.floor(tonumber(mtime) or 0),
        ext = ext and ext:lower() or nil,
        category = categorizeFile(ext),
        dir = dirName,
      }
    end
  end
  pipe:close()

  return files
end

--- Index multiple directories. Returns the full catalog + per-directory stats.
local function indexDirectories(dirs)
  -- dirs = { { path = "/home/user/music", name = "music" }, ... }
  local allFiles = {}
  local stats = { total = 0, audio = 0, video = 0, image = 0, document = 0, other = 0 }
  local dirStats = {}

  for _, dir in ipairs(dirs) do
    local dirPath = dir.path
    local dirName = dir.name or dirPath:match("([^/]+)$") or "root"
    local files = indexDirectory(dirPath, dirName)

    local ds = { name = dirName, path = dirPath, count = #files, size = 0 }
    for _, f in ipairs(files) do
      allFiles[#allFiles + 1] = f
      stats.total = stats.total + 1
      stats[f.category] = (stats[f.category] or 0) + 1
      ds.size = ds.size + f.size
    end
    dirStats[#dirStats + 1] = ds
  end

  return {
    files = allFiles,
    stats = stats,
    directories = dirStats,
  }
end

-- ============================================================================
-- Module-level management (multiple servers)
-- ============================================================================

local _M = {}
local servers = {}  -- serverId -> Server instance

function _M.listen(serverId, port, host, routes)
  if servers[serverId] then
    servers[serverId]:close()
  end

  local server, err = Server.new(host or "0.0.0.0", port, routes)
  if not server then
    return { error = err }
  end

  server._serverId = serverId
  servers[serverId] = server
  return { serverId = serverId, port = port, host = server.host }
end

function _M.respond(serverId, clientId, status, headers, body)
  local server = servers[serverId]
  if not server then return false, "Server not found: " .. tostring(serverId) end
  return server:respond(clientId, status, headers, body)
end

function _M.close(serverId)
  local server = servers[serverId]
  if not server then return false end
  server:close()
  servers[serverId] = nil
  return true
end

--- Index directories and store the catalog on the server.
--- dirs: { { path = "/home/user/music", name = "music" }, ... }
--- Returns the full index (files, stats, directories).
function _M.index(serverId, dirs)
  local server = servers[serverId]
  if not server then return { error = "Server not found: " .. tostring(serverId) } end

  local index = indexDirectories(dirs)
  server:setIndex(index)
  return index
end

--- Update all servers and return pending events for the bridge.
function _M.pollAll()
  local allEvents = {}
  for _, server in pairs(servers) do
    local evts = server:update()
    for _, e in ipairs(evts) do
      allEvents[#allEvents + 1] = e
    end
  end
  return allEvents
end

--- RPC handler table (registered in init.lua).
function _M.getHandlers()
  return {
    ["httpserver:listen"] = function(args)
      return _M.listen(args.serverId, args.port, args.host, args.routes)
    end,
    ["httpserver:respond"] = function(args)
      return _M.respond(args.serverId, args.clientId, args.status, args.headers, args.body)
    end,
    ["httpserver:close"] = function(args)
      return _M.close(args.serverId)
    end,
    ["httpserver:index"] = function(args)
      return _M.index(args.serverId, args.dirs)
    end,
  }
end

return _M
