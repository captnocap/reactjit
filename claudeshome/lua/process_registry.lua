--[[
  process_registry.lua — Track spawned child processes for cleanup

  Every background process spawned by ReactJIT (Tor, child windows, devtools
  pop-outs, etc.) registers its PID here. On clean exit, ReactJIT.quit() calls
  killAll(). On crash, the watchdog reads the registry file and kills everything.

  The registry is a simple temp file: one PID per line.
  File path: /tmp/reactjit_children_<PARENT_PID>
]]

local ffi = require("ffi")

pcall(ffi.cdef, [[
  int getpid(void);
]])

local Registry = {}

local parentPid = tostring(ffi.C.getpid())
local tmpDir = os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"
local registryPath = tmpDir .. "/reactjit_children_" .. parentPid

--- Get the registry file path (used by watchdog.sh).
function Registry.getPath()
  return registryPath
end

--- Read all registered PIDs from the file.
local function readPids()
  local f = io.open(registryPath, "r")
  if not f then return {} end
  local pids = {}
  for line in f:lines() do
    local pid = line:match("^%s*(%d+)%s*$")
    if pid then pids[#pids + 1] = pid end
  end
  f:close()
  return pids
end

--- Write PID list back to file.
local function writePids(pids)
  local f = io.open(registryPath, "w")
  if not f then return end
  for _, pid in ipairs(pids) do
    f:write(pid .. "\n")
  end
  f:close()
end

--- Register a child PID for cleanup tracking.
function Registry.register(pid)
  if not pid then return end
  pid = tostring(pid):match("^%s*(.-)%s*$")
  if not pid or pid == "" then return end

  local pids = readPids()
  -- Avoid duplicates
  for _, p in ipairs(pids) do
    if p == pid then return end
  end
  pids[#pids + 1] = pid
  writePids(pids)

  io.write("[process_registry] registered PID " .. pid .. "\n"); io.flush()
end

--- Unregister a child PID (e.g. after clean shutdown of that child).
function Registry.unregister(pid)
  if not pid then return end
  pid = tostring(pid):match("^%s*(.-)%s*$")
  if not pid or pid == "" then return end

  local pids = readPids()
  local filtered = {}
  for _, p in ipairs(pids) do
    if p ~= pid then filtered[#filtered + 1] = p end
  end
  writePids(filtered)
end

--- Kill all registered child processes (SIGTERM, then SIGKILL stragglers).
--- Called from ReactJIT.quit() and by the watchdog on crash.
function Registry.killAll()
  local pids = readPids()
  if #pids == 0 then
    os.remove(registryPath)
    return
  end

  io.write("[process_registry] killing " .. #pids .. " child process(es)\n"); io.flush()

  -- SIGTERM first
  for _, pid in ipairs(pids) do
    os.execute("kill " .. pid .. " 2>/dev/null")
  end

  -- Brief pause, then SIGKILL any survivors
  local socket_ok, socket = pcall(require, "socket")
  if socket_ok then
    socket.sleep(0.2)
  else
    os.execute("sleep 0.2")
  end

  for _, pid in ipairs(pids) do
    os.execute("kill -9 " .. pid .. " 2>/dev/null")
  end

  os.remove(registryPath)
end

--- Clean up the registry file (call on clean exit after killAll).
function Registry.cleanup()
  os.remove(registryPath)
end

return Registry
