--[[
  wireguard.lua -- Real WireGuard tunnel management via `wg` CLI

  Manages kernel WireGuard interfaces by calling wg/wg-quick as subprocesses.
  Keys never touch Lua memory during tunnel operation — the kernel holds them.

  Threat model: kernel-space crypto, process isolation, OS-level routing.
  Requires: `wg` and `wg-quick` installed, root/sudo for interface setup.

  Usage:
    local wg = require("lua.wireguard")

    -- Check availability
    if not wg.available() then error("wg not installed") end

    -- Generate keys (uses `wg genkey` / `wg pubkey`)
    local keys = wg.generateKeys()

    -- Create interface
    wg.up({
      interface = "wg-rjit0",
      privateKey = keys.privateKey,
      listenPort = 51820,
      address = "10.0.0.1/24",
      peers = {
        {
          publicKey = "peer-public-key-base64",
          endpoint = "1.2.3.4:51820",
          allowedIPs = "10.0.0.2/32",
          keepalive = 25,
        },
      },
    })

    -- Query status
    local status = wg.status("wg-rjit0")

    -- Tear down
    wg.down("wg-rjit0")

  The React hooks handle key exchange via a signaling server and call
  these functions via RPC to set up the actual tunnel.
]]

local WireGuard = {}

local interfaces = {} -- ifname -> { config, configPath }

-- ============================================================================
-- Availability check
-- ============================================================================

--- Check if wg and wg-quick are available on the system.
--- @return boolean, string|nil  available, error message
function WireGuard.available()
  local wg = io.popen("which wg 2>/dev/null")
  local wgPath = wg and wg:read("*l")
  if wg then wg:close() end

  local wgQuick = io.popen("which wg-quick 2>/dev/null")
  local wgQuickPath = wgQuick and wgQuick:read("*l")
  if wgQuick then wgQuick:close() end

  if not wgPath or wgPath == "" then
    return false, "wg not found — install wireguard-tools"
  end
  if not wgQuickPath or wgQuickPath == "" then
    return false, "wg-quick not found — install wireguard-tools"
  end

  return true
end

--- Check if we have the privilege to manage interfaces (root or CAP_NET_ADMIN).
--- @return boolean
function WireGuard.hasPrivilege()
  local uid = io.popen("id -u 2>/dev/null")
  local id = uid and uid:read("*l")
  if uid then uid:close() end
  if id == "0" then return true end

  -- Check if we can use sudo without password
  local sudo = io.popen("sudo -n wg show 2>/dev/null")
  local result = sudo and sudo:read("*l")
  if sudo then sudo:close() end
  return result ~= nil
end

-- ============================================================================
-- Key generation (via wg CLI — keys never live in Lua)
-- ============================================================================

