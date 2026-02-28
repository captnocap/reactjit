--[[
  hotstate.lua — In-memory state atoms that survive HMR

  Unlike localstore (SQLite-backed, survives app restarts), hotstate lives
  purely in Lua memory. It survives hot reloads because the Lua process
  persists — only the QuickJS context is destroyed and recreated.

  The reload path in init.lua injects all atoms as globalThis.__hotstateCache
  before the new bundle is evaluated, so React hooks can read restored values
  synchronously on first render (zero flash).

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
  }
end

return HotState
