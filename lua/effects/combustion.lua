--[[
  effects/combustion.lua — Realistic fire simulation

  Particle-based fire with fuel, flame, smoke, and ember types.
  Colors follow black-body radiation (dark red → orange → yellow → white).
  Fire sources along the bottom emit fuel that ignites and rises.

  React usage:
    <Combustion />
    <Combustion speed={1.5} />
    <Combustion reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, pi = math.sin, math.pi
local random, floor, sqrt, max, min = math.random, math.floor, math.sqrt, math.max, math.min
local abs = math.abs

local Combustion = {}

local MAX_PARTICLES = 1200

-- Black-body radiation color from temperature (0-1)
local function tempToColor(temp, life, isSmoke)
  if isSmoke then
    local gray = 0.12 + life * 0.08
    return gray, gray, gray, life * 0.4
  end

  local r, g, b
  local t = temp
  if t > 0.9 then
    r, g, b = 1, 1, 0.78 + (t - 0.9) * 2.2
  elseif t > 0.7 then
    r, g, b = 1, 0.78 + (t - 0.7) * 1.1, 0.2
  elseif t > 0.5 then
    r, g, b = 1, 0.39 + (t - 0.5) * 2.0, 0
  elseif t > 0.3 then
    r, g, b = 0.78 + (t - 0.3) * 1.1, (t - 0.3) * 2.0, 0
  else
    r, g, b = t * 2.6, 0, 0
  end

  return min(1, r), min(1, g), min(1, b), life * 0.85
end

function Combustion.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)

  -- Create fire sources
  local sources = {}
  local numSources = 5
  for i = 1, numSources do
    table.insert(sources, {
      x = w * (i - 0.5) / numSources,
      y = h - 40,
      intensity = 0.5 + random() * 0.5,
    })
  end

  return {
    time = 0,
    particles = {},
    sources = sources,
    fuelRate = 0.5,
    turbulence = 0.5,
    oxygenLevel = 1,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

local function spawnParticle(state, x, y, ptype, temp, size, vx, vy)
  if #state.particles >= MAX_PARTICLES then return end

  table.insert(state.particles, {
    x = x + (random() - 0.5) * 20,
    y = y + random() * 10,
    vx = vx or (random() - 0.5) * 2,
    vy = vy or (-random() * 3 - 1),
    type = ptype, -- "fuel", "flame", "smoke", "ember"
    life = 1,
    maxLife = ptype == "smoke" and 150 or (ptype == "flame" and 50 or 80),
    temperature = temp or (ptype == "flame" and 1 or (ptype == "ember" and 0.8 or 0.3)),
    size = size or (ptype == "smoke" and (12 + random() * 15) or (4 + random() * 8)),
    age = 0,
  })
end

function Combustion.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  local t = state.time
  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.5, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Self-modulate fire parameters
  local bass = (sin(t * 0.4) + 1) * 0.5
  local high = (sin(t * 0.7 + 2.0) + 1) * 0.5

  state.fuelRate = (0.3 + bass * 1.2) * reactMul
  state.turbulence = 0.3 + high * 1.2
  state.oxygenLevel = 0.5 + (sin(t * 0.25) + 1) * 0.25

  -- Update sources
  for _, source in ipairs(state.sources) do
    source.intensity = 0.3 + bass * 0.7 + random() * 0.15

    -- Reactive: move sources toward mouse
    if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
      source.y = h - 40 + (mouse.y - (h - 40)) * state.reactiveIntensity * 0.3
    else
      source.y = h - 40
    end

    -- Spawn fuel
    local count = floor(state.fuelRate * source.intensity * 2 * speed)
    for i = 1, count do
      spawnParticle(state, source.x, source.y, "fuel")
    end
  end

  -- Reactive: extra fire at mouse position
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.3 then
    state.spawnAccum = state.spawnAccum + dt * mouse.speed * 0.02 * state.reactiveIntensity
    while state.spawnAccum >= 1 do
      state.spawnAccum = state.spawnAccum - 1
      spawnParticle(state, mouse.x, mouse.y, "flame", 0.8 + random() * 0.2)
    end
  end

  -- Beat bursts
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.7) > 0.93
  end

  if isBeat and reactMul > 0.2 then
    for _, source in ipairs(state.sources) do
      for i = 1, floor(amp * 8) do
        spawnParticle(state, source.x + (random() - 0.5) * 30, source.y - 20, "flame", 0.7 + amp * 0.3)
      end
      if amp > 0.5 then
        for i = 1, floor(amp * 4) do
          spawnParticle(state, source.x, source.y - 30, "ember", 0.8, 2 + random() * 3,
            (random() - 0.5) * 8, -random() * 8 - 2)
        end
      end
    end
  end

  -- Update particles
  local alive = {}
  local turbulence = state.turbulence
  local spd = speed * dt * 60

  for _, p in ipairs(state.particles) do
    p.age = p.age + dt * 60
    p.life = max(0, 1 - p.age / p.maxLife)

    if p.type == "fuel" then
      p.vy = p.vy - 0.02 * spd
      p.vx = p.vx + (random() - 0.5) * 0.1

      -- Spontaneous ignition
      if p.age > 10 and random() < 0.03 * state.oxygenLevel then
        p.type = "flame"
        p.temperature = 0.6 + state.oxygenLevel * 0.4
        p.maxLife = 50
        p.age = 0
      end
    elseif p.type == "flame" then
      p.vy = p.vy - (0.15 + turbulence * 0.1) * spd
      p.vx = p.vx + (random() - 0.5) * turbulence * 2
      p.temperature = max(0, p.temperature - 0.01)
      p.size = p.size * (1 - 0.02 * dt * 60)

      -- Dying flames produce smoke
      if p.life < 0.3 and random() < 0.08 then
        spawnParticle(state, p.x, p.y, "smoke")
      end
    elseif p.type == "smoke" then
      p.vy = p.vy - 0.05 * spd
      p.vx = p.vx + (random() - 0.5) * 0.3 * turbulence
      p.size = p.size + 0.15
    elseif p.type == "ember" then
      p.vy = p.vy + 0.05 * spd -- gravity
      p.vx = p.vx * 0.99
      p.temperature = max(0, p.temperature - 0.005)
    end

    p.x = p.x + p.vx * dt * 60
    p.y = p.y + p.vy * dt * 60
    p.vx = p.vx * 0.98
    p.vy = p.vy * 0.98

    if p.life > 0 and p.y > -50 and p.x > -50 and p.x < w + 50 then
      table.insert(alive, p)
    end
  end
  state.particles = alive
end

function Combustion.draw(state, w, h)
  -- Dark background with trail
  love.graphics.setColor(0.02, 0.02, 0.04, 0.3)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Separate particles by type for layered rendering
  local smoke, flames, embers = {}, {}, {}
  for _, p in ipairs(state.particles) do
    if p.type == "smoke" then
      table.insert(smoke, p)
    elseif p.type == "ember" then
      table.insert(embers, p)
    else
      table.insert(flames, p)
    end
  end

  -- Draw smoke (back layer)
  for _, p in ipairs(smoke) do
    local r, g, b, a = tempToColor(p.temperature, p.life, true)
    love.graphics.setColor(r, g, b, a)
    love.graphics.circle("fill", p.x, p.y, p.size)
  end

  -- Draw flames with additive-like glow
  for _, p in ipairs(flames) do
    local r, g, b, a = tempToColor(p.temperature, p.life, false)

    -- Outer glow
    love.graphics.setColor(r, g, b, a * 0.25)
    love.graphics.circle("fill", p.x, p.y, p.size * 1.8)

    -- Inner core
    love.graphics.setColor(r, g, b, a)
    love.graphics.circle("fill", p.x, p.y, p.size * 0.6)
  end

  -- Draw embers
  for _, p in ipairs(embers) do
    local r, g, b, a = tempToColor(p.temperature, p.life, false)
    love.graphics.setColor(r, g, b, a)
    love.graphics.circle("fill", p.x, p.y, p.size)

    -- Trail
    love.graphics.setColor(r, g, b, a * 0.3)
    love.graphics.setLineWidth(p.size * 0.5)
    love.graphics.line(p.x, p.y, p.x - p.vx * 3, p.y - p.vy * 3)
  end

  -- Source glow
  for _, source in ipairs(state.sources) do
    love.graphics.setColor(1, 0.4, 0, source.intensity * 0.3)
    love.graphics.circle("fill", source.x, source.y + 10, 25)
  end
end

Effects.register("Combustion", Combustion)

return Combustion
