--[[
  hotstate.lua — In-memory state atoms that survive HMR

  Unlike localstore (SQLite-backed, survives app restarts), hotstate lives
  purely in Lua memory. It survives hot reloads because the Lua process
  persists — only the QuickJS context is destroyed and recreated.

  The reload path in init.lua injects all atoms as globalThis.__hotstateCache
  before the new bundle is evaluated, so React hooks can read restored values
  synchronously on first render (zero flash).

  State preloading:
    Drop a state_preset.json in your project root. On every reload, hotstate
    seeds atoms from it before injecting __hotstateCache. Claude (or any tool)
    can write this file to reproduce exact app states for testing.

    hotstate:snapshot  — dump current atoms to a JSON file
    hotstate:load      — load a JSON file into atoms + trigger reload

  Usage (Lua-side):
    local hotstate = require("lua.hotstate")
    hotstate.set("sidebar.open", true)
    local val = hotstate.get("sidebar.open")  -- true

  Usage (React-side):
    const [sidebar, setSidebar] = useHotState('sidebar.open', true);
    // Identical API to useState, but survives HMR
]]

local HotState = {}

--- The atom store. Keys are strings, values are any serializable type.
--- This table is NEVER cleared during reload() — that's the whole point.
local atoms = {}

--- Whether HMR state preservation is enabled (devtools toggle).
local enabled = true

-- JSON module (try multiple paths — same as init.lua)
local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end

-- ── Core API ──────────────────────────────────────────────

function HotState.get(key)
  return atoms[key]
end

function HotState.set(key, value)
  atoms[key] = value
end

function HotState.delete(key)
  atoms[key] = nil
end

--- Return all atoms (used by reload path to inject into JS).
function HotState.getAll()
  if not enabled then return {} end
  return atoms
end

--- Clear all atoms. Used when devtools toggle is flipped off.
function HotState.clear()
  atoms = {}
end

--- Check/set whether HMR state preservation is active.
function HotState.isEnabled()
  return enabled
end

function HotState.setEnabled(val)
  enabled = val
  if not val then
    atoms = {}
  end
end

-- ── Snapshot & Preload ────────────────────────────────────

--- Dump all atoms to a JSON file. Returns the absolute path written.
function HotState.snapshot(path)
  if not ok_json then return nil, "JSON module not available" end
  path = path or "state_preset.json"
  local data = json.encode(atoms)
  -- Write via Love2D filesystem (save directory)
  local ok = love.filesystem.write(path, data)
  if not ok then return nil, "Failed to write " .. path end
  -- Return the full path so the caller knows where it landed
  local fullPath = love.filesystem.getSaveDirectory() .. "/" .. path
  io.write("[hotstate] Snapshot saved: " .. fullPath .. " (" .. #data .. " bytes, " .. HotState.count() .. " atoms)\n"); io.flush()
  return fullPath
end

--- Load atoms from a JSON file. Merges into current atoms (does not clear first).
--- Returns true on success, nil+error on failure.
function HotState.loadFile(path)
  if not ok_json then return nil, "JSON module not available" end
  path = path or "state_preset.json"
  -- Try Love2D filesystem (reads from both source and save directories)
  local data = love.filesystem.read(path)
  if not data then return nil, "File not found: " .. path end
  local decodeOk, parsed = pcall(json.decode, data)
  if not decodeOk or type(parsed) ~= "table" then
    return nil, "Invalid JSON in " .. path
  end
  local count = 0
  for k, v in pairs(parsed) do
    atoms[k] = v
    count = count + 1
  end
  io.write("[hotstate] Loaded " .. count .. " atoms from " .. path .. "\n"); io.flush()
  return true
end

--- Load state_preset.json if it exists. Called by init.lua during reload.
--- Silent no-op if the file doesn't exist.
function HotState.loadPreset()
  local info = love.filesystem.getInfo("state_preset.json")
  if not info then return false end
  local ok, err = HotState.loadFile("state_preset.json")
  if not ok then
    io.write("[hotstate] Warning: state_preset.json exists but failed to load: " .. tostring(err) .. "\n"); io.flush()
    return false
  end
  return true
end

--- Count the number of atoms currently stored.
function HotState.count()
  local n = 0
  for _ in pairs(atoms) do n = n + 1 end
  return n
end

--- Return all atom keys (for inspection/debugging).
function HotState.keys()
  local result = {}
  for k in pairs(atoms) do result[#result + 1] = k end
  table.sort(result)
  return result
end

-- ── RPC handler registry ──────────────────────────────────

function HotState.getHandlers()
  return {
    ["hotstate:get"] = function(args)
      if not enabled then return nil end
      return HotState.get(args.key)
    end,
    ["hotstate:set"] = function(args)
      if not enabled then return nil end
      HotState.set(args.key, args.value)
      return true
    end,
    ["hotstate:delete"] = function(args)
      HotState.delete(args.key)
      return true
    end,
    ["hotstate:clear"] = function()
      HotState.clear()
      return true
    end,
    ["hotstate:enabled"] = function(args)
      if args and args.value ~= nil then
        HotState.setEnabled(args.value)
      end
      return enabled
    end,
    ["hotstate:snapshot"] = function(args)
      local path = args and args.path or nil
      local result, err = HotState.snapshot(path)
      if result then return { path = result } end
      return { error = err }
    end,
    ["hotstate:load"] = function(args)
      local path = args and args.path or nil
      local ok, err = HotState.loadFile(path)
      if not ok then return { error = err } end
      -- Return a signal that the caller should trigger a reload
      -- (the RPC handler in init.lua does the actual reload)
      return { loaded = true, reload = true }
    end,
    ["hotstate:keys"] = function()
      return HotState.keys()
    end,
  }
end

return HotState
