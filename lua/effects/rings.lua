--[[
  effects/rings.lua — Expanding concentric circles

  Rings spawn from center and expand outward with fading opacity.
  Self-animates via continuous spawning; beats trigger burst spawns.

  React usage:
    <Rings />
    <Rings speed={2} decay={0.04} />
    <Rings beat={onBeat} amplitude={amp} />
    <Rings background />
    <Rings infinite />
    <Rings reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, cos, pi = math.sin, math.cos, math.pi
local random = math.random
local noise = love.math.noise

local Rings = {}

local MAX_RINGS = 200

function Rings.create(w, h, props)
  return {
    time = 0,
    rings = {},
    cx = w / 2,
    cy = h / 2,
    maxRadius = math.sqrt(w * w + h * h) / 2,
    spawnAccum = 0,
    hue = random() * 1.0,
    cleared = false,
    reactiveIntensity = 0,
  }
end

function Rings.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.04)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local infinite = Util.boolProp(props, "infinite", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.maxRadius = math.sqrt(w * w + h * h) / 2

  local t = state.time

  -- Reactive mode: ramp intensity with mouse
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.5, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Center point: reactive follows mouse, infinite drifts, normal = center
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    state.cx = Util.lerp(state.cx, mouse.x, dt * 6)
    state.cy = Util.lerp(state.cy, mouse.y, dt * 6)
  elseif infinite then
    local driftX = (noise(t * 0.08, 0) - 0.5) * w * 0.5
    local driftY = (noise(0, t * 0.08) - 0.5) * h * 0.5
    state.cx = w / 2 + driftX
    state.cy = h / 2 + driftY
  else
    state.cx = w / 2
    state.cy = h / 2
  end

  -- Reactive: faster decay when dormant
  if reactive then
    state.decay = Util.lerp(0.12, decay, state.reactiveIntensity)
  else
    state.decay = decay
  end

  local amp = amplitude or ((sin(t * 0.8) + 1) * 0.3 + 0.2)
  amp = amp * reactMul

  -- Spawning
  local spawnRate = (0.5 + amp * 3) * speed
  if reactive then
    -- Mouse speed triggers extra rings
    if mouse and mouse.inside then
      spawnRate = spawnRate + mouse.speed * 0.01 * state.reactiveIntensity
    end
    spawnRate = spawnRate * state.reactiveIntensity
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  while state.spawnAccum >= 1 and #state.rings < MAX_RINGS do
    state.spawnAccum = state.spawnAccum - 1
    local ringSpeed = 30 + amp * 80 + random() * 20
    local thickness = 1.5 + amp * 4 + random() * 2
    local hue = (state.hue + random() * 0.1) % 1
    table.insert(state.rings, {
      cx = state.cx,
      cy = state.cy,
      radius = 2 + random() * 5,
      speed = ringSpeed * speed,
      thickness = thickness,
      alpha = (0.7 + amp * 0.3) * reactMul,
      hue = hue,
      sat = 0.6 + amp * 0.3,
      lit = 0.4 + amp * 0.2,
    })
  end

  -- Beat burst
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 1.2) > 0.95
  end
  if isBeat and #state.rings < MAX_RINGS and reactMul > 0.3 then
    local burstCount = 3 + random(3)
    for i = 1, burstCount do
      local ringSpeed = 60 + random() * 100
      local thickness = 3 + random() * 5
      local hue = (state.hue + i * 0.05) % 1
      table.insert(state.rings, {
        cx = state.cx,
        cy = state.cy,
        radius = 1,
        speed = ringSpeed * speed,
        thickness = thickness,
        alpha = 1.0 * reactMul,
        hue = hue,
        sat = 0.85,
        lit = 0.55,
      })
    end
  end

  -- Update rings
  local alive = {}
  for _, ring in ipairs(state.rings) do
    ring.radius = ring.radius + ring.speed * dt
    ring.alpha = ring.alpha * (1 - dt * 0.8)
    if ring.radius < state.maxRadius and ring.alpha > 0.01 then
      table.insert(alive, ring)
    end
  end
  state.rings = alive

  state.hue = (state.hue + dt * 0.015 * speed) % 1
end

function Rings.draw(state, w, h)
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.04)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  for _, ring in ipairs(state.rings) do
    local r, g, b = Util.hslToRgb(ring.hue, ring.sat, ring.lit)
    love.graphics.setColor(r, g, b, ring.alpha)
    love.graphics.setLineWidth(ring.thickness)
    love.graphics.circle("line", ring.cx or state.cx, ring.cy or state.cy, ring.radius)
  end
end

Effects.register("Rings", Rings)

return Rings
