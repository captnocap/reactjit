--[[
  latches.lua — Lua-owned animated values readable by React.

  A latch is a named numeric value that Lua writes (in a capability tick)
  and React reads directly into style props. Nothing goes between a latch
  and a style prop in React — no useSpring, no JS math between them.

  The full chain:
    Lua capability tick → Latches.set(key, value)
    → flushed as latches:frame event once per frame
    → JS useLatch(key) re-renders with new value
    → straight into style prop

  Usage (Lua — inside a capability tick):
    local Latches = require("lua.latches")
    Latches.set("shatter:" .. nodeId .. ":block:3:x", 120.5)

  Usage (React):
    const x = useLatch("shatter:42:block:3:x")
    <Box style={{ left: x }} />
]]

local Latches = {}

-- Current values: key -> number
local store = {}

-- Keys written this frame (cleared after each flush)
local dirty = {}

--- Write a latch value. Marks the key dirty for this frame's flush.
--- @param key string  Namespaced key, e.g. "shatter:42:block:3:x"
--- @param value number
function Latches.set(key, value)
  store[key] = value
  dirty[key] = true
end

--- Read a latch value from Lua (React reads via useLatch hook instead).
--- @param key string
--- @return number|nil
function Latches.get(key)
  return store[key]
end

--- Flush dirty keys for the current frame.
--- Returns a table of { key -> value } for all changed keys, or nil if none.
--- Clears the dirty set after returning.
--- Called by init.lua once per frame after capabilities.syncWithTree.
--- @return table|nil
function Latches.flushDirty()
  if next(dirty) == nil then return nil end
  local out = {}
  for k in pairs(dirty) do
    out[k] = store[k]
  end
  dirty = {}
  return out
end

--- Clear all latch state. Called on HMR / full tree reset.
function Latches.clear()
  store = {}
  dirty = {}
end

return Latches
