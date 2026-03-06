--[[
  stun.lua -- STUN client for NAT traversal (RFC 5389)

  Discovers the public IP:port mapping for a local UDP socket by querying
  a STUN server. Used by peer_tunnel.lua for UDP hole punching.

  Usage:
    local stun = require("lua.stun")
    local req = stun.query(udpSocket, "stun.l.google.com", 19302)
    -- each frame:
    local result = req:update()
    if result == "done" then
      print(req.publicIP, req.publicPort)
    elseif result == "error" then
      print(req.error)
    end

  Also supports blocking mode:
    local ip, port, err = stun.resolve(udpSocket, "stun.l.google.com", 19302)
]]

local socket = require("socket")
local bit = require("bit")

local STUN = {}

-- STUN message types
local BINDING_REQUEST  = 0x0001
local BINDING_RESPONSE = 0x0101
local MAGIC_COOKIE     = 0x2112A442

-- Attribute types
local ATTR_MAPPED_ADDRESS     = 0x0001
local ATTR_XOR_MAPPED_ADDRESS = 0x0020

-- Build a STUN Binding Request
local function buildRequest()
  local txn = {}
  for i = 1, 12 do
    txn[i] = string.char(math.random(0, 255))
  end
  local txnId = table.concat(txn)

  -- Header: type(2) + length(2) + magic(4) + txnId(12) = 20 bytes
  local header = string.char(
    bit.rshift(BINDING_REQUEST, 8), bit.band(BINDING_REQUEST, 0xFF),
    0, 0, -- length = 0 (no attributes)
    bit.rshift(MAGIC_COOKIE, 24),
    bit.band(bit.rshift(MAGIC_COOKIE, 16), 0xFF),
    bit.band(bit.rshift(MAGIC_COOKIE, 8), 0xFF),
    bit.band(MAGIC_COOKIE, 0xFF)
  ) .. txnId

  return header, txnId
end

-- Parse a STUN Binding Response, extract mapped address
local function parseResponse(data, txnId)
  if #data < 20 then return nil, "response too short" end

  local msgType = data:byte(1) * 256 + data:byte(2)
  if msgType ~= BINDING_RESPONSE then
    return nil, "not a binding response (type=" .. msgType .. ")"
  end

  local msgLen = data:byte(3) * 256 + data:byte(4)

  -- Verify magic cookie
  local cookie = data:byte(5) * 0x1000000 + data:byte(6) * 0x10000 +
                 data:byte(7) * 0x100 + data:byte(8)
  if cookie ~= MAGIC_COOKIE then
    return nil, "invalid magic cookie"
  end

  -- Verify transaction ID
  local respTxn = data:sub(9, 20)
  if respTxn ~= txnId then
    return nil, "transaction ID mismatch"
  end

  -- Parse attributes
  local pos = 21
  local ip, port

  while pos + 3 <= #data do
    local attrType = data:byte(pos) * 256 + data:byte(pos + 1)
    local attrLen  = data:byte(pos + 2) * 256 + data:byte(pos + 3)
    pos = pos + 4

    if pos + attrLen - 1 > #data then break end

    if attrType == ATTR_XOR_MAPPED_ADDRESS then
      local family = data:byte(pos + 1)
      if family == 0x01 then -- IPv4
        port = bit.bxor(data:byte(pos + 2) * 256 + data:byte(pos + 3),
                        bit.rshift(MAGIC_COOKIE, 16))
        local a = bit.bxor(data:byte(pos + 4), bit.rshift(MAGIC_COOKIE, 24))
        local b = bit.bxor(data:byte(pos + 5), bit.band(bit.rshift(MAGIC_COOKIE, 16), 0xFF))
        local c = bit.bxor(data:byte(pos + 6), bit.band(bit.rshift(MAGIC_COOKIE, 8), 0xFF))
        local d = bit.bxor(data:byte(pos + 7), bit.band(MAGIC_COOKIE, 0xFF))
        ip = a .. "." .. b .. "." .. c .. "." .. d
        return { ip = ip, port = port }
      end
    elseif attrType == ATTR_MAPPED_ADDRESS and not ip then
      local family = data:byte(pos + 1)
      if family == 0x01 then -- IPv4
        port = data:byte(pos + 2) * 256 + data:byte(pos + 3)
        ip = data:byte(pos + 4) .. "." .. data:byte(pos + 5) .. "."
           .. data:byte(pos + 6) .. "." .. data:byte(pos + 7)
        return { ip = ip, port = port }
      end
    end

    -- Advance to next attribute (padded to 4-byte boundary)
    pos = pos + attrLen
    if attrLen % 4 ~= 0 then
      pos = pos + (4 - attrLen % 4)
    end
  end

  return nil, "no mapped address in response"
