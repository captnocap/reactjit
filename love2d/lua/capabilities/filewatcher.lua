--[[
  FileWatcher capability — poll-based filesystem change detection.

  Watches a single file or directory (optionally recursive) for changes.
  Fires onChange events with { changeType, path, size, mtime } payloads.

  Uses `find` + `stat` via io.popen for scanning. One subprocess per poll
  interval (default 1s), not per frame. Efficient for dev tools and
  config-reload workflows.

  Usage from React:
    <FileWatcher path="/home/user/project/src" recursive onChange={(e) => {
      console.log(e.changeType, e.path)  -- "modified" "/home/user/project/src/app.lua"
    }} />

    <FileWatcher path="/etc/myapp.conf" interval={5000} onChange={handleConfigChange} />
]]

local Capabilities = require("lua.capabilities")

-- ── Filesystem helpers ───────────────────────────────────────────────

--- Shell-safe single-quote escaping.
local function sq(s)
  return "'" .. s:gsub("'", "'\\''") .. "'"
end

--- Stat a single file. Returns { mtime, size } or nil.
local function statFile(path)
  local p = io.popen("stat -c '%Y %s' " .. sq(path) .. " 2>/dev/null")
  if not p then return nil end
  local line = p:read("*l")
  p:close()
  if not line then return nil end
  local mtime, size = line:match("^(%d+) (%d+)$")
  if not mtime then return nil end
  return { mtime = tonumber(mtime), size = tonumber(size) }
end

--- Check whether a path is a directory.
local function isDir(path)
  local p = io.popen("test -d " .. sq(path) .. " && echo y 2>/dev/null")
  if not p then return false end
  local r = p:read("*l")
  p:close()
  return r == "y"
end

--- Scan a directory. Returns { [filepath] = { mtime, size } }.
--- Uses find -L (follows symlinks) + batched stat for efficiency.
local function scanDir(path, recursive, pattern, exclude)
  local depth = recursive and "" or "-maxdepth 1 "
  local nameFilter = pattern and ("-name " .. sq(pattern) .. " ") or ""
  -- Build exclusion prune clauses (skips entire subtrees, not just individual files)
  local prune = ""
  if exclude then
    local parts = {}
    for _, dir in ipairs(exclude) do
      parts[#parts + 1] = "-name " .. sq(dir) .. " -prune"
    end
    prune = "\\( " .. table.concat(parts, " -o ") .. " \\) -o "
  end
  local cmd = string.format(
    "find -L %s %s%s-type f %s-exec stat -c '%%Y %%s %%n' {} + 2>/dev/null",
    sq(path), depth, prune, nameFilter)
  local p = io.popen(cmd)
  if not p then return {} end
  local files = {}
  for line in p:lines() do
    local mtime, size, fpath = line:match("^(%d+) (%d+) (.+)$")
    if fpath then
      files[fpath] = { mtime = tonumber(mtime), size = tonumber(size) }
    end
  end
  p:close()
  return files
end

--- Build initial snapshot for a path.
local function buildSnapshot(path, recursive, pattern, exclude)
  if isDir(path) then
    return scanDir(path, recursive, pattern, exclude), true
  end
  local info = statFile(path)
  return info and { [path] = info } or {}, false
end

--- Diff two snapshots. Returns list of { type, path, size?, mtime? }.
local function diff(prev, curr)
  local changes = {}
  for p, info in pairs(curr) do
    local old = prev[p]
    if not old then
      changes[#changes + 1] = { type = "created", path = p, size = info.size, mtime = info.mtime }
    elseif old.mtime ~= info.mtime or old.size ~= info.size then
      changes[#changes + 1] = { type = "modified", path = p, size = info.size, mtime = info.mtime }
    end
  end
  for p in pairs(prev) do
    if not curr[p] then
      changes[#changes + 1] = { type = "deleted", path = p }
    end
  end
  return changes
end

-- ── Capability registration ──────────────────────────────────────────

Capabilities.register("FileWatcher", {
  visual = false,

  schema = {
    path      = { type = "string", desc = "File or directory path to watch" },
    recursive = { type = "bool", default = false, desc = "Recurse into subdirectories" },
    interval  = { type = "number", default = 1000, min = 100, desc = "Polling interval in milliseconds" },
    pattern   = { type = "string", desc = "Filename glob filter (e.g. '*.lua', '*.ts')" },
    exclude   = { type = "table", desc = "Directory names to skip (e.g. {'.git','node_modules'})" },
    running   = { type = "bool", default = true, desc = "Enable or disable watching" },
  },

  events = { "onChange" },

  create = function(nodeId, props)
    local path = props.path
    if not path or path == "" then
      return { snapshot = {}, elapsed = 0, isDir = false, ok = false }
    end
    local snapshot, dir = buildSnapshot(path, props.recursive, props.pattern, props.exclude)
    return { snapshot = snapshot, elapsed = 0, isDir = dir, ok = true }
  end,

  update = function(nodeId, props, prevProps, state)
    if props.path ~= prevProps.path
      or props.recursive ~= prevProps.recursive
      or props.pattern ~= prevProps.pattern then
      local path = props.path
      if not path or path == "" then
        state.snapshot = {}
        state.isDir = false
        state.ok = false
        return
      end
      local snapshot, dir = buildSnapshot(path, props.recursive, props.pattern, props.exclude)
      state.snapshot = snapshot
      state.isDir = dir
      state.elapsed = 0
      state.ok = true
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.ok then return end
    if props.running == false then return end

    local intervalSec = (props.interval or 1000) / 1000
    state.elapsed = state.elapsed + dt
    if state.elapsed < intervalSec then return end
    state.elapsed = state.elapsed - intervalSec

    local path = props.path
    if not path or path == "" then return end

    -- Rescan
    local curr
    if state.isDir then
      curr = scanDir(path, props.recursive, props.pattern, props.exclude)
    else
      local info = statFile(path)
      curr = info and { [path] = info } or {}
    end

    -- Diff and fire events
    local changes = diff(state.snapshot, curr)
    for _, c in ipairs(changes) do
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onChange",
          changeType = c.type,
          path = c.path,
          size = c.size,
          mtime = c.mtime,
        },
      })
    end

    state.snapshot = curr
  end,

  destroy = function(nodeId, state)
    state.snapshot = nil
  end,
})
