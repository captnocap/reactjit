--[[
  effects/orbits.lua — N-body gravitational orbits

  Particles orbit invisible attractors (1 central + 5 orbital).
  Softened gravity prevents singularities. Particles spawn with
  tangential velocity for orbital motion. Trails show orbital paths.

  React usage:
    <Orbits />
    <Orbits speed={1.5} />
    <Orbits reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt, max, min = math.random, math.floor, math.sqrt, math.max, math.min

local Orbits = {}

local MAX_PARTICLES = 500
local MAX_TRAIL = 40

function Orbits.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)

  -- Create attractors
  local attractors = {}
  -- Central
  table.insert(attractors, {
    x = w / 2, y = h / 2,
    targetX = w / 2, targetY = h / 2,
    mass = 800,
  })

  -- Orbital attractors
  local orbitR = min(w, h) * 0.28
  for i = 1, 5 do
    local angle = (i - 1) / 5 * pi * 2
    table.insert(attractors, {
      x = w / 2 + cos(angle) * orbitR,
      y = h / 2 + sin(angle) * orbitR,
      targetX = w / 2 + cos(angle) * orbitR,
      targetY = h / 2 + sin(angle) * orbitR,
      mass = 150 + random() * 200,
    })
  end

  -- Spawn initial particles
  local particles = {}
  if not reactive then
    for i = 1, 120 do
      local angle = random() * pi * 2
      local radius = max(w, h) * 0.4
      local px = w / 2 + cos(angle) * radius
      local py = h / 2 + sin(angle) * radius
      local spd = 2 + random() * 2
      table.insert(particles, {
        x = px, y = py,
        vx = cos(angle + pi / 2) * spd,
        vy = sin(angle + pi / 2) * spd,
        trail = {},
        life = 1,
        age = 0,
        hue = random(),
        size = 2 + random() * 2,
      })
    end
  end

  return {
    time = 0,
    particles = particles,
    attractors = attractors,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

local function spawnParticle(state, w, h, hue)
  if #state.particles >= MAX_PARTICLES then return end

  local angle = random() * pi * 2
  local radius = max(w, h) * 0.4
  local px = w / 2 + cos(angle) * radius
  local py = h / 2 + sin(angle) * radius
  local spd = 2 + random() * 3

  table.insert(state.particles, {
    x = px, y = py,
    vx = cos(angle + pi / 2) * spd,
    vy = sin(angle + pi / 2) * spd,
    trail = {},
    life = 1,
    age = 0,
    hue = (hue + random() * 0.1) % 1,
    size = 2 + random() * 2,
  })
end

function Orbits.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.15)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  local t = state.time
  state.decay = decay

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Self-modulate
  local bass = (sin(t * 0.4) + 1) * 0.5
  local mid = (sin(t * 0.25 + 1.5) + 1) * 0.5
  local high = (sin(t * 0.6 + 3.0) + 1) * 0.5
  local amp = (sin(t * 0.7) + 1) * 0.35 + 0.15

  -- Update attractors
  -- Central mass modulated by bass
  state.attractors[1].mass = 400 + bass * 1200

  -- Reactive: central follows mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.3 then
    state.attractors[1].targetX = Util.lerp(w / 2, mouse.x, state.reactiveIntensity * 0.5)
    state.attractors[1].targetY = Util.lerp(h / 2, mouse.y, state.reactiveIntensity * 0.5)
  else
    state.attractors[1].targetX = w / 2
    state.attractors[1].targetY = h / 2
  end

  -- Orbital attractors rotate
  local orbitR = min(w, h) * (0.2 + mid * 0.2)
  for i = 2, #state.attractors do
    local baseAngle = ((i - 2) / (#state.attractors - 1)) * pi * 2
    local angle = baseAngle + t * (0.2 + speed * 0.2)
    state.attractors[i].targetX = w / 2 + cos(angle) * orbitR
    state.attractors[i].targetY = h / 2 + sin(angle) * orbitR
    state.attractors[i].mass = 100 + high * 300
  end

  for _, att in ipairs(state.attractors) do
    att.x = att.x + (att.targetX - att.x) * 0.02
    att.y = att.y + (att.targetY - att.y) * 0.02
  end

  -- Continuous spawning
  local spawnRate = (0.3 + amp * 1.5) * speed * reactMul
  if reactive and mouse and mouse.inside then
    spawnRate = spawnRate + mouse.speed * 0.003 * state.reactiveIntensity
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  while state.spawnAccum >= 1 and #state.particles < MAX_PARTICLES do
    state.spawnAccum = state.spawnAccum - 1
    spawnParticle(state, w, h, state.hue)
  end

  -- Beat burst
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.7) > 0.93
  end
  if isBeat and reactMul > 0.3 then
    for i = 1, floor(amp * 8) do
      spawnParticle(state, w, h, state.hue)
    end
  end

  -- Update particles
  local timescale = (1 + amp * 0.5) * speed
  local alive = {}
  local minDist = 50
  local minDistSq = minDist * minDist

  for _, p in ipairs(state.particles) do
    -- Store trail
    table.insert(p.trail, {x = p.x, y = p.y})
    if #p.trail > MAX_TRAIL then
      table.remove(p.trail, 1)
    end

    -- Gravity from all attractors
    local ax, ay = 0, 0
    for _, att in ipairs(state.attractors) do
      local dx = att.x - p.x
      local dy = att.y - p.y
      local distSq = dx * dx + dy * dy
      local dist = sqrt(distSq)

      local force = att.mass / max(distSq, minDistSq)

      if dist < minDist then
        local repel = (minDist - dist) / minDist * 0.5
        ax = ax - (dx / dist) * repel
        ay = ay - (dy / dist) * repel
      else
        ax = ax + (dx / dist) * force
        ay = ay + (dy / dist) * force
      end
    end

    p.vx = p.vx + ax * timescale * dt * 60
    p.vy = p.vy + ay * timescale * dt * 60

    -- Damping
    p.vx = p.vx * 0.999
    p.vy = p.vy * 0.999

    -- Speed limit
    local spd = sqrt(p.vx * p.vx + p.vy * p.vy)
    if spd > 15 then
      p.vx = p.vx / spd * 15
      p.vy = p.vy / spd * 15
    end

    p.x = p.x + p.vx * timescale * dt * 60
    p.y = p.y + p.vy * timescale * dt * 60

    p.age = p.age + dt
    p.life = max(0, 1 - p.age / 40)

    local margin = 200
    if p.life > 0 and p.x > -margin and p.x < w + margin and p.y > -margin and p.y < h + margin then
      table.insert(alive, p)
    end
  end
  state.particles = alive

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Orbits.draw(state, w, h)
  -- Trail fade
  love.graphics.setColor(0.03, 0.03, 0.05, state.decay or 0.15)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Attractor glow
  for _, att in ipairs(state.attractors) do
    local size = sqrt(att.mass) * 0.4
    love.graphics.setColor(1, 1, 1, 0.12)
    love.graphics.circle("fill", att.x, att.y, size * 2)
    love.graphics.setColor(0.4, 0.4, 0.6, 0.08)
    love.graphics.circle("fill", att.x, att.y, size)
  end

  -- Particle trails
  love.graphics.setLineWidth(1.5)
  for _, p in ipairs(state.particles) do
    if #p.trail >= 2 then
      local r, g, b = Util.hslToRgb(p.hue, 0.7, 0.6)
      love.graphics.setColor(r, g, b, p.life * 0.4)
      local flat = {}
      for _, pt in ipairs(p.trail) do
        table.insert(flat, pt.x)
        table.insert(flat, pt.y)
      end
      if #flat >= 4 then
        love.graphics.line(flat)
      end
    end
  end

  -- Particles
  for _, p in ipairs(state.particles) do
    local r, g, b = Util.hslToRgb(p.hue, 0.7, 0.6)
    local size = p.size * p.life

    -- Glow
    love.graphics.setColor(r, g, b, p.life * 0.3)
    love.graphics.circle("fill", p.x, p.y, size * 3)

    -- Core
    love.graphics.setColor(1, 1, 1, p.life * 0.8)
    love.graphics.circle("fill", p.x, p.y, size)
  end
end

Effects.register("Orbits", Orbits)

return Orbits
