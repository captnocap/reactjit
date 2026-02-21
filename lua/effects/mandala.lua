--[[
  effects/mandala.lua — Radial sector slices building a tree-ring timeline

  Concentric rings of colored arc sectors spawn from center outward,
  creating mandala-like patterns that build up over time.

  React usage:
    <Mandala />
    <Mandala speed={0.8} decay={0.005} />
    <Mandala beat={onBeat} amplitude={amp} />
    <Mandala background />
    <Mandala infinite />
    <Mandala reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor = math.random, math.floor
local noise = love.math.noise

local Mandala = {}

local MAX_SLICES = 500

local function spawnRing(state, amp, sliceCount, thickness, forceAlpha)
  local startRadius = state.currentRadius
  local endRadius = startRadius + thickness
  local segAngle = pi * 2 / sliceCount
  local fillRatio = 0.72 + random() * 0.22

  for i = 0, sliceCount - 1 do
    local sliceAngle = i * segAngle + state.rotationOffset
    local sliceWidth = segAngle * fillRatio
    local sliceHue = (state.hue + i / sliceCount * 0.28 + random() * 0.05) % 1
    local sliceSat = 0.55 + amp * 0.35
    local sliceLit = 0.36 + amp * 0.24

    table.insert(state.slices, {
      startAngle = sliceAngle,
      endAngle = sliceAngle + sliceWidth,
      innerRadius = startRadius,
      outerRadius = endRadius,
      hue = sliceHue,
      sat = sliceSat,
      lit = sliceLit,
      alpha = forceAlpha or 0.78,
      age = 0,
      maxAge = 4.2 + random() * 3.2,
      spin = (random() - 0.5) * 0.2,
      radialDrift = (random() - 0.5) * 0.5,
    })
  end

  state.currentRadius = endRadius + 0.8
  if state.currentRadius > state.maxRadius then
    state.currentRadius = 8 + random() * 6
  end
end

function Mandala.create(w, h, props)
  local state = {
    time = 0,
    slices = {},
    currentRadius = 8,
    rotationOffset = random() * pi * 2,
    hue = random(),
    cleared = false,
    spawnAccum = 1.2,
    cx = w / 2,
    cy = h / 2,
    maxRadius = math.min(w, h) * 0.48,
    reactiveIntensity = 0,
    decay = Util.clamp(Util.prop(props, "decay", 0.07), 0.03, 0.26),
  }
  for _ = 1, 3 do
    spawnRing(state, 0.42 + random() * 0.2, 6 + floor(random() * 5), 4 + random() * 5, 0.7)
  end
  return state
end

function Mandala.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.07)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local infinite = Util.boolProp(props, "infinite", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.maxRadius = math.min(w, h) * 0.48

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

  -- Center: reactive follows mouse, infinite drifts
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    state.cx = Util.lerp(state.cx, mouse.x, dt * 5)
    state.cy = Util.lerp(state.cy, mouse.y, dt * 5)
  elseif infinite then
    local driftX = (noise(t * 0.06, 0) - 0.5) * w * 0.3
    local driftY = (noise(0, t * 0.06) - 0.5) * h * 0.3
    state.cx = w / 2 + driftX
    state.cy = h / 2 + driftY
  else
    state.cx = w / 2
    state.cy = h / 2
  end

  if reactive then
    state.decay = Util.lerp(0.12, Util.clamp(decay, 0.03, 0.26), state.reactiveIntensity)
  else
    state.decay = Util.clamp(decay, 0.03, 0.26)
  end

  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)
  amp = amp * reactMul

  -- Rotation: infinite slowly accelerates, reactive driven by mouse speed
  local rotSpeed = 0.002 * speed
  if reactive and mouse and mouse.inside then
    rotSpeed = rotSpeed + mouse.speed * 0.00005 * state.reactiveIntensity
  end
  if infinite then
    rotSpeed = rotSpeed * (1 + sin(t * 0.1) * 0.5)
  end
  state.rotationOffset = state.rotationOffset + rotSpeed

  -- Spawn check
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.7) > 0.92
  end

  local spawnRate = (2.4 + amp * 4.6) * speed
  if reactive then
    if mouse and mouse.inside then
      spawnRate = spawnRate + mouse.speed * 0.01 * state.reactiveIntensity
    end
    spawnRate = spawnRate * state.reactiveIntensity
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  local spawnedAmbient = 0
  while state.spawnAccum >= 1 and #state.slices < MAX_SLICES do
    state.spawnAccum = state.spawnAccum - 1
    local sliceCount = 5 + floor(random() * 5 + amp * 6)
    local thickness = 2 + amp * 8 + random() * 4
    spawnRing(state, amp, sliceCount, thickness, 0.58 + amp * 0.26)
    spawnedAmbient = spawnedAmbient + 1
    if spawnedAmbient >= 2 then break end
  end

  if isBeat and #state.slices < MAX_SLICES and reactMul > 0.05 then
    local burstLayers = 1 + floor(amp * 2.8)
    for _ = 1, burstLayers do
      if #state.slices >= MAX_SLICES then break end
      local sliceCount = 8 + floor(random() * 8 + amp * 6)
      local thickness = 4 + amp * 12 + random() * 4
      spawnRing(state, amp, sliceCount, thickness, 0.74 + amp * 0.22)
    end
  end

  -- Age and cull slices
  local alive = {}
  for _, slice in ipairs(state.slices) do
    slice.age = slice.age + dt
    slice.startAngle = slice.startAngle + slice.spin * dt
    slice.endAngle = slice.endAngle + slice.spin * dt
    slice.innerRadius = max(2, slice.innerRadius + slice.radialDrift * dt * 10)
    slice.outerRadius = max(slice.innerRadius + 1, slice.outerRadius + slice.radialDrift * dt * 10)

    if slice.age < slice.maxAge then
      local life = 1 - slice.age / slice.maxAge
      slice.alpha = max(0, min(1, slice.alpha * (1 - dt * 0.35) * (0.8 + life * 0.25)))
      table.insert(alive, slice)
    end
  end
  state.slices = alive

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Mandala.draw(state, w, h)
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.07)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  local cx, cy = state.cx, state.cy

  love.graphics.push()
  love.graphics.translate(cx, cy)

  for _, slice in ipairs(state.slices) do
    local r, g, b = Util.hslToRgb(slice.hue, slice.sat, slice.lit)
    love.graphics.setColor(r, g, b, slice.alpha)

    local segments = 12
    local angleStep = (slice.endAngle - slice.startAngle) / segments
    local verts = {}

    for i = 0, segments do
      local a = slice.startAngle + i * angleStep
      table.insert(verts, cos(a) * slice.outerRadius)
      table.insert(verts, sin(a) * slice.outerRadius)
    end

    for i = segments, 0, -1 do
      local a = slice.startAngle + i * angleStep
      table.insert(verts, cos(a) * slice.innerRadius)
      table.insert(verts, sin(a) * slice.innerRadius)
    end

    if #verts >= 6 then
      love.graphics.polygon("fill", verts)
    end
  end

  love.graphics.pop()
end

Effects.register("Mandala", Mandala)

return Mandala
