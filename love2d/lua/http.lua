--[[
  http.lua — Async HTTP client for the Love2D target

  Uses love.thread + LuaSocket for non-blocking HTTP requests.
  Local file paths are resolved synchronously via love.filesystem.

  Proxy support:
    Per-request:  fetch(url, { proxy: 'http://host:port' })
                  fetch(url, { proxy: 'socks5://host:port' })
                  fetch(url, { proxy: 'socks5://user:pass@host:port' })
    Environment:  HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY

  Streaming support:
    http.streamRequest(id, opts)  — same as request() but streams chunks
    Poll returns mixed messages:
      Regular:   { id, status, headers, body }
      Progress:  { id, type = "progress", bytes = N }  (during regular downloads)
      Chunk:     { id, type = "chunk", data = "..." }
      Done:      { id, type = "done", status = N, headers = {} }
      Error:     { id, type = "error", error = "..." }

  Usage (from init.lua):
    local http = require("lua.http")
    http.init()

    -- Start a request
    http.request(id, { url = "https://...", method = "GET", headers = {}, body = "", proxy = "" })

    -- Start a streaming request (SSE / chunked transfer)
    http.streamRequest(id, { url = "https://...", method = "POST", headers = {}, body = "" })

    -- Poll each frame (returns both regular responses and stream chunks)
    local responses = http.poll()
    for _, resp in ipairs(responses) do
      -- resp = { id, status, headers, body, error }       (regular)
      -- resp = { id, type = "chunk", data = "..." }       (stream chunk)
      -- resp = { id, type = "done", status = N, headers }  (stream end)
    end
]]

local Http = {}

local requestChannel = nil   -- main → worker
local responseChannel = nil  -- worker → main
local workers = {}           -- active love.thread instances
local maxWorkers = 4         -- concurrent request limit
local initialized = false

