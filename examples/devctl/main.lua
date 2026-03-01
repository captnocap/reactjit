local ProcessManager = require("lua.process_manager")
local json = require("lua.json")
local HEADLESS = os.getenv("DEVCTL_HEADLESS") ~= nil

-- ── PID file ─────────────────────────────────────────────────────────────────────

local PID_FILE    = os.getenv("HOME") .. "/.config/devctl/daemon.pid"
local CONFIG_FILE = os.getenv("HOME") .. "/.config/devctl/servers.json"
local CONTROL_PORT = 19876

local function writePid()
  os.execute('mkdir -p "' .. os.getenv("HOME") .. '/.config/devctl"')
  local f = io.open(PID_FILE, "w")
  if f then
    local pf = io.open("/proc/self/stat", "r")
    if pf then
      local pid = pf:read("*l"):match("^(%d+)")
      pf:close()
      if pid then f:write(pid) end
    end
    f:close()
  end
end

local function removePid()
  os.remove(PID_FILE)
end

-- ── Headless mode (daemon) ───────────────────────────────────────────────────────

if HEADLESS then
  local daemonOk = false

  function love.load()
    writePid()
    daemonOk = ProcessManager.init()
    if not daemonOk then
      io.write("[devctl] FATAL: control socket failed — another daemon is already running. Exiting.\n"); io.flush()
      removePid()
      love.event.quit(1)
      return
    end
    io.write("[devctl] daemon started (headless)\n"); io.flush()
  end

  function love.update(dt)
    if not daemonOk then return end
    ProcessManager.tick(dt)
  end

  function love.quit()
    if daemonOk then ProcessManager.shutdown() end
    removePid()
  end

  return
end

-- ── GUI mode ─────────────────────────────────────────────────────────────────────

local ReactJIT = require("lua.init")
local socketOk, socket = pcall(require, "socket")

local function shellQuote(str)
  return "'" .. tostring(str):gsub("'", "'\\''") .. "'"
end

local function commandSucceeded(cmd)
  local a, b, c = os.execute(cmd)
  if a == true then return true end
  if type(a) == "number" then return a == 0 end
  if b == "exit" then return c == 0 end
  return false
end

local function readDaemonPid()
  local f = io.open(PID_FILE, "r")
  if not f then return nil end
  local line = f:read("*l")
  f:close()
  local pid = tonumber(line or "")
  if not pid or pid <= 0 then return nil end
  return pid
end

local function daemonPidAlive()
  local pid = readDaemonPid()
  if not pid then return false end
  return commandSucceeded("kill -0 " .. tostring(pid) .. " >/dev/null 2>&1")
end

local function daemonReachable()
  if not socketOk or not socket then return false end
  local client = socket.tcp()
  if not client then return false end
  client:settimeout(0.2)
  local ok = client:connect("127.0.0.1", CONTROL_PORT)
  pcall(function() client:close() end)
  return ok == true or ok == 1
end

local function ensureDaemonRunning()
  if daemonReachable() then return true end
  local source = love.filesystem.getSource()
  os.execute("DEVCTL_HEADLESS=1 love " .. shellQuote(source) .. " >/dev/null 2>&1 &")
  if socketOk and socket and socket.sleep then
    for _ = 1, 40 do
      if daemonReachable() then return true end
      socket.sleep(0.1)
    end
  end
  return daemonReachable()
end

local function daemonStatus()
  local reachable = daemonReachable()
  local pid = readDaemonPid()
  return {
    running  = reachable,
    reachable = reachable,
    pid      = pid,
    pidAlive = daemonPidAlive(),
  }
end

local function startDaemonFromGui()
  local ok = ensureDaemonRunning()
  local status = daemonStatus()
  status.ok = ok and status.running
  return status
end

local function stopDaemonFromGui()
  local pid = readDaemonPid()
  if pid then
    commandSucceeded("kill " .. tostring(pid) .. " >/dev/null 2>&1")
  end
  if socketOk and socket and socket.sleep then
    for _ = 1, 40 do
      if not daemonReachable() then break end
      socket.sleep(0.1)
    end
  end
  local status = daemonStatus()
  status.ok = not status.running
  if status.running then status.error = "daemon did not stop" end
  return status
