--[[
  tor.lua — Tor subprocess manager for iLoveReact

  Manages a Tor hidden service as a background subprocess.
  Developers opt-in via config.tor in ReactLove.init().

  Automatically finds an open SOCKS port if the default (9050) is in use,
  so it coexists with any existing Tor instance on the system.

  Features:
    - Auto-start Tor with generated torrc
    - Hidden service creation (generates .onion address)
    - Hostname polling (Tor takes 5-30s to bootstrap)
    - Graceful shutdown via SIGTERM
    - Bundled binary or system Tor fallback

  Usage:
    local tor = require("lua.tor")
    tor.start({ hsPort = 8080 })

    -- Poll each frame until ready:
    local hostname = tor.getHostname()
    if hostname then print(hostname) end

    -- On quit:
    tor.stop()
]]

local socket = require("socket")

local Tor = {}

local torPid = nil
local socksPort = nil
local hsDir = nil
local configDir = nil
local hostname = nil

--- Check if a file exists on the host filesystem.
local function fileExists(path)
  local f = io.open(path, "r")
  if f then f:close(); return true end
  return false
end

--- Check if a TCP port is available.
local function isPortFree(port)
  local sock = socket.tcp()
  sock:settimeout(0.1)
  local ok, err = sock:connect("127.0.0.1", port)
  sock:close()
  -- If connect succeeds, something is already listening → port is taken
  if ok then return false end
  -- If refused, nothing is listening → port is free
  -- If timeout, could go either way, treat as free
  return true
end

--- Find an open port starting from `start`.
local function findOpenPort(start)
  for p = start, start + 100 do
    if isPortFree(p) then
      return p
    end
  end
  return nil
end

--- Find the Tor binary (bundled or system).
local function findTorBinary()
  -- Dist build: binary extracted alongside the app
  local exeDir = love.filesystem.getSourceBaseDirectory()
  local bundled = exeDir .. "/bin/tor"
  if fileExists(bundled) then return bundled end

  -- Dev mode: check local bin/
  if fileExists("./bin/tor") then return "./bin/tor" end

  -- System Tor (must be in PATH)
  return "tor"
end

--- Start Tor subprocess with hidden service config.
--- @param opts table|nil  Options: { hsPort = 8080 }
--- @return boolean ok
--- @return string|nil error
function Tor.start(opts)
  opts = opts or {}
  local hsPort = opts.hsPort or 8080

  -- Find an open SOCKS port (skip 9050 if already taken by system Tor)
  socksPort = findOpenPort(9050)
  if not socksPort then
    return false, "Could not find an open port for Tor SOCKS proxy (tried 9050-9150)"
  end

  -- Create config directory on host filesystem
  configDir = os.getenv("HOME") .. "/.cache/ilovereact-tor"
  os.execute("mkdir -p " .. configDir)

  hsDir = configDir .. "/hs"
  os.execute("mkdir -p " .. hsDir)
  os.execute("chmod 700 " .. hsDir)  -- Tor requires restrictive permissions

  local dataDir = configDir .. "/data"
  os.execute("mkdir -p " .. dataDir)

  -- Write torrc
  local torrcPath = configDir .. "/torrc"
  local f = io.open(torrcPath, "w")
  if not f then return false, "Failed to write torrc at " .. torrcPath end

  f:write("SocksPort " .. socksPort .. "\n")
  f:write("HiddenServiceDir " .. hsDir .. "\n")
  f:write("HiddenServicePort " .. hsPort .. " 127.0.0.1:" .. hsPort .. "\n")
  f:write("DataDirectory " .. dataDir .. "\n")
  f:close()

  -- Find Tor binary
  local torBin = findTorBinary()

  -- Launch Tor as background process, write PID to file
  local pidFile = configDir .. "/tor.pid"
  local logFile = configDir .. "/tor.log"
  local cmd = torBin .. " -f " .. torrcPath
    .. " > " .. logFile .. " 2>&1 & echo $! > " .. pidFile

  local result = os.execute(cmd)
  if not result then
    return false, "Failed to execute Tor command: " .. cmd
  end

  -- Give the process a moment to write the PID file
  socket.sleep(0.1)

  -- Read PID for cleanup
  local pf = io.open(pidFile, "r")
  if pf then
    torPid = pf:read("*l")
    pf:close()
  end

  io.write("[tor] Started Tor on SOCKS port " .. socksPort .. " (PID: " .. (torPid or "unknown") .. ")\n"); io.flush()
  io.write("[tor] Log: " .. logFile .. "\n"); io.flush()

  return true
end

--- Check if our Tor SOCKS proxy is reachable.
--- @return boolean
function Tor.isRunning()
  if not socksPort then return false end
  local sock = socket.tcp()
  sock:settimeout(1)
  local ok = sock:connect("127.0.0.1", socksPort)
  sock:close()
  return ok ~= nil
end

--- Read hidden service hostname (call each frame until it returns).
--- Tor takes 5-30s to bootstrap and generate the .onion address.
--- @return string|nil hostname  The .onion address
--- @return string|nil error
function Tor.getHostname()
  if hostname then return hostname end
  if not hsDir then return nil, "Tor not started" end

  local hostnameFile = hsDir .. "/hostname"
  local f = io.open(hostnameFile, "r")
  if not f then return nil, "Tor still bootstrapping" end

  local raw = f:read("*a")
  f:close()

  if not raw or #raw == 0 then
    return nil, "Hostname file empty"
  end

  hostname = raw:match("^%s*(.-)%s*$")  -- Trim whitespace
  return hostname
end

--- Get the SOCKS proxy port this instance is using.
--- @return number|nil
function Tor.getProxyPort()
  return socksPort
end

--- Stop Tor subprocess via SIGTERM.
function Tor.stop()
  if not torPid then return end

  io.write("[tor] Stopping Tor (PID: " .. torPid .. ")...\n"); io.flush()
  os.execute("kill " .. torPid .. " 2>/dev/null")
  torPid = nil
  hostname = nil
  socksPort = nil
end

--- Check if Tor was started by this module.
--- @return boolean
function Tor.isManaged()
  return torPid ~= nil
end

return Tor
