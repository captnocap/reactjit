--[[
  crashreport.lua — Spawn a separate crash report window.

  When a fatal error occurs (budget exceeded, unrecoverable crash),
  writes crash diagnostics to /tmp/reactjit_crash.json and spawns
  a standalone Love2D process to display it.

  The reporter is fully independent — it survives the main process dying.
]]

local CrashReport = {}

-- Cross-platform temp directory
local function getTmpDir()
  return os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"
end

CrashReport.CRASH_FILE = getTmpDir() .. "/reactjit_crash.lua"

--- Get RSS from /proc/self/statm (Linux only)
local function getRSSMB()
  local f = io.open("/proc/self/statm", "r")
  if not f then return nil end
  local line = f:read("*l")
  f:close()
  if not line then return nil end
  local _, rss = line:match("(%d+)%s+(%d+)")
  if rss then return tonumber(rss) * 4 / 1024 end
  return nil
end

--- Find the crashreport Love2D app directory
local function findReporterDir()
  local info = debug.getinfo(1, "S")
  if info and info.source and info.source:sub(1, 1) == "@" then
    local dir = info.source:sub(2):match("(.*/)") or ""
    local path = dir .. "crashreport"
    local check = io.open(path .. "/main.lua", "r")
    if check then check:close(); return path end
  end
  -- Fallback
  local candidates = {
    "lua/crashreport",
    love.filesystem.getSource() .. "/lua/crashreport",
  }
  for _, p in ipairs(candidates) do
    local check = io.open(p .. "/main.lua", "r")
    if check then check:close(); return p end
  end
  return nil
end

--- Spawn the crash reporter with the given error info.
--- @param err string The error message
--- @param context string Where the error occurred (e.g. "layout budget")
function CrashReport.spawn(err, context)
  -- Gather diagnostics
  local trail = ""
  local trailOk, trailMod = pcall(require, "lua.event_trail")
  if trailOk then
    trailMod.freeze()
    trail = trailMod.format() or ""
  end

  local crashData = {
    error = tostring(err),
    context = context or "unknown",
    trail = trail,
    timestamp = os.date("%Y-%m-%d %H:%M:%S"),
    luaMemMB = collectgarbage("count") / 1024,
    rssMB = getRSSMB(),
  }

  -- Write to temp file
  -- Write as Lua table literal — the crash reporter just load()s it
  local f = io.open(CrashReport.CRASH_FILE, "w")
  if f then
    f:write("return {\n")
    f:write(string.format("  error = %q,\n", crashData.error))
    f:write(string.format("  context = %q,\n", crashData.context))
    f:write(string.format("  trail = %q,\n", crashData.trail))
    f:write(string.format("  timestamp = %q,\n", crashData.timestamp))
    if crashData.luaMemMB then f:write(string.format("  luaMemMB = %.1f,\n", crashData.luaMemMB)) end
    if crashData.rssMB then f:write(string.format("  rssMB = %.1f,\n", crashData.rssMB)) end
    f:write("  hasLuaSnapshot = true,\n")
    f:write("}\n")
    f:close()
  end

  -- Find and spawn the reporter
  local reporterDir = findReporterDir()
  if reporterDir then
    os.execute(string.format("love %q &", reporterDir))
  else
    io.write("[CRASH] Could not find crashreport app\n"); io.flush()
  end
end

return CrashReport
