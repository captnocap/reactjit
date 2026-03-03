--[[
  panic_snapshot.lua — Subsystem diagnostics collector

  Collects counts from every subsystem in the ReactJIT pipeline.
  Called by the flush budget detector in bridge_quickjs.lua when command
  buffer growth indicates an infinite loop is underway, and by the
  crash recovery handler in init.lua for budget errors caught via pcall.

  Uses pcall(require, ...) for every module so it works even when some
  modules aren't loaded yet (early init) or aren't available on this
  target (e.g., videos on WASM).

  Output: a plain Lua table suitable for writing to disk as a Lua literal.
  The crash reporter reads this via load().
]]

local ffi = require("ffi")

local PanicSnapshot = {}

--- Read RSS from /proc/self/statm (Linux only). Returns KB or nil.
local function readRSS()
  if ffi.os ~= "Linux" then return nil end
  local f = io.open("/proc/self/statm", "r")
  if not f then return nil end
  local line = f:read("*l")
  f:close()
  if not line then return nil end
  local _, rss = line:match("(%d+)%s+(%d+)")
  if rss then return tonumber(rss) * 4 end -- pages to KB
  return nil
end

--- Read thread count from /proc/self/status (Linux only). Returns number or nil.
local function readThreadCount()
  if ffi.os ~= "Linux" then return nil end
  local f = io.open("/proc/self/status", "r")
  if not f then return nil end
  local threads = nil
  for line in f:lines() do
    local n = line:match("^Threads:%s+(%d+)")
    if n then threads = tonumber(n); break end
  end
  f:close()
  return threads
end

--- Count open file descriptors via /proc/self/fd (Linux only). Returns number or nil.
local function readFDCount()
  if ffi.os ~= "Linux" then return nil end
  -- Use ls + wc since we can't readdir from Lua without lfs
  local p = io.popen("ls /proc/self/fd 2>/dev/null | wc -l")
  if not p then return nil end
  local n = tonumber(p:read("*a"))
  p:close()
  return n
end

--- Collect a full subsystem snapshot. Returns a plain table.
function PanicSnapshot.collect()
  local snap = {
    timestamp = os.date("%Y-%m-%d %H:%M:%S"),
    luaMemKB  = math.floor(collectgarbage("count")),
    rssKB     = readRSS(),
    threads   = readThreadCount(),
    fds       = readFDCount(),
  }

  -- Tree: node count + handler count
  local treeOk, Tree = pcall(require, "lua.tree")
  if treeOk and Tree.getNodes then
    local nodes = Tree.getNodes()
    local nodeCount, handlerCount = 0, 0
    for _, node in pairs(nodes) do
      nodeCount = nodeCount + 1
      if node.hasHandlers then handlerCount = handlerCount + 1 end
    end
    snap.nodes = nodeCount
    snap.handlers = handlerCount
  end

  -- Images
  local imgOk, Images = pcall(require, "lua.images")
  if imgOk and Images.count then
    snap.images = Images.count()
  end

  -- Videos
  local vidOk, Videos = pcall(require, "lua.videos")
  if vidOk and Videos.count then
    snap.videos = Videos.count()
  end

  -- Scene3D
  local s3dOk, Scene3D = pcall(require, "lua.scene3d")
  if s3dOk and Scene3D.count then
    snap.scenes3d = Scene3D.count()
  end

  -- Animations/Transitions
  local animOk, Animate = pcall(require, "lua.animate")
  if animOk and Animate.activeCount then
    snap.animations = Animate.activeCount()
  end

  -- Capabilities
  local capOk, Caps = pcall(require, "lua.capabilities")
  if capOk and Caps.count then
    local types, insts = Caps.count()
    snap.capabilityTypes = types
    snap.capabilityInstances = insts
  end

  -- Windows
  local wmOk, WM = pcall(require, "lua.window_manager")
  if wmOk and WM.count then
    snap.windows = WM.count()
  end

  -- Hot state atoms
  local hsOk, HS = pcall(require, "lua.hotstate")
  if hsOk and HS.count then
    snap.hotstateAtoms = HS.count()
  end

  -- Error count
  local errOk, Errors = pcall(require, "lua.errors")
  if errOk and Errors.count then
    snap.errors = Errors.count()
  end

  -- Love2D graphics stats (canvases, texture memory, draw calls)
  if love and love.graphics and love.graphics.getStats then
    local ok, stats = pcall(love.graphics.getStats)
    if ok and stats then
      snap.drawCalls = stats.drawcalls
      snap.canvases = stats.canvases
      snap.textureMem = stats.texturememory and math.floor(stats.texturememory / 1024) or nil -- KB
      snap.fonts = stats.fonts
    end
  end

  return snap
end

--- Serialize a snapshot table as a Lua literal string.
--- Produces a `return { ... }` block that load() can evaluate.
function PanicSnapshot.serialize(snap)
  local lines = { "return {" }
  -- Sort keys for deterministic output
  local keys = {}
  for k in pairs(snap) do keys[#keys + 1] = k end
  table.sort(keys)
  for _, k in ipairs(keys) do
    local v = snap[k]
    if type(v) == "string" then
      lines[#lines + 1] = string.format("  %s = %q,", k, v)
    elseif type(v) == "number" then
      lines[#lines + 1] = string.format("  %s = %s,", k, tostring(v))
    elseif type(v) == "boolean" then
      lines[#lines + 1] = string.format("  %s = %s,", k, tostring(v))
    end
  end
  lines[#lines + 1] = "}"
  return table.concat(lines, "\n")
end

--- Write snapshot to disk at the standard path.
--- Returns the file path on success, nil on failure.
function PanicSnapshot.writeToDisk(snap)
  local path = (os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp") .. "/reactjit_snapshot.lua"
  local content = PanicSnapshot.serialize(snap)
  local f = io.open(path, "w")
  if not f then return nil end
  f:write(content)
  f:close()
  return path
end

return PanicSnapshot
