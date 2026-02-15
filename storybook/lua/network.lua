--[[
  network.lua — WebSocket network manager for iLoveReact

  Manages multiple WebSocket connections with auto-reconnect.
  Each connection is identified by an integer ID assigned at creation.

  .onion connections use non-blocking SOCKS5 tunneling so the UI
  stays responsive during Tor circuit establishment (10-30s).

  Usage (from init.lua):
    local network = require("lua.network")
    network.init()

    -- JS sends ws:connect command → network.connect(id, url)
    -- JS sends ws:send command    → network.send(id, data)
    -- JS sends ws:close command   → network.close(id)

    -- Each frame: network.poll() returns events
    -- Events: {type="ws:open", id=N}, {type="ws:message", id=N, data="..."}, etc.
]]

local websocket = require("lua.websocket")
local socks5 = require("lua.socks5")
local wsserver = require("lua.wsserver")

local Network = {}

local DEFAULT_PROXY_HOST = "127.0.0.1"

local connections = {}   -- id -> { ws, url, host, port, path, status, reconnect, backoff, nextRetry }
local tunnels = {}       -- id -> socks5 async tunnel (pending .onion connections)
local servers = {}       -- serverId -> wsserver instance
local events = {}        -- pending events to push to bridge
local initialized = false

local STATUS = websocket.STATUS

--- Parse a WebSocket URL into host, port, path
--- Supports ws://host:port/path and ws://host/path (default port 80)
local function parseWsUrl(url)
  -- Strip scheme
  local rest = url:match("^wss?://(.+)") or url
  -- Split path
  local hostport, path = rest:match("^([^/]+)(/.*)$")
  if not hostport then
    hostport = rest
    path = "/"
  end
  -- Split host:port
  local host, port = hostport:match("^(.+):(%d+)$")
  if not host then
    host = hostport
    port = 80
  else
    port = tonumber(port)
  end
  return host, port, path
end

--- Get the Tor SOCKS proxy port.
local function getTorProxyPort()
  local ok, torMod = pcall(require, "lua.tor")
  if ok and torMod.getProxyPort() then
    return torMod.getProxyPort()
  end
  return 9050
end

function Network.init()
  if initialized then return end
  initialized = true
  connections = {}
  tunnels = {}
  servers = {}
  events = {}
end

