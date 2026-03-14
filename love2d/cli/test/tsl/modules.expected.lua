-- Named imports
local _mod_lua_effects = require("lua.effects")
local Effects = _mod_lua_effects.Effects
local _mod_lua_math = require("lua.math")
local cos = _mod_lua_math.cos
local sin = _mod_lua_math.sin
local pi = _mod_lua_math.pi
-- Namespace import
local Utils = require("lua.effects.util")
-- Types are stripped
-- Exported functions
local function create(w, h)
  local cx = w / 2
  local cy = h / 2
  return { cx = cx, cy = cy, time = 0 }
end
local function update(state, dt)
  state.time = state.time + dt
end
-- Non-exported (module-private)
local function helper(x)
  return x * 2
end

return {
  create = create,
  update = update,
}
