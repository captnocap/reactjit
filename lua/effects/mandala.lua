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

function Mandala.create(w, h, props)
  return {
    time = 0,
    slices = {},
    currentRadius = 10,
    rotationOffset = random() * pi * 2,
    hue = random(),
    cleared = false,
    spawnAccum = 0,
    cx = w / 2,
    cy = h / 2,
    maxRadius = math.min(w, h) * 0.48,
    reactiveIntensity = 0,
  }
end

function Mandala.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.005)
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
    state.decay = Util.lerp(0.06, decay, state.reactiveIntensity)
  else
    state.decay = decay
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

  local spawnRate = (0.3 + amp * 1.5) * speed
  if reactive then
    if mouse and mouse.inside then
      spawnRate = spawnRate + mouse.speed * 0.005 * state.reactiveIntensity
    end
    spawnRate = spawnRate * state.reactiveIntensity
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  local shouldSpawnAmbient = state.spawnAccum >= 1
  if shouldSpawnAmbient then
    state.spawnAccum = state.spawnAccum - 1
  end

  if (isBeat or shouldSpawnAmbient) and #state.slices < MAX_SLICES and reactMul > 0.05 then
    local sliceCount = isBeat and (8 + floor(random() * 8)) or (4 + floor(random() * 4))
    local thickness = isBeat and (5 + amp * 15 + random() * 5) or (3 + amp * 8)
    local startRadius = state.currentRadius
    local endRadius = startRadius + thickness

    local segAngle = pi * 2 / sliceCount
    local fillRatio = 0.75 + random() * 0.2

    for i = 0, sliceCount - 1 do
      local sliceAngle = i * segAngle + state.rotationOffset
      local sliceWidth = segAngle * fillRatio
      local sliceHue = (state.hue + i / sliceCount * 0.3 + random() * 0.05) % 1
      local sliceSat = 0.55 + amp * 0.35
      local sliceLit = 0.35 + amp * 0.25

      table.insert(state.slices, {
        startAngle = sliceAngle,
        endAngle = sliceAngle + sliceWidth,
        innerRadius = startRadius,
        outerRadius = endRadius,
        hue = sliceHue,
        sat = sliceSat,
        lit = sliceLit,
        alpha = 0.8 * reactMul,
        age = 0,
        maxAge = 12 + random() * 8,
      })
    end

    state.currentRadius = endRadius + 1
    if state.currentRadius > state.maxRadius then
      state.currentRadius = 10
    end
  end

  -- Age and cull slices
  local alive = {}
  for _, slice in ipairs(state.slices) do
    slice.age = slice.age + dt
    if slice.age < slice.maxAge then
      if slice.age > slice.maxAge - 2 then
        slice.alpha = slice.alpha * (1 - dt * 0.5)
      end
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
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.005)
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
