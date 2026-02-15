--[[
  socks5.lua — SOCKS5 proxy client for iLoveReact

  Establishes a TCP tunnel through a SOCKS5 proxy.
  Supports no-auth and username/password auth (RFC 1928 + RFC 1929).

  Two modes:
    - connect()      — blocking, returns connected socket or nil+error
    - connectAsync() — non-blocking state machine, call :update() each frame

  Usage (blocking):
    local socks5 = require("lua.socks5")
    local sock, err = socks5.connect("127.0.0.1", 9050, "target.onion", 80)

  Usage (non-blocking):
    local tunnel = socks5.connectAsync("127.0.0.1", 9050, "target.onion", 80)
    -- each frame:
    local status = tunnel:update()
    if status == "done" then use tunnel.socket
    elseif status == "error" then handle tunnel.error
    else -- "pending", keep polling
    end
]]

local socket = require("socket")

-- ---- Blocking connect (unchanged) ----

local function socks5Connect(proxyHost, proxyPort, targetHost, targetPort, proxyUser, proxyPass)
  local sock = socket.tcp()
  sock:settimeout(60)

  local ok, err = sock:connect(proxyHost, proxyPort)
  if not ok then return nil, "SOCKS5 connect to proxy failed: " .. tostring(err) end

  local authMethods
  if proxyUser and #proxyUser > 0 then
    authMethods = string.char(5, 2, 0, 2)
  else
    authMethods = string.char(5, 1, 0)
  end
  sock:send(authMethods)

  local resp, rerr = sock:receive(2)
  if not resp then sock:close(); return nil, "SOCKS5 greeting failed: " .. tostring(rerr) end

  local authMethod = resp:byte(2)
  if authMethod == 0xFF then
    sock:close(); return nil, "SOCKS5 proxy rejected all auth methods"
  end

  if authMethod == 0x02 then
    if not proxyUser then sock:close(); return nil, "SOCKS5 proxy requires auth but no credentials" end
    local authReq = string.char(1, #proxyUser) .. proxyUser .. string.char(#proxyPass) .. (proxyPass or "")
    sock:send(authReq)
    local authResp, aerr = sock:receive(2)
    if not authResp then sock:close(); return nil, "SOCKS5 auth failed: " .. tostring(aerr) end
    if authResp:byte(2) ~= 0 then sock:close(); return nil, "SOCKS5 auth rejected by proxy" end
  end

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

  local addrType = connResp:byte(4)
  if addrType == 1 then
    sock:receive(4 + 2)
  elseif addrType == 3 then
    local dlen = sock:receive(1)
    if dlen then sock:receive(dlen:byte(1) + 2) end
  elseif addrType == 4 then
    sock:receive(16 + 2)
  end

  return sock
end

-- ---- Non-blocking async connect ----
-- Returns a state machine object. Call :update() each frame.
-- States: tcp_connect → greeting_send → greeting_recv → auth_send → auth_recv
--       → connect_send → connect_recv → addr_recv → done
-- Returns: "pending" | "done" | "error"
-- On "done": tunnel.socket is the connected socket
-- On "error": tunnel.error is the error message

local SOCKS5_ERRORS = {
  [1]="general failure", [2]="not allowed", [3]="network unreachable",
  [4]="host unreachable", [5]="connection refused", [6]="TTL expired",
  [7]="command not supported", [8]="address type not supported",
}

local Tunnel = {}
Tunnel.__index = Tunnel

local function asyncConnect(proxyHost, proxyPort, targetHost, targetPort, proxyUser, proxyPass)
  local sock = socket.tcp()
  sock:settimeout(0)  -- fully non-blocking
  sock:connect(proxyHost, proxyPort)  -- returns nil,"timeout" for async connect

  local t = {
    socket = sock,
    proxyHost = proxyHost,
    proxyPort = proxyPort,
    targetHost = targetHost,
    targetPort = targetPort,
    proxyUser = proxyUser,
    proxyPass = proxyPass,
    state = "tcp_connect",
    buffer = "",       -- accumulates partial receives
    needBytes = 0,     -- how many bytes we're waiting for
    error = nil,
    startTime = socket.gettime(),
    timeout = 60,      -- total timeout for entire handshake
  }
  setmetatable(t, Tunnel)
  return t
end

--- Try to receive exactly N bytes non-blocking.
--- Returns full data when ready, or nil if still waiting.
--- Sets self.error and returns false on connection error.
function Tunnel:_recv(n)
  local needed = n - #self.buffer
  if needed <= 0 then
    local data = self.buffer:sub(1, n)
    self.buffer = self.buffer:sub(n + 1)
    return data
  end

  local data, err, partial = self.socket:receive(needed)
  if data then
    self.buffer = self.buffer .. data
  elseif partial and #partial > 0 then
    self.buffer = self.buffer .. partial
  elseif err == "closed" then
    self.error = "SOCKS5 connection closed by proxy"
    return false
  end
  -- err == "timeout" is normal for non-blocking

  if #self.buffer >= n then
    local result = self.buffer:sub(1, n)
    self.buffer = self.buffer:sub(n + 1)
    return result
  end

  return nil  -- still waiting
end

--- Advance the state machine. Call once per frame.
--- @return string "pending" | "done" | "error"
function Tunnel:update()
  -- Check total timeout
  if socket.gettime() - self.startTime > self.timeout then
    self.error = "SOCKS5 connect timed out (" .. self.timeout .. "s)"
    self.socket:close()
    return "error"
  end

  local state = self.state

  if state == "tcp_connect" then
    -- Check if TCP connect to proxy completed
    local _, err = self.socket:connect(self.proxyHost, self.proxyPort)
    if err == "already connected" then
      -- Connected! Send SOCKS5 greeting
      local authMethods
      if self.proxyUser and #self.proxyUser > 0 then
        authMethods = string.char(5, 2, 0, 2)
      else
        authMethods = string.char(5, 1, 0)
      end
      self.socket:send(authMethods)
      self.state = "greeting_recv"
      self.buffer = ""
      return "pending"
    elseif err == "timeout" or err == "Operation already in progress" then
      return "pending"  -- still connecting
    else
      self.error = "SOCKS5 connect to proxy failed: " .. tostring(err)
      self.socket:close()
      return "error"
    end

  elseif state == "greeting_recv" then
    local data = self:_recv(2)
    if data == false then self.socket:close(); return "error" end
    if data == nil then return "pending" end

    local authMethod = data:byte(2)
    if authMethod == 0xFF then
      self.error = "SOCKS5 proxy rejected all auth methods"
      self.socket:close()
      return "error"
    end

    if authMethod == 0x02 then
      -- Need username/password auth
      if not self.proxyUser then
        self.error = "SOCKS5 proxy requires auth but no credentials"
        self.socket:close()
        return "error"
      end
      local authReq = string.char(1, #self.proxyUser) .. self.proxyUser
        .. string.char(#(self.proxyPass or "")) .. (self.proxyPass or "")
      self.socket:send(authReq)
      self.state = "auth_recv"
      self.buffer = ""
      return "pending"
    end

    -- No auth needed — send CONNECT
    self:_sendConnect()
    return "pending"

  elseif state == "auth_recv" then
    local data = self:_recv(2)
    if data == false then self.socket:close(); return "error" end
    if data == nil then return "pending" end

    if data:byte(2) ~= 0 then
      self.error = "SOCKS5 auth rejected by proxy"
      self.socket:close()
      return "error"
    end

    self:_sendConnect()
    return "pending"

  elseif state == "connect_recv" then
    -- Need 4 bytes: VER, REP, RSV, ATYP
    local data = self:_recv(4)
    if data == false then self.socket:close(); return "error" end
    if data == nil then return "pending" end

    local rep = data:byte(2)
    if rep ~= 0 then
      self.error = "SOCKS5 error: " .. (SOCKS5_ERRORS[rep] or ("code " .. rep))
      self.socket:close()
      return "error"
    end

    -- Determine how many bytes to consume for the bound address
    local addrType = data:byte(4)
    if addrType == 1 then
      self._addrBytes = 4 + 2  -- IPv4 + port
    elseif addrType == 4 then
      self._addrBytes = 16 + 2  -- IPv6 + port
    elseif addrType == 3 then
      self._addrBytes = nil  -- need to read length byte first
      self.state = "addr_len"
      self.buffer = ""
      return "pending"
    else
      -- Unknown addr type, try to skip 0 bytes
      self._addrBytes = 0
    end

    self.state = "addr_recv"
    self.buffer = ""
    return "pending"

  elseif state == "addr_len" then
    -- Read the 1-byte domain length for ATYP=3
    local data = self:_recv(1)
    if data == false then self.socket:close(); return "error" end
    if data == nil then return "pending" end

    self._addrBytes = data:byte(1) + 2  -- domain + port
    self.state = "addr_recv"
    self.buffer = ""
    return "pending"

  elseif state == "addr_recv" then
    if self._addrBytes > 0 then
      local data = self:_recv(self._addrBytes)
      if data == false then self.socket:close(); return "error" end
      if data == nil then return "pending" end
    end

    -- Tunnel established!
    self.state = "done"
    return "done"

  elseif state == "done" then
    return "done"
  end

  return "pending"
end

function Tunnel:_sendConnect()
  local port1 = math.floor(self.targetPort / 256)
  local port2 = self.targetPort % 256
  local req = string.char(5, 1, 0, 3, #self.targetHost)
    .. self.targetHost .. string.char(port1, port2)
  self.socket:send(req)
  self.state = "connect_recv"
  self.buffer = ""
end

function Tunnel:close()
  pcall(function() self.socket:close() end)
end

return {
  connect = socks5Connect,
  connectAsync = asyncConnect,
}
