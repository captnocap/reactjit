--[[
  wsserver.lua — Non-blocking WebSocket server for Love2D

  Accepts multiple client connections, performs WebSocket handshakes,
  reads masked frames from clients, sends unmasked frames to clients.

  Uses love.data.hash("sha1") and love.data.encode("base64") for
  the Sec-WebSocket-Accept handshake computation.

  Usage:
    local wsserver = require("lua.wsserver")
    local server = wsserver.new("127.0.0.1", 8080)

    function server:onconnect(clientId) end
    function server:onmessage(clientId, msg) end
    function server:ondisconnect(clientId) end

    -- Each frame:
    server:update()
    server:broadcast("hello everyone")
    server:send(clientId, "hello you")

    -- Shutdown:
    server:close()
]]

local socket = require("socket")
local bit = require("bit")
local band, bor, bxor = bit.band, bit.bor, bit.bxor
local shl, shr = bit.lshift, bit.rshift

local MAGIC_GUID = "258EAFA5-E914-47DA-95CA-5AB515859764"

local OPCODE = {
  CONTINUE = 0,
  TEXT     = 1,
  BINARY   = 2,
  CLOSE    = 8,
  PING     = 9,
  PONG     = 10,
}

local _M = {}
_M.__index = _M

-- Default callbacks (override on instance)
function _M:onconnect(clientId) end
function _M:onmessage(clientId, message) end
function _M:ondisconnect(clientId) end

--- Compute Sec-WebSocket-Accept from client's Sec-WebSocket-Key.
local function computeAcceptKey(clientKey)
  local hash = love.data.hash("sha1", clientKey .. MAGIC_GUID)
  return love.data.encode("string", "base64", hash)
end

--- Send an unmasked WebSocket frame (server → client).
local function sendFrame(sock, opcode, message)
  -- FIN + opcode
  local ok, err = sock:send(string.char(bor(0x80, opcode)))
  if not ok then return nil, err end

  if not message or #message == 0 then
    return sock:send(string.char(0))
  end

  local length = #message
  if length > 65535 then
    sock:send(string.char(127,
      0, 0, 0, 0,
      band(shr(length, 24), 0xff),
      band(shr(length, 16), 0xff),
      band(shr(length, 8), 0xff),
      band(length, 0xff)))
  elseif length > 125 then
    sock:send(string.char(126,
      band(shr(length, 8), 0xff),
      band(length, 0xff)))
  else
    sock:send(string.char(length))
  end

  return sock:send(message)
end

--- Create a new WebSocket server.
--- @param host string  Bind address (e.g., "127.0.0.1")
--- @param port number  Listen port
--- @return table server
function _M.new(host, port)
  local serverSock = socket.tcp()
  serverSock:settimeout(0)
  serverSock:setoption("reuseaddr", true)

  local ok, err = serverSock:bind(host or "127.0.0.1", port)
  if not ok then
    return nil, "Failed to bind: " .. tostring(err)
  end

  serverSock:listen(16)

  local m = {
    socket = serverSock,
    host = host or "127.0.0.1",
    port = port,
    clients = {},       -- clientId -> { sock, state, buffer, ... }
    nextClientId = 1,
  }

  setmetatable(m, _M)
  io.write("[wsserver] Listening on " .. (host or "127.0.0.1") .. ":" .. port .. "\n"); io.flush()
  return m
end

--- Accept pending connections and process all clients.
--- Call once per frame.
function _M:update()
  -- Accept new TCP connections
  while true do
    local client, err = self.socket:accept()
    if not client then break end

    client:settimeout(0)
    local id = self.nextClientId
    self.nextClientId = id + 1

    self.clients[id] = {
      sock = client,
      state = "handshake",  -- "handshake" → "open" → "closed"
      buffer = "",
      frameBuffer = "",
      frameLength = 0,
      frameHead = nil,
      continue = "",
    }
  end

  -- Process each client
  for id, c in pairs(self.clients) do
    if c.state == "handshake" then
      self:_processHandshake(id, c)
    elseif c.state == "open" then
      self:_processFrames(id, c)
    end
  end
