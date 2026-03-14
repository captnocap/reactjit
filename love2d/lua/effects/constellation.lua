--[[
  effects/constellation.lua — Star field with twinkling and connection graph

  Stars scatter across the canvas, twinkle via sine oscillation, and
  connect to nearby stars with fading lines. Beats spawn new stars.

  React usage:
    <Constellation />
    <Constellation speed={1.5} />
    <Constellation reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, sqrt, floor = math.random, math.sqrt, math.floor

local Constellation = {}

local MAX_STARS = 400
local CONNECTION_RATIO = 0.12  -- fraction of min(w,h) for connection distance

function Constellation.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local stars = {}
  if not reactive then
    for i = 1, 50 do
      table.insert(stars, {
        x = random() * w,
        y = random() * h,
        size = 1 + random() * 2,
        baseAlpha = 0.6 + random() * 0.4,
        alpha = 0.5,
        phase = random() * pi * 2,
        hue = random(),
        age = 0,
      })
    end
  end

  return {
    time = 0,
    stars = stars,
    connections = {},
    hue = random(),
    cleared = false,
    spawnAccum = 0,
    reactiveIntensity = 0,
    connectionDist = math.min(w, h) * CONNECTION_RATIO,
  }
end

local function rebuildConnections(state)
  local conns = {}
  local stars = state.stars
  local maxDist = state.connectionDist
  local maxDistSq = maxDist * maxDist
  for i = 1, #stars do
    for j = i + 1, #stars do
      local dx = stars[j].x - stars[i].x
      local dy = stars[j].y - stars[i].y
      local distSq = dx * dx + dy * dy
      if distSq < maxDistSq then
        local dist = sqrt(distSq)
        table.insert(conns, {
          a = i, b = j,
          alpha = 0.3 * (1 - dist / maxDist),
        })
      end
    end
  end
  state.connections = conns
end

function Constellation.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.01)
  local beat = Util.boolProp(props, "beat", false)
  local amplitude = Util.prop(props, "amplitude", nil)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.decay = decay
  state.connectionDist = math.min(w, h) * CONNECTION_RATIO

  local t = state.time

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  if reactive then
    state.decay = Util.lerp(0.06, decay, state.reactiveIntensity)
  end

  local amp = amplitude or ((sin(t * 0.8) + 1) * 0.3 + 0.2)

  -- Twinkle
  for _, star in ipairs(state.stars) do
    star.age = star.age + dt
    local twinkle = 0.5 + sin(t * 5.0 + star.phase) * 0.5
    star.alpha = star.baseAlpha * twinkle
  end

  -- Spawn stars
  local spawnRate = (0.3 + amp * 2) * speed
  if reactive then
    if mouse and mouse.inside then
      spawnRate = (spawnRate + mouse.speed * 0.005) * state.reactiveIntensity
    else
      spawnRate = spawnRate * state.reactiveIntensity * 0.2
    end
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  local spawned = false
  while state.spawnAccum >= 1 and #state.stars < MAX_STARS do
    state.spawnAccum = state.spawnAccum - 1
    spawned = true
    local sx, sy
    if reactive and mouse and mouse.inside then
      sx = mouse.x + (random() - 0.5) * 60
      sy = mouse.y + (random() - 0.5) * 60
    else
      sx = random() * w
      sy = random() * h
    end
    table.insert(state.stars, {
      x = sx, y = sy,
      size = 1 + amp * 3 + random() * 2,
      baseAlpha = 0.6 + amp * 0.4,
      alpha = 0.5,
      phase = random() * pi * 2,
      hue = (state.hue + random() * 0.15) % 1,
      age = 0,
    })
  end

  -- Beat burst
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 1.0) > 0.97
  end
  if isBeat and reactMul > 0.3 then
    local count = 1 + floor(amp * 3)
    for i = 1, count do
      if #state.stars >= MAX_STARS then break end
      spawned = true
      table.insert(state.stars, {
        x = random() * w,
        y = random() * h,
        size = 1 + amp * 3 + random() * 2,
        baseAlpha = 0.8,
        alpha = 0.8,
        phase = random() * pi * 2,
        hue = (state.hue + random() * 0.1) % 1,
        age = 0,
      })
    end
  end

  -- Cull old stars
  if #state.stars > MAX_STARS then
    local alive = {}
    for _, s in ipairs(state.stars) do
      if s.age < 60 then
        table.insert(alive, s)
      end
    end
    state.stars = alive
    spawned = true  -- force rebuild
  end

  if spawned then
    rebuildConnections(state)
  end

  state.hue = (state.hue + dt * 0.01 * speed) % 1
end

function Constellation.draw(state, w, h)
  -- Background fade
  if not state.cleared then
    love.graphics.setColor(0.02, 0.02, 0.05, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.02, 0.02, 0.05, state.decay or 0.01)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  local stars = state.stars

  -- Draw connections
  love.graphics.setLineWidth(0.5)
  for _, conn in ipairs(state.connections) do
    local a = stars[conn.a]
    local b = stars[conn.b]
    if a and b then
      local avgAlpha = (a.alpha + b.alpha) * 0.5 * conn.alpha
      local r1, g1, b1 = Util.hslToRgb(a.hue, 0.5, 0.6)
      love.graphics.setColor(r1, g1, b1, avgAlpha)
      love.graphics.line(a.x, a.y, b.x, b.y)
    end
  end

  -- Draw stars
  for _, star in ipairs(stars) do
    local r, g, b = Util.hslToRgb(star.hue, 0.6, 0.7)
    -- Glow
    love.graphics.setColor(r, g, b, star.alpha * 0.3)
    love.graphics.circle("fill", star.x, star.y, star.size * 3)
    -- Core
    love.graphics.setColor(1, 1, 1, star.alpha * 0.9)
    love.graphics.circle("fill", star.x, star.y, star.size)
  end
end

Effects.register("Constellation", Constellation)

return Constellation
