--[[
  effects/flowparticles.lua — Perlin noise flow field particle system

  Particles follow a time-evolving noise-based flow field, leaving trails
  that accumulate into organic, stippled textures.

  React usage:
    <FlowParticles />
    <FlowParticles speed={1.5} decay={0.02} />
    <FlowParticles bass={bass} high={high} beat={onBeat} />
    <FlowParticles background />
    <FlowParticles infinite />
    <FlowParticles reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, noise = math.random, love.math.noise
local floor = math.floor

local FlowParticles = {}

local MAX_PARTICLES = 600
local TRAIL_LENGTH = 15

function FlowParticles.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local particles = {}
  -- Seed with initial particles (skip if reactive — starts dormant)
  if not reactive then
    for i = 1, 80 do
      table.insert(particles, {
        x = random() * w,
        y = random() * h,
        vx = 0,
        vy = 0,
        trail = {},
        age = 0,
        hue = random(),
        size = 1 + random() * 1.5,
      })
    end
  end

  return {
    time = 0,
    particles = particles,
    -- Flow field parameters
    fieldScale = 0.003,
    fieldStrength = 1.5,
    fieldRotation = 0,
    turbulence = 1.0,
    hue = random(),
    cleared = false,
    spawnAccum = 0,
    -- Infinite pan state
    panX = 0,
    panY = 0,
    -- Reactive state
    reactiveIntensity = 0,
  }
end

--- Sample the flow field at a position, return angle.
--- panX/panY offset the noise sampling for infinite scrolling.
local function sampleField(x, y, time, scale, turbulence, panX, panY)
  local sx = (x + panX) * scale
  local sy = (y + panY) * scale
  local n1 = noise(sx, sy, time * 0.3) * 2 - 1
  local n2 = noise(sx * 2, sy * 2, time * 0.3 + 100) * 2 - 1
  local n3 = noise(sx * 4, sy * 4, time * 0.3 + 200) * 2 - 1
  local combined = n1 + n2 * 0.5 * turbulence + n3 * 0.25 * turbulence
  return combined * pi * 2
end

function FlowParticles.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.02)
  local bass = Util.prop(props, "bass", nil)
  local high = Util.prop(props, "high", nil)
  local beat = Util.boolProp(props, "beat", false)
  local amplitude = Util.prop(props, "amplitude", nil)
  local infinite = Util.boolProp(props, "infinite", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed * 0.5
  state.decay = decay

  local t = state.time

  -- Infinite canvas: auto-pan through noise space
  if infinite then
    local propPanX = Util.prop(props, "panX", nil)
    local propPanY = Util.prop(props, "panY", nil)
    if propPanX then
      state.panX = propPanX
      state.panY = propPanY or 0
    else
      state.panX = state.panX + dt * 30 * speed
      state.panY = state.panY + dt * 12 * speed
    end
  else
    state.panX = Util.prop(props, "panX", 0)
    state.panY = Util.prop(props, "panY", 0)
  end

  -- Reactive mode: intensity ramps up with mouse activity, fades when idle
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.5, 0)
    end
  end

  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Derive field parameters from driving signals or time
  if bass then
    state.fieldStrength = 0.5 + bass * 2.5
  else
    state.fieldStrength = (1.0 + (sin(t * 0.4) + 1) * 0.75) * reactMul
  end

  if high then
    state.turbulence = 0.5 + high * 2
  else
    state.turbulence = 0.8 + (sin(t * 0.25 + 1.5) + 1) * 0.6
  end

  local amp = amplitude or ((sin(t * 0.7) + 1) * 0.3 + 0.25)
  amp = amp * reactMul

  -- Reactive mode: override decay to fade faster when dormant
  if reactive then
    state.decay = Util.lerp(0.12, decay, state.reactiveIntensity)
  end

  -- Spawn particles
  local spawnRate = (2 + amp * 6) * speed
  -- Reactive: spawn at mouse position
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    local mouseSpawnRate = mouse.speed * 0.015 * state.reactiveIntensity
    state.spawnAccum = state.spawnAccum + dt * (spawnRate * state.reactiveIntensity + mouseSpawnRate)
    while state.spawnAccum >= 1 and #state.particles < MAX_PARTICLES do
      state.spawnAccum = state.spawnAccum - 1
      local spread = 20 + (1 - state.reactiveIntensity) * 40
      table.insert(state.particles, {
        x = mouse.x + (random() - 0.5) * spread,
        y = mouse.y + (random() - 0.5) * spread,
        vx = (mouse.dx or 0) * 0.3 + (random() - 0.5) * 2,
        vy = (mouse.dy or 0) * 0.3 + (random() - 0.5) * 2,
        trail = {},
        age = 0,
        hue = (state.hue + random() * 0.15) % 1,
        size = 1 + random() * 1.5,
      })
    end
  elseif not reactive then
    state.spawnAccum = state.spawnAccum + dt * spawnRate
    while state.spawnAccum >= 1 and #state.particles < MAX_PARTICLES do
      state.spawnAccum = state.spawnAccum - 1
      local x, y
      if random() < 0.3 then
        x = w * 0.3 + random() * w * 0.4
        y = h * 0.3 + random() * h * 0.4
      else
        local side = random(4)
        if side == 1 then x, y = 0, random() * h
        elseif side == 2 then x, y = w, random() * h
        elseif side == 3 then x, y = random() * w, 0
        else x, y = random() * w, h end
      end
      table.insert(state.particles, {
        x = x, y = y, vx = 0, vy = 0,
        trail = {},
        age = 0,
        hue = (state.hue + random() * 0.15) % 1,
        size = 1 + random() * 1.5,
      })
    end
  end

  -- Beat burst
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 1.0) > 0.97
  end
  if isBeat and reactMul > 0.3 then
    local burstCount = floor((15 + floor(random() * 10)) * reactMul)
    local cx, cy = w / 2, h / 2
    if reactive and mouse and mouse.inside then
      cx, cy = mouse.x, mouse.y
    end
    for i = 1, burstCount do
      if #state.particles >= MAX_PARTICLES then break end
      local angle = random() * pi * 2
      local dist = random() * math.min(w, h) * 0.2
      table.insert(state.particles, {
        x = cx + cos(angle) * dist,
        y = cy + sin(angle) * dist,
        vx = cos(angle) * 30,
        vy = sin(angle) * 30,
        trail = {},
        age = 0,
        hue = (state.hue + random() * 0.1) % 1,
        size = 1.5 + random() * 2,
      })
    end
  end

  -- Update particles
  local alive = {}
  local margin = 50
  local panX, panY = state.panX, state.panY
  for _, p in ipairs(state.particles) do
    local angle = sampleField(p.x, p.y, state.time, state.fieldScale, state.turbulence, panX, panY)
    local fx = cos(angle) * state.fieldStrength
    local fy = sin(angle) * state.fieldStrength

    p.vx = p.vx * 0.93 + fx * 0.4
    p.vy = p.vy * 0.93 + fy * 0.4
    p.x = p.x + p.vx * speed
    p.y = p.y + p.vy * speed
    p.age = p.age + dt

    -- Store trail
    table.insert(p.trail, 1, { p.x, p.y })
    if #p.trail > TRAIL_LENGTH then
      table.remove(p.trail)
    end

    -- Keep if in bounds and not too old
    if p.x > -margin and p.x < w + margin and
       p.y > -margin and p.y < h + margin and
       p.age < 30 then
      table.insert(alive, p)
    end
  end
  state.particles = alive

  state.hue = (state.hue + dt * 0.01 * speed) % 1
end

function FlowParticles.draw(state, w, h)
  -- Background decay
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.02)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  -- Draw particles and trails
  for _, p in ipairs(state.particles) do
    local r, g, b = Util.hslToRgb(p.hue, 0.75, 0.5)

    -- Trail
    if #p.trail >= 2 then
      love.graphics.setLineWidth(p.size * 0.6)
      for i = 1, #p.trail - 1 do
        local alpha = (1 - i / #p.trail) * 0.5
        love.graphics.setColor(r, g, b, alpha)
        love.graphics.line(p.trail[i][1], p.trail[i][2], p.trail[i + 1][1], p.trail[i + 1][2])
      end
    end

    -- Particle head
    love.graphics.setColor(r, g, b, 0.8)
    love.graphics.circle("fill", p.x, p.y, p.size)
  end
end

Effects.register("FlowParticles", FlowParticles)

return FlowParticles
