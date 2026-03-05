--[[
  watchdog.lua — Memory spike watchdog (external process)

  Monitors the parent Love2D process via /proc/$PID/statm.
  If RSS grows by more than SPIKE_MB in a single sample window,
  the process is stuck in an allocation loop. Kill -9 immediately.

  Empirical data (from leak test):
    Normal operation: <1MB delta per 100ms sample
    Infinite loop:    70-100MB delta per 50ms sample
    Rate:             ~1.2 GB/sec once a loop starts

  Threshold of 50MB/sample has zero false positive risk.
  With 100ms sampling, kills within ~200ms of loop start (~200MB eaten).

  Launched from init.lua on startup. Runs as a detached background process
  so it survives even if the main Love2D thread is stuck in a tight loop.
  Linux only (/proc filesystem).
]]

local ffi = require("ffi")

-- Get PID reliably via C getpid() — no shell subprocess ambiguity
ffi.cdef[[
  int getpid(void);
]]

local Watchdog = {}

-- Config (can be overridden via Watchdog.launch(opts))
local DEFAULT_SPIKE_MB  = 50    -- kill threshold: MB growth in one sample
local DEFAULT_SAMPLE_MS = 100   -- poll interval
local DEFAULT_WARMUP_MS = 3000  -- ignore spikes during startup

function Watchdog.launch(opts)
  opts = opts or {}

  -- /proc is Linux-only
  if ffi.os ~= "Linux" then return false end

  -- Clean stale files from previous run
  local tmpDir = os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"
  os.remove(tmpDir .. "/reactjit_crash.lua")
  os.remove(tmpDir .. "/reactjit_snapshot.lua")
  os.remove(tmpDir .. "/reactjit_panic.signal")
  os.remove(tmpDir .. "/reactjit_crisis.lua")
  os.remove(tmpDir .. "/reactjit_clean_exit")

  -- Get our own PID via C call (not shell — shell gives the subprocess PID)
  local pid = tostring(ffi.C.getpid())

  -- Clean stale heartbeat from previous run
  os.remove(tmpDir .. "/reactjit_heartbeat_" .. pid)

  -- Find watchdog.sh relative to this module
  local scriptPath
  local info = debug.getinfo(1, "S")
  if info and info.source and info.source:sub(1, 1) == "@" then
    local dir = info.source:sub(2):match("(.*/)") or ""
    scriptPath = dir .. "watchdog.sh"
  end

  -- Verify the primary path works
  if scriptPath then
    local check = io.open(scriptPath, "r")
    if check then
      check:close()
    else
      scriptPath = nil
    end
  end

  -- Fallback paths
  if not scriptPath then
    local candidates = { "lua/watchdog.sh" }
    -- love.filesystem may not be available yet during early init
    if love and love.filesystem and love.filesystem.getSource then
      table.insert(candidates, love.filesystem.getSource() .. "/lua/watchdog.sh")
    end
    for _, p in ipairs(candidates) do
      local check = io.open(p, "r")
      if check then
        check:close()
        scriptPath = p
        break
      end
    end
  end

  if not scriptPath then
    io.write("[WATCHDOG] watchdog.sh not found, disabled\n"); io.flush()
    return false
  end

  local spike  = opts.spike_mb  or DEFAULT_SPIKE_MB
  local sample = opts.sample_ms or DEFAULT_SAMPLE_MS
  local warmup = opts.warmup_ms or DEFAULT_WARMUP_MS

  -- Launch as fully detached background process.
  -- nohup + & ensures it survives even if the main thread is stuck.
  -- stderr stays connected so kill messages appear in terminal/dv logs.
  local cmd = string.format(
    "nohup bash %q %s %d %d %d >/dev/null &",
    scriptPath, pid, spike, sample, warmup
  )

  -- os.execute returns differently in Lua 5.1 vs 5.3
  local ok = os.execute(cmd)

  io.write(string.format(
    "[WATCHDOG] PID %s | spike=%dMB sample=%dms warmup=%dms | script=%s | exec=%s\n",
    pid, spike, sample, warmup, scriptPath, tostring(ok)
  ))
  io.flush()

  return true
end

return Watchdog