--- Wire WebSocket callbacks onto a connection.
--- @param id number  Connection ID
--- @param conn table  Connection record
--- @param ws wsclient  WebSocket client
local function wireCallbacks(id, conn, ws)
  function ws:onopen()
    conn.status = "open"
    conn.backoff = 1
    events[#events + 1] = { type = "ws:open", id = id }
  end

  function ws:onmessage(msg)
    events[#events + 1] = { type = "ws:message", id = id, data = msg }
  end

  function ws:onerror(err)
    events[#events + 1] = { type = "ws:error", id = id, error = tostring(err) }
  end

  function ws:onclose(code, reason)
    conn.status = "closed"
    events[#events + 1] = { type = "ws:close", id = id, code = code or 1005, reason = reason or "" }

    if conn.reconnect then
      conn.nextRetry = love.timer.getTime() + conn.backoff
      conn.backoff = math.min(conn.backoff * 2, conn.maxBackoff)
      conn.status = "reconnecting"
    end
  end
end

--- Start an async SOCKS5 tunnel for a .onion connection.
--- @param id number  Connection ID
--- @param conn table  Connection record
local function startTunnel(id, conn)
  local proxyPort = getTorProxyPort()
  local tunnel = socks5.connectAsync(DEFAULT_PROXY_HOST, proxyPort, conn.host, conn.port)
  tunnels[id] = tunnel
  conn.status = "tunneling"
end

--- Open a new WebSocket connection.
--- @param id number  Connection ID (assigned by JS polyfill)
--- @param url string  WebSocket URL (ws://host:port/path)
--- @param opts table|nil  Options: { reconnect = true|false }
function Network.connect(id, url, opts)
  opts = opts or {}
  local host, port, path = parseWsUrl(url)

  local conn = {
    ws = nil,
    url = url,
    host = host,
    port = port,
    path = path,
    status = "connecting",
    reconnect = opts.reconnect ~= false,
    backoff = 1,
    nextRetry = 0,
    maxBackoff = 30,
  }
  connections[id] = conn

  if host:match("%.onion$") then
    -- Non-blocking: start async SOCKS5 tunnel, poll each frame
    startTunnel(id, conn)
  else
    -- Direct connection (non-blocking via websocket.lua's TCPOPENING state)
    local ws = websocket.new(host, port, path)
    conn.ws = ws
    wireCallbacks(id, conn, ws)
  end
end

--- Send data on a connection.
--- @param id number  Connection ID
--- @param data string  Data to send (already a string — JS handles JSON.stringify)
function Network.send(id, data)
  local conn = connections[id]
  if not conn or not conn.ws then return end
  if conn.ws.status ~= STATUS.OPEN then return end
  conn.ws:send(data)
end

--- Close a connection (no auto-reconnect).
--- @param id number  Connection ID
--- @param code number|nil  Close code
--- @param reason string|nil  Close reason
function Network.close(id, code, reason)
  local conn = connections[id]
  if not conn then return end
  conn.reconnect = false

  -- Clean up pending tunnel if any
  if tunnels[id] then
    tunnels[id]:close()
    tunnels[id] = nil
  end

  if conn.ws and (conn.ws.status == STATUS.OPEN or conn.ws.status == STATUS.CONNECTING) then
    conn.ws:close(code, reason)
  end
  connections[id] = nil
end

--- Poll all connections for events (call once per frame).
--- Returns array of events to push to the bridge.
--- @return table[]
function Network.poll()
  if not initialized then return {} end

  local now = love.timer.getTime()

  -- 1. Advance pending SOCKS5 tunnels
  for id, tunnel in pairs(tunnels) do
    local result = tunnel:update()
    if result == "done" then
      -- Tunnel established — create WebSocket over the connected socket
      tunnels[id] = nil
      local conn = connections[id]
      if conn then
        local ws = websocket.new(conn.host, conn.port, conn.path, { socket = tunnel.socket })
        conn.ws = ws
        conn.status = "connecting"
        wireCallbacks(id, conn, ws)
      end
    elseif result == "error" then
      tunnels[id] = nil
      local conn = connections[id]
      if conn then
        events[#events + 1] = { type = "ws:error", id = id, error = tunnel.error or "SOCKS5 tunnel failed" }
        if conn.reconnect then
          conn.nextRetry = now + conn.backoff
          conn.backoff = math.min(conn.backoff * 2, conn.maxBackoff)
          conn.status = "reconnecting"
        else
          conn.status = "closed"
          events[#events + 1] = { type = "ws:close", id = id, code = 1006, reason = tunnel.error or "" }
        end
      end
    end
    -- "pending" — keep polling next frame
  end

  -- 2. Update active WebSocket connections
  for id, conn in pairs(connections) do
    if conn.ws and conn.ws.status ~= STATUS.CLOSED then
      local ok, err = pcall(function() conn.ws:update() end)
      if not ok then
        events[#events + 1] = { type = "ws:error", id = id, error = tostring(err) }
        conn.status = "closed"
        if conn.reconnect then
          conn.nextRetry = now + conn.backoff
          conn.backoff = math.min(conn.backoff * 2, conn.maxBackoff)
          conn.status = "reconnecting"
        end
      end
    end

    -- Handle reconnection
    if conn.status == "reconnecting" and now >= conn.nextRetry then
      if conn.host:match("%.onion$") then
        -- Non-blocking reconnect via async tunnel
        startTunnel(id, conn)
      else
        local ws = websocket.new(conn.host, conn.port, conn.path)
        conn.ws = ws
        conn.status = "connecting"
        wireCallbacks(id, conn, ws)
      end
    end
  end

  -- 3. Update all servers (accept connections, read frames)
  for _, server in pairs(servers) do
    pcall(function() server:update() end)
  end

  -- Drain event queue
  local result = events
  events = {}
  return result
end

--- Start a WebSocket server.
--- @param serverId string  Server identifier (from JS)
--- @param port number  Port to listen on
--- @param host string|nil  Bind address (default: 127.0.0.1)
function Network.listen(serverId, port, host)
  if servers[serverId] then
    events[#events + 1] = { type = "ws:server:error", serverId = serverId, error = "Server already running" }
    return
  end

  local server, err = wsserver.new(host or "127.0.0.1", port)
  if not server then
    events[#events + 1] = { type = "ws:server:error", serverId = serverId, error = err or "Failed to start server" }
    return
  end

  -- Wire callbacks to event queue
  function server:onconnect(clientId)
    events[#events + 1] = { type = "ws:peer:connect", serverId = serverId, clientId = clientId }
  end

  function server:onmessage(clientId, message)
    events[#events + 1] = { type = "ws:peer:message", serverId = serverId, clientId = clientId, data = message }
  end

  function server:ondisconnect(clientId, code, reason)
    events[#events + 1] = { type = "ws:peer:disconnect", serverId = serverId, clientId = clientId, code = code, reason = reason }
  end

  servers[serverId] = server
  events[#events + 1] = { type = "ws:server:ready", serverId = serverId, port = port }
end

--- Broadcast a message to all clients on a server.
--- @param serverId string
--- @param data string
function Network.broadcast(serverId, data)
  local server = servers[serverId]
  if not server then return end
  server:broadcast(data)
end

--- Send a message to a specific client on a server.
--- @param serverId string
--- @param clientId number
--- @param data string
function Network.sendToClient(serverId, clientId, data)
  local server = servers[serverId]
  if not server then return end
  server:send(clientId, data)
end

--- Stop a server.
--- @param serverId string
function Network.stopServer(serverId)
  local server = servers[serverId]
  if not server then return end
  server:close()
  servers[serverId] = nil
end

--- Shut down all connections and servers.
function Network.destroy()
  if not initialized then return end
  for id, tunnel in pairs(tunnels) do
    tunnel:close()
  end
  for id, conn in pairs(connections) do
    conn.reconnect = false
    if conn.ws and conn.ws.status == STATUS.OPEN then
      pcall(function() conn.ws:close() end)
    end
  end
  for serverId, server in pairs(servers) do
    pcall(function() server:close() end)
  end
  connections = {}
  tunnels = {}
  servers = {}
  events = {}
  initialized = false
end

return Network