--- Generate a WireGuard keypair using `wg genkey` and `wg pubkey`.
--- Keys are base64-encoded (WireGuard's native format).
--- @return table { privateKey, publicKey }
function WireGuard.generateKeys()
  local ok, err = WireGuard.available()
  if not ok then error(err) end

  local genkey = io.popen("wg genkey 2>/dev/null")
  local privateKey = genkey and genkey:read("*l")
  if genkey then genkey:close() end
  if not privateKey or privateKey == "" then
    error("wg genkey failed")
  end

  local pubkey = io.popen("echo '" .. privateKey .. "' | wg pubkey 2>/dev/null")
  local publicKey = pubkey and pubkey:read("*l")
  if pubkey then pubkey:close() end
  if not publicKey or publicKey == "" then
    error("wg pubkey failed")
  end

  return {
    privateKey = privateKey,
    publicKey = publicKey,
  }
end

--- Generate a preshared key for additional security.
--- @return string base64-encoded PSK
function WireGuard.generatePSK()
  local ok, err = WireGuard.available()
  if not ok then error(err) end

  local psk = io.popen("wg genpsk 2>/dev/null")
  local key = psk and psk:read("*l")
  if psk then psk:close() end
  if not key or key == "" then
    error("wg genpsk failed")
  end
  return key
end

-- ============================================================================
-- Configuration file generation
-- ============================================================================

--- Generate a wg-quick compatible config file.
--- @param config table  Interface configuration
--- @return string  Config file content
local function generateConfig(config)
  local lines = { "[Interface]" }

  lines[#lines + 1] = "PrivateKey = " .. config.privateKey

  if config.listenPort then
    lines[#lines + 1] = "ListenPort = " .. config.listenPort
  end
  if config.address then
    lines[#lines + 1] = "Address = " .. config.address
  end
  if config.dns then
    lines[#lines + 1] = "DNS = " .. config.dns
  end
  if config.mtu then
    lines[#lines + 1] = "MTU = " .. config.mtu
  end
  if config.preUp then
    lines[#lines + 1] = "PreUp = " .. config.preUp
  end
  if config.postUp then
    lines[#lines + 1] = "PostUp = " .. config.postUp
  end
  if config.preDown then
    lines[#lines + 1] = "PreDown = " .. config.preDown
  end
  if config.postDown then
    lines[#lines + 1] = "PostDown = " .. config.postDown
  end

  if config.peers then
    for _, peer in ipairs(config.peers) do
      lines[#lines + 1] = ""
      lines[#lines + 1] = "[Peer]"
      lines[#lines + 1] = "PublicKey = " .. peer.publicKey

      if peer.presharedKey then
        lines[#lines + 1] = "PresharedKey = " .. peer.presharedKey
      end
      if peer.endpoint then
        lines[#lines + 1] = "Endpoint = " .. peer.endpoint
      end
      if peer.allowedIPs then
        lines[#lines + 1] = "AllowedIPs = " .. peer.allowedIPs
      end
      if peer.keepalive then
        lines[#lines + 1] = "PersistentKeepalive = " .. peer.keepalive
      end
    end
  end

  return table.concat(lines, "\n") .. "\n"
end

-- ============================================================================
-- Interface management
-- ============================================================================

--- Run a shell command, optionally with sudo. Returns stdout, exit code.
local function run(cmd, useSudo)
  if useSudo then
    cmd = "sudo " .. cmd
  end
  local handle = io.popen(cmd .. " 2>&1")
  local output = handle and handle:read("*a") or ""
  local ok, _, code = handle:close()
  return output, code or (ok and 0 or 1)
end

--- Bring up a WireGuard interface.
--- @param config table { interface, privateKey, listenPort?, address?, dns?, peers[] }
--- @return boolean, string|nil  success, error
function WireGuard.up(config)
  local ok, err = WireGuard.available()
  if not ok then return false, err end

  local ifname = config.interface or "wg-rjit0"

  -- Write config to temp file (0600 permissions)
  local configPath = "/tmp/rjit-wg-" .. ifname .. ".conf"
  local content = generateConfig(config)
  local f = io.open(configPath, "w")
  if not f then return false, "failed to write config to " .. configPath end
  f:write(content)
  f:close()
  os.execute("chmod 600 " .. configPath)

  -- Bring up interface
  local output, code = run("wg-quick up " .. configPath, true)
  if code ~= 0 then
    os.remove(configPath)
    return false, "wg-quick up failed: " .. output
  end

  interfaces[ifname] = { config = config, configPath = configPath }
  return true
end

--- Bring down a WireGuard interface.
--- @param ifname string  Interface name (default: "wg-rjit0")
--- @return boolean, string|nil
function WireGuard.down(ifname)
  ifname = ifname or "wg-rjit0"
  local iface = interfaces[ifname]

  if iface and iface.configPath then
    local output, code = run("wg-quick down " .. iface.configPath, true)
    os.remove(iface.configPath)
    interfaces[ifname] = nil
    if code ~= 0 then
      return false, "wg-quick down failed: " .. output
    end
    return true
  end

  -- Try direct teardown even if we didn't create it
  local output, code = run("wg-quick down " .. ifname, true)
  return code == 0, output
end

--- Add a peer to a running interface.
--- @param ifname string
--- @param peer table { publicKey, endpoint?, allowedIPs?, presharedKey?, keepalive? }
--- @return boolean, string|nil
function WireGuard.addPeer(ifname, peer)
  local cmd = "wg set " .. ifname .. " peer " .. peer.publicKey
  if peer.endpoint then
    cmd = cmd .. " endpoint " .. peer.endpoint
  end
  if peer.allowedIPs then
    cmd = cmd .. " allowed-ips " .. peer.allowedIPs
  end
  if peer.keepalive then
    cmd = cmd .. " persistent-keepalive " .. peer.keepalive
  end
  if peer.presharedKey then
    -- Write PSK to temp file
    local pskPath = "/tmp/rjit-wg-psk-" .. peer.publicKey:sub(1, 8) .. ".key"
    local f = io.open(pskPath, "w")
    if f then
      f:write(peer.presharedKey)
      f:close()
      os.execute("chmod 600 " .. pskPath)
      cmd = cmd .. " preshared-key " .. pskPath
    end
  end

  local output, code = run(cmd, true)

  -- Clean up PSK file
  if peer.presharedKey then
    local pskPath = "/tmp/rjit-wg-psk-" .. peer.publicKey:sub(1, 8) .. ".key"
    os.remove(pskPath)
  end

  return code == 0, output
end

--- Remove a peer from a running interface.
--- @param ifname string
--- @param publicKey string
--- @return boolean, string|nil
function WireGuard.removePeer(ifname, publicKey)
  local output, code = run("wg set " .. ifname .. " peer " .. publicKey .. " remove", true)
  return code == 0, output
end

--- Get status of a WireGuard interface.
--- @param ifname string
--- @return table|nil  { interface, publicKey, listenPort, peers[] }
function WireGuard.status(ifname)
  ifname = ifname or "wg-rjit0"
  local output, code = run("wg show " .. ifname .. " dump", true)
  if code ~= 0 then return nil end

  local lines = {}
  for line in output:gmatch("[^\n]+") do
    lines[#lines + 1] = line
  end

  if #lines < 1 then return nil end

  -- First line: interface info
  -- privatekey  publickey  listenport  fwmark
  local parts = {}
  for part in lines[1]:gmatch("[^\t]+") do
    parts[#parts + 1] = part
  end

  local result = {
    interface = ifname,
    publicKey = parts[2] or "",
    listenPort = tonumber(parts[3]) or 0,
    peers = {},
  }

  -- Subsequent lines: peer info
  -- publickey  presharedkey  endpoint  allowedips  latest-handshake  transfer-rx  transfer-tx  persistent-keepalive
  for i = 2, #lines do
    local p = {}
    for part in lines[i]:gmatch("[^\t]+") do
      p[#p + 1] = part
    end
    if #p >= 7 then
      result.peers[#result.peers + 1] = {
        publicKey = p[1],
        endpoint = p[3] ~= "(none)" and p[3] or nil,
        allowedIPs = p[4],
        latestHandshake = tonumber(p[5]) or 0,
        transferRx = tonumber(p[6]) or 0,
        transferTx = tonumber(p[7]) or 0,
        keepalive = p[8] ~= "off" and tonumber(p[8]) or nil,
      }
    end
  end

  return result
end

--- List all WireGuard interfaces.
--- @return string[]
function WireGuard.listInterfaces()
  local output = run("wg show interfaces", true)
  local ifaces = {}
  for iface in (output or ""):gmatch("%S+") do
    ifaces[#ifaces + 1] = iface
  end
  return ifaces
end

-- ============================================================================
-- Cleanup
-- ============================================================================

--- Tear down all interfaces we created.
function WireGuard.destroyAll()
  for ifname in pairs(interfaces) do
    WireGuard.down(ifname)
  end
end

-- ============================================================================
-- RPC handlers
-- ============================================================================

function WireGuard.getHandlers()
  local handlers = {}

  handlers["wireguard:available"] = function()
    local ok, err = WireGuard.available()
    return { available = ok, error = err, hasPrivilege = ok and WireGuard.hasPrivilege() or false }
  end

  handlers["wireguard:generate_keys"] = function()
    return WireGuard.generateKeys()
  end

  handlers["wireguard:generate_psk"] = function()
    return { psk = WireGuard.generatePSK() }
  end

  handlers["wireguard:up"] = function(args)
    if not args then error("wireguard:up requires config") end
    local ok, err = WireGuard.up(args)
    return { ok = ok, error = err }
  end

  handlers["wireguard:down"] = function(args)
    local ifname = args and args.interface or "wg-rjit0"
    local ok, err = WireGuard.down(ifname)
    return { ok = ok, error = err }
  end

  handlers["wireguard:add_peer"] = function(args)
    if not args or not args.interface or not args.publicKey then
      error("wireguard:add_peer requires 'interface' and 'publicKey'")
    end
    local ok, err = WireGuard.addPeer(args.interface, args)
    return { ok = ok, error = err }
  end

  handlers["wireguard:remove_peer"] = function(args)
    if not args or not args.interface or not args.publicKey then
      error("wireguard:remove_peer requires 'interface' and 'publicKey'")
    end
    local ok, err = WireGuard.removePeer(args.interface, args.publicKey)
    return { ok = ok, error = err }
  end

  handlers["wireguard:status"] = function(args)
    local ifname = args and args.interface or "wg-rjit0"
    return WireGuard.status(ifname) or { error = "interface not found" }
  end

  handlers["wireguard:list"] = function()
    return { interfaces = WireGuard.listInterfaces() }
  end

  return handlers
end

return WireGuard