end

local function toggleDaemonFromGui()
  if daemonReachable() then return stopDaemonFromGui() end
  return startDaemonFromGui()
end

local function sendDaemonCommand(msg)
  if not socketOk or not socket then
    return { error = "luasocket unavailable" }
  end
  local client, err = socket.tcp()
  if not client then return { error = "socket init failed: " .. tostring(err) } end
  client:settimeout(1.5)
  local okConn, connErr = client:connect("127.0.0.1", CONTROL_PORT)
  if not okConn then
    pcall(function() client:close() end)
    return { error = "daemon unavailable: " .. tostring(connErr) }
  end
  local sent, sendErr = client:send(json.encode(msg or {}) .. "\n")
  if not sent then
    pcall(function() client:close() end)
    return { error = "send failed: " .. tostring(sendErr) }
  end
  local line, recvErr = client:receive("*l")
  pcall(function() client:close() end)
  if not line then return { error = "receive failed: " .. tostring(recvErr) } end
  local okDecode, decoded = pcall(json.decode, line)
  if not okDecode or not decoded then return { error = "invalid daemon response" } end
  return decoded
end

local function logProxyError(op, result)
  if result and result.error then
    io.write("[devctl] " .. op .. " error: " .. tostring(result.error) .. "\n"); io.flush()
  end
end

-- ── Read config directly (offline cache for GUI startup) ─────────────────────────

local function readConfigDirect()
  local f = io.open(CONFIG_FILE, "r")
  if not f then return {} end
  local content = f:read("*a")
  f:close()
  local ok, data = pcall(json.decode, content)
  if not ok or not data or not data.servers then return {} end
  local result = {}
  for _, s in ipairs(data.servers) do
    if s.name then
      result[#result + 1] = {
        name       = s.name,
        cwd        = s.cwd or ".",
        scripts    = s.scripts or {},
        status     = "unknown",
        port       = s.port,
        configPort = s.port,
        pid        = nil,
        uptime     = nil,
        exitCode   = nil,
        autostart  = s.autostart or false,
        pinned     = s.pinned or false,
        crashCount = 0,
      }
    end
  end
  table.sort(result, function(a, b) return a.name < b.name end)
  return result
end

-- ── love.load ────────────────────────────────────────────────────────────────────

