--[[
  game_server/rcon.lua — Non-blocking RCON client (Source RCON Protocol)

  Used by GoldSrc, Source, Source 2, and Minecraft servers.

  Protocol:
    Packet = size(4 LE) + id(4 LE) + type(4 LE) + body(NUL-terminated) + NUL pad
    size = len(id) + len(type) + len(body) + 1(NUL) + 1(pad) = body_len + 10

  Packet types:
    SERVERDATA_AUTH            = 3  (client -> server: authenticate)
    SERVERDATA_AUTH_RESPONSE   = 2  (server -> client: auth result, id=-1 = fail)
    SERVERDATA_EXECCOMMAND     = 2  (client -> server: run command)
    SERVERDATA_RESPONSE_VALUE  = 0  (server -> client: command response)

  All operations are non-blocking (settimeout(0)) for use in Love2D's main loop.
]]

local socket = require("socket")

local RCON = {}
RCON.__index = RCON

-- Packet types
local AUTH           = 3
local AUTH_RESPONSE  = 2
local EXEC_COMMAND   = 2
local RESPONSE_VALUE = 0

-- ── Byte packing helpers (little-endian) ────────────────────────────────────

local function packInt32LE(n)
  -- Handle negative numbers (like -1 for auth failure)
  if n < 0 then n = n + 0x100000000 end
  local b0 = n % 256; n = math.floor(n / 256)
  local b1 = n % 256; n = math.floor(n / 256)
  local b2 = n % 256; n = math.floor(n / 256)
  local b3 = n % 256
  return string.char(b0, b1, b2, b3)
end

local function unpackInt32LE(data, offset)
  offset = offset or 1
  if #data < offset + 3 then return nil end
  local b0, b1, b2, b3 = string.byte(data, offset, offset + 3)
  local n = b0 + b1 * 256 + b2 * 65536 + b3 * 16777216
  -- Sign extend
  if n >= 0x80000000 then n = n - 0x100000000 end
  return n
end

-- ── Packet construction / parsing ───────────────────────────────────────────

local function buildPacket(id, pktType, body)
  body = body or ""
  local size = #body + 10  -- id(4) + type(4) + body + NUL(1) + pad(1)
  return packInt32LE(size) .. packInt32LE(id) .. packInt32LE(pktType) .. body .. "\0\0"
end

local function parsePacket(data)
  if #data < 4 then return nil, nil, data end

  local size = unpackInt32LE(data, 1)
  if not size then return nil, nil, data end

  local totalLen = size + 4  -- size field itself is 4 bytes
  if #data < totalLen then return nil, nil, data end

  local id = unpackInt32LE(data, 5)
  local pktType = unpackInt32LE(data, 9)
  -- Body is between offset 13 and (totalLen - 2) to skip trailing NULs
  local bodyEnd = totalLen - 1  -- skip final NUL pad
  local body = ""
  if bodyEnd > 13 then
    body = data:sub(13, bodyEnd - 1)  -- strip body's NUL terminator
  end

  local remaining = data:sub(totalLen + 1)
  return { id = id, type = pktType, body = body }, nil, remaining
end

-- ── RCON client ─────────────────────────────────────────────────────────────

function RCON.new(host, port)
  local self = setmetatable({}, RCON)
  self.host = host or "127.0.0.1"
  self.port = port or 27015
  self.tcp = nil
  self.recvBuf = ""
  self.nextId = 1
  self.connected = false
  self.authenticated = false
  self.pendingAuth = false
  self.authId = nil
  self.callbacks = {}  -- id -> callback
  self.responses = {}  -- id -> response body
  return self
end

function RCON:connect()
  if self.connected then return true end

  self.tcp = socket.tcp()
  self.tcp:settimeout(2)  -- brief blocking timeout for connect only

  local ok, err = self.tcp:connect(self.host, self.port)
  if not ok then
    self.tcp:close()
    self.tcp = nil
    return nil, err
  end

  self.tcp:settimeout(0)  -- non-blocking from here on
  self.connected = true
  self.recvBuf = ""
  return true
end

function RCON:auth(password)
  if not self.connected then return nil, "not connected" end
  if self.authenticated then return true end

  local id = self.nextId
  self.nextId = self.nextId + 1
  self.authId = id
  self.pendingAuth = true

  local pkt = buildPacket(id, AUTH, password)
  local ok, err = self.tcp:send(pkt)
  if not ok then return nil, err end

  -- Brief blocking wait for auth response (servers respond fast)
  self.tcp:settimeout(3)
  self:poll()
  self.tcp:settimeout(0)

  if self.authenticated then
    return true
  else
    return nil, "auth failed or timed out"
  end
end

function RCON:command(cmd)
  if not self.connected then return nil, "not connected" end
  if not self.authenticated then return nil, "not authenticated" end

  local id = self.nextId
  self.nextId = self.nextId + 1

  local pkt = buildPacket(id, EXEC_COMMAND, cmd)
  local ok, err = self.tcp:send(pkt)
  if not ok then return nil, err end

  -- Brief blocking wait for response
  self.tcp:settimeout(2)
  self:poll()
  self.tcp:settimeout(0)

  local response = self.responses[id]
  self.responses[id] = nil
  return response
end

function RCON:poll()
  if not self.tcp then return end

  -- Read available data
  while true do
    local data, err, partial = self.tcp:receive(4096)
    local chunk = data or partial
    if chunk and #chunk > 0 then
      self.recvBuf = self.recvBuf .. chunk
    end
    if not data then break end
  end

  -- Parse complete packets
  while #self.recvBuf >= 12 do
    local pkt, err, remaining = parsePacket(self.recvBuf)
    if not pkt then break end
    self.recvBuf = remaining

    if self.pendingAuth and pkt.type == AUTH_RESPONSE then
      self.pendingAuth = false
      if pkt.id == -1 then
        self.authenticated = false
      else
        self.authenticated = true
      end
    elseif pkt.type == RESPONSE_VALUE then
      -- Accumulate multi-packet responses
      local existing = self.responses[pkt.id]
      if existing then
        self.responses[pkt.id] = existing .. pkt.body
      else
        self.responses[pkt.id] = pkt.body
      end
    end
  end
end

function RCON:close()
  if self.tcp then
    pcall(function() self.tcp:close() end)
    self.tcp = nil
  end
  self.connected = false
  self.authenticated = false
  self.pendingAuth = false
  self.recvBuf = ""
  self.responses = {}
end

return RCON