end

--- Process WebSocket handshake for a client.
function _M:_processHandshake(id, c)
  -- Drain all available lines from the socket
  while true do
    local data, err, partial = c.sock:receive("*l")
    if data then
      -- Full line received (LuaSocket strips the trailing \n)
      c.buffer = c.buffer .. data .. "\r\n"
      -- Empty line signals end of HTTP headers
      if data == "" or data == "\r" then break end
    elseif partial and #partial > 0 then
      -- Incomplete line — append what we have and wait for more
      c.buffer = c.buffer .. partial
      return
    else
      -- No data available
      if err == "closed" then
        self:_removeClient(id)
      end
      return
    end
  end

  -- Check if we have the full headers (double CRLF)
  if not (c.buffer:find("\r\n\r\n") or c.buffer:find("\n\n")) then
    return  -- Need more data
  end

  -- Extract Sec-WebSocket-Key
  local key = c.buffer:match("[Ss]ec%-[Ww]eb[Ss]ocket%-[Kk]ey:%s*([^\r\n]+)")
  if not key then
    -- Not a valid WebSocket upgrade request
    c.sock:send("HTTP/1.1 400 Bad Request\r\n\r\n")
    self:_removeClient(id)
    return
  end

  key = key:match("^%s*(.-)%s*$")  -- Trim

  -- Send upgrade response
  local acceptKey = computeAcceptKey(key)
  local response = "HTTP/1.1 101 Switching Protocols\r\n" ..
    "Upgrade: websocket\r\n" ..
    "Connection: Upgrade\r\n" ..
    "Sec-WebSocket-Accept: " .. acceptKey .. "\r\n\r\n"

  local ok, err = c.sock:send(response)
  if not ok then
    self:_removeClient(id)
    return
  end

  c.state = "open"
  c.buffer = ""
  c.frameBuffer = ""
  c.frameLength = 2  -- Start reading 2-byte frame header
  c.frameHead = nil

  self:onconnect(id)
end