function love.load()
  love.graphics.setBackgroundColor(0.03, 0.03, 0.05)
  ReactJIT.init({
    mode       = "native",
    bundlePath = "love/bundle.js",
    libpath    = "lib/libquickjs",
  })
  if not ensureDaemonRunning() then
    io.write("[devctl] warning: daemon not reachable; GUI will show proxy errors\n"); io.flush()
  end

  -- ── Cached server list (works offline, no daemon needed) ─────────────────────
  ReactJIT.rpc("pm:listCached", function()
    return readConfigDirect()
  end)

  -- ── Live server list ──────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:list", function()
    local result = sendDaemonCommand({ cmd = "list", actor = "gui" })
    logProxyError("pm:list", result)
    return (result and result.servers) or {}
  end)

  -- ── Process control ───────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:start", function(args)
    local result = sendDaemonCommand({
      cmd = "start", actor = "gui",
      name = args and args.name, script = args and args.script, command = args and args.command,
    })
    logProxyError("pm:start", result)
    return result
  end)

  ReactJIT.rpc("pm:stop", function(args)
    local result = sendDaemonCommand({ cmd = "stop", actor = "gui", name = args and args.name })
    logProxyError("pm:stop", result)
    return result
  end)

  ReactJIT.rpc("pm:restart", function(args)
    local result = sendDaemonCommand({ cmd = "restart", actor = "gui", name = args and args.name })
    logProxyError("pm:restart", result)
    return result
  end)

  ReactJIT.rpc("pm:rename", function(args)
    local result = sendDaemonCommand({
      cmd = "rename", actor = "gui",
      name = args and args.name, newName = args and args.newName,
    })
    logProxyError("pm:rename", result)
    return result
  end)

  ReactJIT.rpc("pm:pin", function(args)
    local result = sendDaemonCommand({ cmd = "pin", actor = "gui", name = args and args.name })
    logProxyError("pm:pin", result)
    return result
  end)

  ReactJIT.rpc("pm:unpin", function(args)
    local result = sendDaemonCommand({ cmd = "unpin", actor = "gui", name = args and args.name })
    logProxyError("pm:unpin", result)
    return result
  end)

  -- ── Logs ─────────────────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:logs", function(args)
    local result = sendDaemonCommand({
      cmd = "logs", name = args and args.name, lines = args and args.lines,
    })
    logProxyError("pm:logs", result)
    return result or { lines = {} }
  end)

  -- ── Audit log ─────────────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:auditLog", function(args)
    local result = sendDaemonCommand({ cmd = "auditLog", lines = args and args.lines })
    logProxyError("pm:auditLog", result)
    return result or { entries = {} }
  end)

  -- ── Registry ──────────────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:add", function(args)
    local result = sendDaemonCommand({
      cmd = "add", actor = "gui",
      name = args and args.name, cwd = args and args.cwd,
      scripts = args and args.scripts, port = args and args.port,
      env = args and args.env, autostart = args and args.autostart,
    })
    logProxyError("pm:add", result)
    return result
  end)

  ReactJIT.rpc("pm:remove", function(args)
    local result = sendDaemonCommand({ cmd = "remove", actor = "gui", name = args and args.name })
    logProxyError("pm:remove", result)
    return result
  end)

  ReactJIT.rpc("pm:ports", function()
    local result = sendDaemonCommand({ cmd = "ports" })
    logProxyError("pm:ports", result)
    return (result and result.ports) or {}
  end)

  ReactJIT.rpc("pm:save", function()
    local result = sendDaemonCommand({ cmd = "save" })
    logProxyError("pm:save", result)
    return result
  end)

  -- ── Reserved ports ───────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:getReservedPorts", function()
    local result = sendDaemonCommand({ cmd = "getReservedPorts" })
    logProxyError("pm:getReservedPorts", result)
    return result or { ports = {} }
  end)

  ReactJIT.rpc("pm:setReservedPorts", function(args)
    local result = sendDaemonCommand({ cmd = "setReservedPorts", ports = args and args.ports })
    logProxyError("pm:setReservedPorts", result)
    return result
  end)

  -- ── Daemon lifecycle ──────────────────────────────────────────────────────────
  ReactJIT.rpc("pm:daemonStatus", function()
    return daemonStatus()
  end)

  ReactJIT.rpc("pm:daemonStart", function()
    return startDaemonFromGui()
  end)

  ReactJIT.rpc("pm:daemonStop", function()
    return stopDaemonFromGui()
  end)

  ReactJIT.rpc("pm:daemonToggle", function()
    return toggleDaemonFromGui()
  end)

  -- ── Window focus (called by `dv focus` via daemon socket passthrough) ─────────
  ReactJIT.rpc("pm:focus", function()
    love.window.setVisible(true)
    love.window.requestAttention(true)
    return { ok = true }
  end)
end

function love.update(dt)
  ReactJIT.update(dt)
end

function love.draw()
  ReactJIT.draw()
end

function love.mousepressed(x, y, button)  ReactJIT.mousepressed(x, y, button) end
function love.mousereleased(x, y, button) ReactJIT.mousereleased(x, y, button) end
function love.mousemoved(x, y, dx, dy)    ReactJIT.mousemoved(x, y) end
function love.wheelmoved(x, y)            ReactJIT.wheelmoved(x, y) end
function love.resize(w, h)               ReactJIT.resize(w, h) end
function love.keypressed(key, sc, rep)   ReactJIT.keypressed(key, sc, rep) end
function love.keyreleased(key, sc)       ReactJIT.keyreleased(key, sc) end
function love.textinput(text)            ReactJIT.textinput(text) end

function love.quit()
  ReactJIT.quit()
end
