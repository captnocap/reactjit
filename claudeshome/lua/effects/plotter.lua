--[[
  effects/plotter.lua — Single continuous pen-plotter line

  One line that never lifts. It wanders the canvas driven by noise,
  wave modulation, and spiral tendencies. The path accumulates over time
  creating intricate patterns like a pen plotter drawing.

  React usage:
    <Plotter />
    <Plotter speed={1.5} />
    <Plotter reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt, max, min = math.random, math.floor, math.sqrt, math.max, math.min
local noise = love.math.noise

local Plotter = {}

local MAX_POINTS = 30000

function Plotter.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local startX = w / 2
  local startY = h / 2

  return {
    time = 0,
    points = {{x = startX, y = startY, hue = 0.5}},
    penX = startX,
    penY = startY,
    angle = random() * pi * 2,
    noiseOffset = random() * 1000,
    spiralAngle = 0,
    wavePhase = 0,
    baseSpeed = 3,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    strokeWidth = 1,
  }
end

function Plotter.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.02)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)
  local infinite = Util.boolProp(props, "infinite", false)

  state.time = state.time + dt * speed
  state.decay = decay
  local t = state.time

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.2, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Self-modulate audio-like signals
  local bass = (sin(t * 0.4) + 1) * 0.5
  local mid = (sin(t * 0.25 + 1.5) + 1) * 0.5
  local high = (sin(t * 0.6 + 3.0) + 1) * 0.5
  local amp = (sin(t * 0.7) + 1) * 0.35 + 0.15

  if reactive then
    state.decay = Util.lerp(0.06, decay, state.reactiveIntensity)
  end

  -- Movement speed
  local moveSpeed = state.baseSpeed * (0.5 + amp * 2) * speed * reactMul

  -- Add multiple points per frame for continuous drawing
  local pointsPerFrame = max(1, floor(moveSpeed * 2))

  for step = 1, pointsPerFrame do
    -- 1. Base flow — noise wandering
    local noiseAngle = noise(
      state.penX * 0.003 + state.noiseOffset,
      state.penY * 0.003,
      t * 0.1
    ) * pi * 4

    -- 2. Spiral tendency on beats
    local isBeat = beat
    if not beat and not reactive then
      isBeat = sin(t * pi * 0.8 + step * 0.01) > 0.95
    end
    if isBeat or (reactive and mouse and mouse.speed > 200) then
      state.spiralAngle = state.spiralAngle + 0.3 * amp
    end
    local spiralInfluence = sin(state.spiralAngle) * 0.5

    -- 3. Wave modulation from bass
    state.wavePhase = state.wavePhase + bass * 0.15 * dt * 60
    local waveInfluence = sin(state.wavePhase) * bass * 20

    -- 4. High frequency jitter
    local jitterX = (random() - 0.5) * high * 15
    local jitterY = (random() - 0.5) * high * 15

    -- 5. Pull dynamics
    local centerX = w / 2
    local centerY = h / 2
    local pullX, pullY = 0, 0

    if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
      -- Pull toward mouse
      local mdx = mouse.x - state.penX
      local mdy = mouse.y - state.penY
      local mDist = sqrt(mdx * mdx + mdy * mdy) + 0.001
      pullX = (mdx / mDist) * state.reactiveIntensity * 2
      pullY = (mdy / mDist) * state.reactiveIntensity * 2
    else
      -- Subtle center pull on bass
      if bass > 0.5 then
        pullX = (centerX - state.penX) * 0.01 * bass
        pullY = (centerY - state.penY) * 0.01 * bass
      end
    end

    -- Combine
    state.angle = noiseAngle + spiralInfluence

    local stepSpeed = moveSpeed / pointsPerFrame
    local moveX = cos(state.angle) * stepSpeed + jitterX * dt * 60 + pullX + cos(state.wavePhase) * waveInfluence * 0.05
    local moveY = sin(state.angle) * stepSpeed + jitterY * dt * 60 + pullY + sin(state.wavePhase) * waveInfluence * 0.05

    state.penX = state.penX + moveX
    state.penY = state.penY + moveY

    -- Boundary bounce
    local margin = 30
    if state.penX < margin then
      state.penX = margin
      state.angle = pi - state.angle
    end
    if state.penX > w - margin then
      state.penX = w - margin
      state.angle = pi - state.angle
    end
    if state.penY < margin then
      state.penY = margin
      state.angle = -state.angle
    end
    if state.penY > h - margin then
      state.penY = h - margin
      state.angle = -state.angle
    end

    -- Add point
    table.insert(state.points, {
      x = state.penX,
      y = state.penY,
      hue = state.hue,
      amp = amp,
    })
  end

  -- Limit points
  if #state.points > MAX_POINTS then
    local trimmed = {}
    for i = #state.points - MAX_POINTS + 1, #state.points do
      table.insert(trimmed, state.points[i])
    end
    state.points = trimmed
  end

  state.noiseOffset = state.noiseOffset + 0.01 * speed
  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Plotter.draw(state, w, h)
  -- Subtle trail fade
  love.graphics.setColor(0.03, 0.03, 0.05, state.decay or 0.02)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local points = state.points
  if #points < 2 then return end

  -- Draw path in segments for color variation
  local segSize = 80
  love.graphics.setLineWidth(1.2)

  for start = 1, #points - 1, segSize do
    local endIdx = min(start + segSize, #points)

    -- Get color from midpoint
    local midIdx = floor((start + endIdx) / 2)
    local midPt = points[midIdx]
    local r, g, b = Util.hslToRgb(midPt.hue, 0.7, 0.55)
    local lineWidth = 0.8 + (midPt.amp or 0.3) * 1.5

    love.graphics.setColor(r, g, b, 0.75)
    love.graphics.setLineWidth(lineWidth)

    -- Build line segment
    local flat = {}
    for i = start, endIdx do
      table.insert(flat, points[i].x)
      table.insert(flat, points[i].y)
    end

    if #flat >= 4 then
      love.graphics.line(flat)
    end
  end

  -- Draw pen position
  love.graphics.setColor(1, 1, 1, 0.9)
  love.graphics.circle("fill", state.penX, state.penY, 3)
  love.graphics.setColor(1, 1, 1, 0.3)
  love.graphics.circle("fill", state.penX, state.penY, 8)
end

Effects.register("Plotter", Plotter)

return Plotter