end

-- ============================================================================
-- Non-blocking query (state machine)
-- ============================================================================

local Query = {}
Query.__index = Query

--- Start a non-blocking STUN query.
--- @param udpSock userdata  An already-bound UDP socket
--- @param stunHost string   STUN server hostname
--- @param stunPort number   STUN server port (default 3478)
--- @return Query
function STUN.query(udpSock, stunHost, stunPort)
  stunPort = stunPort or 3478

  local req, txnId = buildRequest()
  local q = {
    socket = udpSock,
    stunHost = stunHost,
    stunPort = stunPort,
    request = req,
    txnId = txnId,
    state = "resolving",
    publicIP = nil,
    publicPort = nil,
    error = nil,
    startTime = socket.gettime(),
    timeout = 5,
    retries = 0,
    maxRetries = 3,
    lastSend = 0,
    resolvedIP = nil,
  }
  setmetatable(q, Query)
  return q
end

function Query:update()
  local now = socket.gettime()

  if now - self.startTime > self.timeout then
    self.error = "STUN query timed out"
    return "error"
  end

  if self.state == "resolving" then
    -- Resolve STUN server hostname
    local ip, err = socket.dns.toip(self.stunHost)
    if ip then
      self.resolvedIP = ip
      self.state = "sending"
    elseif err then
      self.error = "DNS resolve failed: " .. tostring(err)
      return "error"
    end
    return "pending"

  elseif self.state == "sending" then
    self.socket:sendto(self.request, self.resolvedIP, self.stunPort)
    self.lastSend = now
    self.state = "receiving"
    return "pending"

  elseif self.state == "receiving" then
    local data, ip, port = self.socket:receivefrom()
    if data then
      local result, err = parseResponse(data, self.txnId)
      if result then
        self.publicIP = result.ip
        self.publicPort = result.port
        self.state = "done"
        return "done"
      end
      -- Bad response, keep waiting
    end

    -- Retry after 1 second
    if now - self.lastSend > 1 then
      self.retries = self.retries + 1
      if self.retries >= self.maxRetries then
        self.error = "STUN no response after " .. self.maxRetries .. " retries"
        return "error"
      end
      self.state = "sending"
    end

    return "pending"

  elseif self.state == "done" then
    return "done"
  end

  return "pending"
end

-- ============================================================================
-- Blocking resolve (convenience)
-- ============================================================================

--- Blocking STUN resolve. Returns ip, port or nil, nil, error.
--- @param udpSock userdata
--- @param stunHost string
--- @param stunPort number|nil
--- @return string|nil, number|nil, string|nil
function STUN.resolve(udpSock, stunHost, stunPort)
  stunPort = stunPort or 3478

  local ip = socket.dns.toip(stunHost)
  if not ip then return nil, nil, "DNS resolve failed for " .. stunHost end

  local req, txnId = buildRequest()

  local oldTimeout = udpSock:gettimeout()
  udpSock:settimeout(3)

  for attempt = 1, 3 do
    udpSock:sendto(req, ip, stunPort)
    local data = udpSock:receivefrom()
    if data then
      local result, err = parseResponse(data, txnId)
      if result then
        udpSock:settimeout(oldTimeout)
        return result.ip, result.port
      end
    end
  end

  udpSock:settimeout(oldTimeout)
  return nil, nil, "STUN no response from " .. stunHost
end

return STUN
