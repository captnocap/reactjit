-- A simple particle effect written in TSL
-- This should transpile to idiomatic Lua suitable for LuaJIT
local _mod_lua_effects = require("lua.effects")
local Effects = _mod_lua_effects.Effects
local _mod_lua_effects_util = require("lua.effects.util")
local prop = _mod_lua_effects_util.prop
local boolProp = _mod_lua_effects_util.boolProp
local MAX_PARTICLES = 200
local GRAVITY = 98
local function create(w, h, props)
  return {
    particles = {},
    time = 0,
    cx = w / 2,
    cy = h / 2,
  }
end
local function spawnParticle(cx, cy, speed)
  local angle = math.random() * math.pi * 2
  local vel = speed * (0.5 + math.random() * 0.5)
  return {
    x = cx,
    y = cy,
    vx = math.cos(angle) * vel,
    vy = math.sin(angle) * vel,
    life = 1,
    color = math.random(),
  }
end
local function update(state, dt, props, w, h)
  local speed = prop(props, "speed", 100)
  local rate = prop(props, "rate", 5)
  local gravity = boolProp(props, "gravity", true)
  state.time = state.time + dt
  state.cx = w / 2
  state.cy = h / 2
  -- Spawn new particles
  for i = 1, rate do
    if #state.particles < MAX_PARTICLES then
      table.insert(state.particles, spawnParticle(state.cx, state.cy, speed))
    end
  end
  -- Update existing particles
  local writeIdx = 1
  for i = 1, #state.particles do
    local p = state.particles[i]
    p.x = p.x + p.vx * dt
    p.y = p.y + p.vy * dt
    if gravity then
      p.vy = p.vy + GRAVITY * dt
    end
    p.life = p.life - dt * 0.5
    if p.life > 0 then
      state.particles[writeIdx] = p
      writeIdx = writeIdx + 1
    end
  end
  -- Trim dead particles
  for i = writeIdx, #state.particles do
    state.particles[i] = nil
  end
end
local function draw(state, w, h)
  for _, p in ipairs(state.particles) do
    if p ~= nil and p ~= nil then
      local alpha = p.life
      local size = 2 + p.life * 3
    end
  end
end

return {
  create = create,
  update = update,
  draw = draw,
}
