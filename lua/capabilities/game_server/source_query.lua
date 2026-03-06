--[[
  game_server/source_query.lua — Non-blocking Source Query Protocol client (UDP)

  Queries game servers running GoldSrc, Source, or Source 2 engines.
  Same A2S protocol across all Valve generations.

  Query types:
    A2S_INFO    — server name, map, player count, game, version
    A2S_PLAYER  — per-player name, score, play time
    A2S_RULES   — server cvars / rules

  All operations non-blocking (settimeout(0)) for Love2D main loop.
]]

local socket = require("socket")

local SourceQuery = {}
SourceQuery.__index = SourceQuery

-- ── Constants ───────────────────────────────────────────────────────────────

local HEADER = "\xFF\xFF\xFF\xFF"

-- Request payloads
local A2S_INFO_REQ    = HEADER .. "TSource Engine Query\0"
local A2S_PLAYER_REQ  = HEADER .. "U"   -- + 4-byte challenge
local A2S_RULES_REQ   = HEADER .. "V"   -- + 4-byte challenge

-- Response type bytes
local S2A_INFO_RESPONSE   = 0x49  -- 'I'
local S2A_PLAYER_RESPONSE = 0x44  -- 'D'
local S2A_RULES_RESPONSE  = 0x45  -- 'E'
local S2A_CHALLENGE       = 0x41  -- 'A'

-- Old GoldSrc info response
local S2A_INFO_OLD = 0x6D  -- 'm'

-- ── Binary read helpers ─────────────────────────────────────────────────────

local function readByte(data, pos)
  if pos > #data then return 0, pos end
  return string.byte(data, pos), pos + 1
end

local function readShort(data, pos)
  if pos + 1 > #data then return 0, pos end
  local lo, hi = string.byte(data, pos, pos + 1)
  return lo + hi * 256, pos + 2
end

local function readLong(data, pos)
  if pos + 3 > #data then return 0, pos end
  local b0, b1, b2, b3 = string.byte(data, pos, pos + 3)
  return b0 + b1 * 256 + b2 * 65536 + b3 * 16777216, pos + 4
end

local function readSignedLong(data, pos)
  local n, npos = readLong(data, pos)
  if n >= 0x80000000 then n = n - 0x100000000 end
  return n, npos
end

local function readFloat(data, pos)
  if pos + 3 > #data then return 0, pos end
  -- IEEE 754 single precision, little-endian
  local b0, b1, b2, b3 = string.byte(data, pos, pos + 3)
  local sign = (b3 >= 128) and -1 or 1
  local exp = (b3 % 128) * 2 + math.floor(b2 / 128)
  local mantissa = (b2 % 128) * 65536 + b1 * 256 + b0
  if exp == 0 and mantissa == 0 then return 0, pos + 4 end
  if exp == 255 then return (mantissa == 0) and (sign * math.huge) or (0/0), pos + 4 end
  return sign * math.ldexp(1 + mantissa / 8388608, exp - 127), pos + 4
end

local function readString(data, pos)
  local nul = data:find("\0", pos, true)
  if not nul then return "", #data + 1 end
  return data:sub(pos, nul - 1), nul + 1
end

-- ── Response parsers ────────────────────────────────────────────────────────

local function parseInfoResponse(data)
  -- Skip 4-byte header + 1-byte type
  local pos = 6
  local info = {}

  local typeByte = string.byte(data, 5)

  if typeByte == S2A_INFO_OLD then
    -- GoldSrc old-style response
    info.address, pos = readString(data, pos)
    info.name, pos = readString(data, pos)
    info.map, pos = readString(data, pos)
    info.folder, pos = readString(data, pos)
    info.game, pos = readString(data, pos)
    info.players, pos = readByte(data, pos)
    info.maxPlayers, pos = readByte(data, pos)
    info.protocol, pos = readByte(data, pos)
    return info
  end

  -- Source / Source 2 response
  info.protocol, pos = readByte(data, pos)
  info.name, pos = readString(data, pos)
  info.map, pos = readString(data, pos)
  info.folder, pos = readString(data, pos)
  info.game, pos = readString(data, pos)
  info.steamAppId, pos = readShort(data, pos)
  info.players, pos = readByte(data, pos)
  info.maxPlayers, pos = readByte(data, pos)
  info.bots, pos = readByte(data, pos)
  info.serverType, pos = readByte(data, pos)    -- 'd' dedicated, 'l' listen, 'p' proxy
  info.environment, pos = readByte(data, pos)   -- 'l' linux, 'w' windows, 'm' mac
  info.visibility, pos = readByte(data, pos)    -- 0 public, 1 private
  info.vac, pos = readByte(data, pos)           -- 0 unsecured, 1 secured

  -- Version string
  info.version, pos = readString(data, pos)

  return info