-- Thread worker source code (runs in a separate love.thread)
-- Uses LuaSocket's socket.http which is bundled with Love2D
local WORKER_CODE = [[
require("love.timer")
local requestChannel = love.thread.getChannel("http_requests")
local responseChannel = love.thread.getChannel("http_responses")

--- Establish a SOCKS5 connection and return a connected TCP socket.
--- Supports no-auth and username/password auth (RFC 1928 + RFC 1929).
local function socks5Connect(proxyHost, proxyPort, targetHost, targetPort, proxyUser, proxyPass)
  local socket = require("socket")
  local sock = socket.tcp()
  sock:settimeout(15)

  local ok, err = sock:connect(proxyHost, proxyPort)
  if not ok then return nil, "SOCKS5 connect to proxy failed: " .. tostring(err) end

  -- Greeting: offer no-auth (0x00) and user/pass (0x02) if credentials provided
  local authMethods
  if proxyUser and #proxyUser > 0 then
    authMethods = string.char(5, 2, 0, 2)  -- VER=5, 2 methods: no-auth + user/pass
  else
    authMethods = string.char(5, 1, 0)     -- VER=5, 1 method: no-auth
  end
  sock:send(authMethods)

  local resp, rerr = sock:receive(2)
  if not resp then sock:close(); return nil, "SOCKS5 greeting failed: " .. tostring(rerr) end

  local authMethod = resp:byte(2)
  if authMethod == 0xFF then
    sock:close(); return nil, "SOCKS5 proxy rejected all auth methods"
  end

  -- Username/password auth (RFC 1929)
  if authMethod == 0x02 then
    if not proxyUser then sock:close(); return nil, "SOCKS5 proxy requires auth but no credentials" end
    local authReq = string.char(1, #proxyUser) .. proxyUser .. string.char(#proxyPass) .. (proxyPass or "")
    sock:send(authReq)
    local authResp, aerr = sock:receive(2)
    if not authResp then sock:close(); return nil, "SOCKS5 auth failed: " .. tostring(aerr) end
    if authResp:byte(2) ~= 0 then sock:close(); return nil, "SOCKS5 auth rejected by proxy" end
  end

  -- CONNECT request
  local port1 = math.floor(targetPort / 256)
  local port2 = targetPort % 256
  local connectReq = string.char(5, 1, 0, 3, #targetHost) .. targetHost .. string.char(port1, port2)
  sock:send(connectReq)

  local connResp, cerr = sock:receive(4)
  if not connResp then sock:close(); return nil, "SOCKS5 connect failed: " .. tostring(cerr) end
  if connResp:byte(2) ~= 0 then
    local codes = {
      [1]="general failure", [2]="not allowed", [3]="network unreachable",
      [4]="host unreachable", [5]="connection refused", [6]="TTL expired",
      [7]="command not supported", [8]="address type not supported",
    }
    local code = connResp:byte(2)
    sock:close()
    return nil, "SOCKS5 error: " .. (codes[code] or ("code " .. code))
  end

  -- Consume the bound address (variable length)
  local addrType = connResp:byte(4)
  if addrType == 1 then      -- IPv4
    sock:receive(4 + 2)
  elseif addrType == 3 then  -- Domain
    local dlen = sock:receive(1)
    if dlen then sock:receive(dlen:byte(1) + 2) end
  elseif addrType == 4 then  -- IPv6
    sock:receive(16 + 2)
  end

  return sock
end

--- Resolve proxy for a request: per-request > env vars > nil
local function resolveProxy(reqProxy, url)
  -- Per-request proxy takes priority
  if reqProxy and #reqProxy > 0 then return reqProxy end

  -- Check NO_PROXY
  local noProxy = os.getenv("NO_PROXY") or os.getenv("no_proxy") or ""
  if #noProxy > 0 then
    local url_mod = require("socket.url")
    local parsed = url_mod.parse(url)
    local host = parsed and parsed.host or ""
    for pattern in noProxy:gmatch("[^,]+") do
      pattern = pattern:match("^%s*(.-)%s*$")  -- trim
      if pattern == "*" then return nil end
      -- Match exact or suffix (e.g. .example.com matches sub.example.com)
      if host == pattern or host:sub(-#pattern - 1) == "." .. pattern then
        return nil
      end
    end
  end

  -- Environment variables (check scheme-specific first, then ALL_PROXY)
  local isHttps = url:match("^https://")
  if isHttps then
    local p = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
    if p and #p > 0 then return p end
  else
    local p = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
    if p and #p > 0 then return p end
  end
  local allProxy = os.getenv("ALL_PROXY") or os.getenv("all_proxy")
  if allProxy and #allProxy > 0 then return allProxy end

  return nil
end

-- Worker loops until it gets a nil/stop signal
while true do
  -- Block until a request arrives
  local req = requestChannel:pop()
  if not req then
    -- Sleep briefly and retry (non-busy wait)
    love.timer.sleep(0.05)
  elseif req == "stop" then
    break
  else
    local id = req.id
    local url = req.url
    local method = (req.method or "GET"):upper()
    local headers = req.headers or {}
    local body = req.body
    local proxy = resolveProxy(req.proxy, url)

    local stream = req.stream

    -- Build proxy-aware request table (shared between regular and streaming)
    local function buildRequest(sinkFn)
      local http = require("socket.http")
      local ltn12 = require("ltn12")
      local url_mod = require("socket.url")

      local reqTable = {
        url = url,
        method = method,
        headers = headers,
        sink = sinkFn,
      }

      -- Add body for methods that support it
      if body and #body > 0 then
        reqTable.source = ltn12.source.string(body)
        reqTable.headers = reqTable.headers or {}
        reqTable.headers["content-length"] = tostring(#body)
        if not reqTable.headers["content-type"] then
          reqTable.headers["content-type"] = "application/json"
        end
      end

      -- Proxy handling
      if proxy then
        local proxyParsed = url_mod.parse(proxy)
        local proxyScheme = (proxyParsed.scheme or ""):lower()
        local proxyHost = proxyParsed.host or ""
        local proxyPort = tonumber(proxyParsed.port)
        local proxyUser = proxyParsed.user
        local proxyPass = proxyParsed.password

        if proxyScheme == "socks5" or proxyScheme == "socks5h" or proxyScheme == "socks" then
          proxyPort = proxyPort or 1080
          local targetParsed = url_mod.parse(url)
          local targetHost = targetParsed.host or ""
          local targetPort = tonumber(targetParsed.port) or (targetParsed.scheme == "https" and 443 or 80)

          local sock, serr = socks5Connect(proxyHost, proxyPort, targetHost, targetPort, proxyUser, proxyPass)
          if not sock then error(serr) end

          reqTable.create = function()
            return sock
          end
        else
          proxyPort = proxyPort or 8080
          reqTable.proxy = proxy
        end
      end

      return reqTable, http
    end

    if stream then
      -- ── Streaming mode ──────────────────────────────────────
      -- Use a custom ltn12 sink that pushes each chunk to the
      -- response channel as it arrives from the server.
      local ok2, err2 = pcall(function()
        local ltn12 = require("ltn12")

        -- Custom sink: push each chunk immediately
        local streamSink = function(chunk, sinkErr)
          if sinkErr then
            responseChannel:push({ id = id, type = "error", error = tostring(sinkErr) })
            return nil, sinkErr
          end
          if chunk and #chunk > 0 then
            responseChannel:push({ id = id, type = "chunk", data = chunk })
          end
          -- Return 1 to signal success (nil + empty string = end of data)
          if chunk == nil or chunk == "" then return nil end
          return 1
        end

        local reqTable, httpMod = buildRequest(streamSink)
        local _, status, respHeaders = httpMod.request(reqTable)

        -- Signal stream completion
        responseChannel:push({
          id = id,
          type = "done",
          status = status or 0,
          headers = respHeaders or {},
        })
      end)

      if not ok2 then
        responseChannel:push({
          id = id,
          type = "error",
          error = tostring(err2),
        })
      end
    else
      -- ── Regular mode (buffered with progress) ──────────────
      local ok2, result = pcall(function()
        local ltn12 = require("ltn12")
        local responseBody = {}
        local bytesReceived = 0
        local lastProgress = 0
        local PROGRESS_INTERVAL = 16384  -- report every 16KB

        -- Custom sink: accumulate body + push progress updates
        local progressSink = function(chunk, sinkErr)
          if sinkErr then return nil, sinkErr end
          if chunk == nil or chunk == "" then return nil end
          responseBody[#responseBody + 1] = chunk
          bytesReceived = bytesReceived + #chunk
          if bytesReceived - lastProgress >= PROGRESS_INTERVAL then
            lastProgress = bytesReceived
            responseChannel:push({
              id = id,
              type = "progress",
              bytes = bytesReceived,
            })
          end
          return 1
        end

        local reqTable, httpMod = buildRequest(progressSink)
        local _, status, respHeaders = httpMod.request(reqTable)

        return {
          id = id,
          status = status or 0,
          headers = respHeaders or {},
          body = table.concat(responseBody),
        }
      end)

      if ok2 then
        responseChannel:push(result)
      else
        responseChannel:push({
          id = id,
          status = 0,
          headers = {},
          body = "",
          error = tostring(result),
        })
      end
    end
  end
end
]]

function Http.init()
  if initialized then return end
  initialized = true

  requestChannel = love.thread.getChannel("http_requests")
  responseChannel = love.thread.getChannel("http_responses")

  -- Start worker threads
  for i = 1, maxWorkers do
    local thread = love.thread.newThread(WORKER_CODE)
    thread:start()
    workers[i] = thread
  end
end

--- Start an HTTP or local file request.
--- @param id string|number  Unique request ID (used to correlate response)
--- @param opts table  { url, method?, headers?, body? }
--- @return table|nil  For local files, returns the response immediately. Nil for async HTTP.
function Http.request(id, opts)
  local url = opts.url or ""

  -- Local file path: resolve synchronously
  if not url:match("^https?://") then
    if love.filesystem.getInfo and not love.filesystem.getInfo(url) then
      return { id = id, status = 404, headers = {}, body = "" }
    end
    local content = love.filesystem.read(url)
    if content then
      return {
        id = id,
        status = 200,
        headers = { ["content-type"] = "application/octet-stream" },
        body = content,
      }
    else
      return {
        id = id,
        status = 404,
        headers = {},
        body = "",
        error = "File not found: " .. url,
      }
    end
  end

  -- HTTP request: push to worker channel
  if not initialized then
    return {
      id = id,
      status = 0,
      headers = {},
      body = "",
      error = "HTTP module not initialized",
    }
  end

  requestChannel:push({
    id = id,
    url = url,
    method = opts.method or "GET",
    headers = opts.headers or {},
    body = opts.body or "",
    proxy = opts.proxy or "",
  })

  return nil  -- async, will arrive via poll()
end

--- Start a streaming HTTP request. Chunks arrive via poll() with type="chunk".
--- @param id string|number  Unique request ID
--- @param opts table  { url, method?, headers?, body?, proxy? }
function Http.streamRequest(id, opts)
  local url = opts.url or ""

  -- Streaming doesn't apply to local files — fall back to regular request
  if not url:match("^https?://") then
    return Http.request(id, opts)
  end

  if not initialized then
    return {
      id = id,
      type = "error",
      error = "HTTP module not initialized",
    }
  end

  requestChannel:push({
    id = id,
    url = url,
    method = opts.method or "POST",
    headers = opts.headers or {},
    body = opts.body or "",
    proxy = opts.proxy or "",
    stream = true,
  })

  return nil  -- async, chunks arrive via poll()
end

--- Poll for completed HTTP responses (non-blocking).
--- Call once per frame from the main thread.
--- @return table[]  Array of completed responses (may be empty)
function Http.poll()
  if not initialized then return {} end

  local responses = {}
  while true do
    local resp = responseChannel:pop()
    if not resp then break end
    responses[#responses + 1] = resp
  end

  -- Restart any dead worker threads
  for i = 1, maxWorkers do
    local thread = workers[i]
    if thread and not thread:isRunning() then
      local err = thread:getError()
      if err then
        print("[reactjit] HTTP worker " .. i .. " crashed: " .. tostring(err))
      end
      -- Restart
      local newThread = love.thread.newThread(WORKER_CODE)
      newThread:start()
      workers[i] = newThread
    end
  end

  return responses
end

--- Shut down all worker threads.
function Http.destroy()
  if not initialized then return end

  -- Signal workers to stop
  for _ = 1, maxWorkers do
    requestChannel:push("stop")
  end

  -- Wait for threads to finish (with timeout)
  for i = 1, maxWorkers do
    local thread = workers[i]
    if thread and thread:isRunning() then
      thread:wait()
    end
    workers[i] = nil
  end

  initialized = false
end

return Http