--- Read and process WebSocket frames from a client.
--- Handles masked frames (client → server).
function _M:_processFrames(id, c)
  while true do
    -- Try to read remaining bytes for current frame
    local needed = c.frameLength - #c.frameBuffer
    if needed > 0 then
      local data, err, partial = c.sock:receive(needed)
      if err == "closed" then
        self:_removeClient(id, 1006, "connection lost")
        return
      end
      if data then
        c.frameBuffer = c.frameBuffer .. data
      elseif partial and #partial > 0 then
        c.frameBuffer = c.frameBuffer .. partial
      else
        return  -- No data available
      end
    end

    if #c.frameBuffer < c.frameLength then
      return  -- Still need more data
    end

    -- Parse frame header
    if not c.frameHead then
      if #c.frameBuffer < 2 then return end

      local b1, b2 = c.frameBuffer:byte(1, 2)
      c.frameHead = b1
      local masked = band(b2, 0x80) == 0x80
      local length = band(b2, 0x7f)

      if length == 126 then
        -- Need 2 more bytes for extended length
        if c.frameLength == 2 then
          c.frameLength = 4
          goto continue
        end
        if #c.frameBuffer < 4 then return end
        local b3, b4 = c.frameBuffer:byte(3, 4)
        length = shl(b3, 8) + b4
      elseif length == 127 then
        -- Need 8 more bytes for extended length
        if c.frameLength == 2 then
          c.frameLength = 10
          goto continue
        end
        if #c.frameBuffer < 10 then return end
        local b7, b8, b9, b10 = c.frameBuffer:byte(7, 10)
        length = shl(b7, 24) + shl(b8, 16) + shl(b9, 8) + b10
      end

      -- Calculate total frame size: header consumed + mask(4 if masked) + payload
      local headerSize = #c.frameBuffer  -- bytes consumed so far for header
      local totalNeeded = headerSize + (masked and 4 or 0) + length
      c.frameLength = totalNeeded
      c._masked = masked
      c._payloadLength = length
      c._headerSize = headerSize

      if #c.frameBuffer < totalNeeded then
        goto continue
      end
    end

    -- Full frame received — extract payload
    local payload
    local offset = c._headerSize + 1  -- 1-based index after header

    if c._masked then
      -- Read 4-byte mask key
      local m1, m2, m3, m4 = c.frameBuffer:byte(offset, offset + 3)
      local maskKey = { m1, m2, m3, m4 }
      offset = offset + 4

      -- Unmask payload
      local payloadBytes = { c.frameBuffer:byte(offset, offset + c._payloadLength - 1) }
      for i = 1, #payloadBytes do
        payloadBytes[i] = bxor(payloadBytes[i], maskKey[(i - 1) % 4 + 1])
      end
      payload = string.char(unpack(payloadBytes))
    else
      payload = c.frameBuffer:sub(offset, offset + c._payloadLength - 1)
    end

    -- Dispatch by opcode
    local opcode = band(c.frameHead, 0x0f)
    local fin = band(c.frameHead, 0x80) == 0x80

    if opcode == OPCODE.CLOSE then
      -- Send close frame back
      pcall(sendFrame, c.sock, OPCODE.CLOSE, nil)
      self:_removeClient(id, 1000, "")
      return
    elseif opcode == OPCODE.PING then
      sendFrame(c.sock, OPCODE.PONG, payload)
    elseif opcode == OPCODE.CONTINUE then
      c.continue = c.continue .. payload
      if fin then
        self:onmessage(id, c.continue)
        c.continue = ""
      end
    else
      if fin then
        self:onmessage(id, payload)
      else
        c.continue = payload
      end
    end

    -- Reset for next frame
    c.frameBuffer = ""
    c.frameLength = 2
    c.frameHead = nil
    c._masked = nil
    c._payloadLength = nil
    c._headerSize = nil

    ::continue::
  end
end

--- Remove a client and fire ondisconnect.
function _M:_removeClient(id, code, reason)
  local c = self.clients[id]
  if not c then return end

  pcall(function() c.sock:close() end)
  self.clients[id] = nil
  self:ondisconnect(id, code or 1005, reason or "")
end

--- Send a text message to a specific client.
--- @param clientId number
--- @param message string
function _M:send(clientId, message)
  local c = self.clients[clientId]
  if not c or c.state ~= "open" then return end

  local ok, err = sendFrame(c.sock, OPCODE.TEXT, message)
  if not ok then
    self:_removeClient(clientId, 1006, "send failed")
  end
end

--- Broadcast a text message to all connected clients.
--- @param message string
function _M:broadcast(message)
  for id, c in pairs(self.clients) do
    if c.state == "open" then
      local ok, err = sendFrame(c.sock, OPCODE.TEXT, message)
      if not ok then
        self:_removeClient(id, 1006, "send failed")
      end
    end
  end
end

--- Get the number of connected clients.
--- @return number
function _M:clientCount()
  local count = 0
  for _, c in pairs(self.clients) do
    if c.state == "open" then count = count + 1 end
  end
  return count
end

--- Get list of connected client IDs.
--- @return number[]
function _M:getClientIds()
  local ids = {}
  for id, c in pairs(self.clients) do
    if c.state == "open" then ids[#ids + 1] = id end
  end
  return ids
end

--- Shut down the server and disconnect all clients.
function _M:close()
  for id, c in pairs(self.clients) do
    pcall(sendFrame, c.sock, OPCODE.CLOSE, nil)
    pcall(function() c.sock:close() end)
  end
  self.clients = {}

  pcall(function() self.socket:close() end)
  io.write("[wsserver] Closed\n"); io.flush()
end

return _M