end

local function parsePlayerResponse(data)
  -- Skip 4-byte header + 1-byte type
  local pos = 6
  local count
  count, pos = readByte(data, pos)

  local players = {}
  for i = 1, count do
    local player = {}
    player.id, pos = readByte(data, pos)        -- index
    player.name, pos = readString(data, pos)
    player.score, pos = readSignedLong(data, pos)
    player.duration, pos = readFloat(data, pos)  -- seconds
    players[#players + 1] = player
  end

  return players
end

local function parseRulesResponse(data)
  -- Skip 4-byte header + 1-byte type
  local pos = 6
  local count
  count, pos = readShort(data, pos)

  local rules = {}
  for i = 1, count do
    local name, value
    name, pos = readString(data, pos)
    value, pos = readString(data, pos)
    rules[name] = value
  end

  return rules
end

-- ── SourceQuery client ──────────────────────────────────────────────────────

function SourceQuery.new(host, port)
  local self = setmetatable({}, SourceQuery)
  self.host = host or "127.0.0.1"
  self.port = port or 27015
  self.udp = socket.udp()
  self.udp:settimeout(0)
  self.udp:setpeername(self.host, self.port)

  -- Cached results
  self._info = nil
  self._players = nil
  self._rules = nil

  -- Challenge tracking
  self._playerChallenge = nil
  self._rulesChallenge = nil
  self._pendingPlayerQuery = false
  self._pendingRulesQuery = false

  return self
end

function SourceQuery:queryInfo()
  self.udp:send(A2S_INFO_REQ)
end

function SourceQuery:queryPlayers(challenge)
  local ch = challenge or self._playerChallenge or "\xFF\xFF\xFF\xFF"
  self.udp:send(A2S_PLAYER_REQ .. ch)
  self._pendingPlayerQuery = true
end

function SourceQuery:queryRules(challenge)
  local ch = challenge or self._rulesChallenge or "\xFF\xFF\xFF\xFF"
  self.udp:send(A2S_RULES_REQ .. ch)
  self._pendingRulesQuery = true
end

function SourceQuery:poll()
  -- Read all available UDP responses
  for _ = 1, 10 do
    local data, err = self.udp:receive()
    if not data then break end
    if #data < 5 then break end  -- too short

    -- Check header
    if data:sub(1, 4) ~= HEADER then break end

    local typeByte = string.byte(data, 5)

    if typeByte == S2A_INFO_RESPONSE or typeByte == S2A_INFO_OLD then
      local ok, info = pcall(parseInfoResponse, data)
      if ok then self._info = info end

    elseif typeByte == S2A_PLAYER_RESPONSE then
      local ok, players = pcall(parsePlayerResponse, data)
      if ok then self._players = players end
      self._pendingPlayerQuery = false

    elseif typeByte == S2A_RULES_RESPONSE then
      local ok, rules = pcall(parseRulesResponse, data)
      if ok then self._rules = rules end
      self._pendingRulesQuery = false

    elseif typeByte == S2A_CHALLENGE then
      -- Challenge response — extract the 4-byte challenge number
      local challenge = data:sub(6, 9)
      if #challenge == 4 then
        if self._pendingPlayerQuery then
          self._playerChallenge = challenge
          self:queryPlayers(challenge)
        end
        if self._pendingRulesQuery then
          self._rulesChallenge = challenge
          self:queryRules(challenge)
        end
      end
    end
  end
end

function SourceQuery:getInfo()
  return self._info
end

function SourceQuery:getPlayers()
  return self._players
end

function SourceQuery:getRules()
  return self._rules
end

function SourceQuery:close()
  if self.udp then
    pcall(function() self.udp:close() end)
    self.udp = nil
  end
end

return SourceQuery
