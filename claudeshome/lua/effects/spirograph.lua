--[[
  effects/spirograph.lua — Parametric spirograph curves

  Classical hypotrochoid/epitrochoid mathematical curves that self-animate
  via continuous rotation. Driven by time with sensible defaults; optional
  props override internal values for external control (audio, gamepad, etc).

  React usage:
    <Spirograph />
    <Spirograph speed={1.5} decay={0.03} chaos={0.5} />
    <Spirograph bass={bassValue} mid={midValue} high={highValue} beat={onBeat} />
    <Spirograph background />
    <Spirograph infinite />
    <Spirograph reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local floor, random = math.floor, math.random
local noise = love.math.noise

local Spirograph = {}

function Spirograph.create(w, h, props)
  local cx, cy = w / 2, h / 2
  local scale = math.min(w, h) * 0.35

  return {
    time = 0,
    angle = 0,
    -- Spirograph parameters (will be modulated)
    R1 = scale * 0.8,
    R2 = scale * 0.35,
    d  = scale * 0.45,
    -- Drawing state
    prevX = nil,
    prevY = nil,
    cx = cx,
    cy = cy,
    scale = scale,
    lineWidth = 1.5,
    hue = random() * 1.0,
    cleared = false,
    -- Infinite pan state
    panX = 0,
    panY = 0,
    -- Reactive state
    reactiveIntensity = 0,
    mouseTrailX = nil,
    mouseTrailY = nil,
  }
end

function Spirograph.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local chaos = Util.prop(props, "chaos", 0.3)
  local decay = Util.prop(props, "decay", 0.03)
  local infinite = Util.boolProp(props, "infinite", false)
  local reactive = Util.boolProp(props, "reactive", false)

  local bass = Util.prop(props, "bass", nil)
  local mid  = Util.prop(props, "mid", nil)
  local high = Util.prop(props, "high", nil)
  local beat = Util.boolProp(props, "beat", false)

  state.time = state.time + dt * speed
  local t = state.time

  -- Infinite canvas: drift center through noise-driven wandering path
  if infinite then
    local propPanX = Util.prop(props, "panX", nil)
    local propPanY = Util.prop(props, "panY", nil)
    if propPanX then
      state.panX = propPanX
      state.panY = propPanY or 0
    else
      state.panX = state.panX + dt * 20 * speed
      state.panY = state.panY + dt * 8 * speed
    end
  else
    state.panX = 0
    state.panY = 0
  end

  -- Reactive mode: intensity ramps with mouse activity
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end

  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Update center
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    -- Center follows mouse
    state.cx = Util.lerp(state.cx, mouse.x, dt * 5)
    state.cy = Util.lerp(state.cy, mouse.y, dt * 5)
  else
    -- Infinite: wander via noise; normal: center of canvas
    local baseCx = w / 2 + state.panX
    local baseCy = h / 2 + state.panY
    if infinite then
      local driftX = (noise(t * 0.1, 0) - 0.5) * w * 0.4
      local driftY = (noise(0, t * 0.1) - 0.5) * h * 0.4
      state.cx = w / 2 + driftX
      state.cy = h / 2 + driftY
    else
      state.cx = w / 2
      state.cy = h / 2
    end
  end

  state.scale = math.min(w, h) * 0.35
  local sc = state.scale

  -- Derive R1, R2, d
  if bass then
    state.R1 = sc * (0.6 + bass * 0.8)
  else
    state.R1 = sc * (0.6 + (sin(t * 0.23) + 1) * 0.4) * (0.3 + reactMul * 0.7)
  end

  if mid then
    state.R2 = sc * (0.3 + mid * 0.7)
  else
    state.R2 = sc * (0.3 + (sin(t * 0.31 + 1.2) + 1) * 0.35) * (0.3 + reactMul * 0.7)
  end

  if high then
    state.d = sc * (0.2 + high * 0.8)
  else
    state.d = sc * (0.2 + (sin(t * 0.41 + 2.5) + 1) * 0.4) * (0.3 + reactMul * 0.7)
  end

  -- Rotation speed — reactive: mouse speed drives rotation
  local rotSpeed = (0.015 + chaos * 0.03) * speed
  if reactive and mouse and mouse.inside then
    rotSpeed = rotSpeed + mouse.speed * 0.0001 * state.reactiveIntensity
  end
  state.angle = state.angle + rotSpeed * reactMul

  if beat then
    state.angle = state.angle + 0.3 + chaos * 0.5
  end

  local amp = bass and (bass * 0.5 + (mid or 0.5) * 0.3 + (high or 0.5) * 0.2)
              or (sin(t * 0.7) + 1) * 0.35 + 0.3
  state.lineWidth = (0.8 + amp * 2.5) * (0.3 + reactMul * 0.7)

  if bass then
    state.hue = (state.hue + dt * 0.05) % 1
  else
    state.hue = (state.hue + dt * 0.02 * speed) % 1
  end

  -- Reactive: faster decay when dormant
  if reactive then
    state.decay = Util.lerp(0.15, decay, state.reactiveIntensity)
  else
    state.decay = decay
  end
end

function Spirograph.draw(state, w, h)
  local R = state.R1
  local r = state.R2
  local d = state.d
  local cx, cy = state.cx, state.cy
  local angle = state.angle
  local reactMul = state.reactiveIntensity or 1

  -- Background decay
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  if r < 1 then r = 1 end
  local ratio = (R - r) / r

  -- Fewer steps when reactive and dim
  local stepsPerFrame = floor(120 * (0.2 + reactMul * 0.8))
  if stepsPerFrame < 10 then stepsPerFrame = 10 end
  local stepDt = 0.02
  love.graphics.setLineWidth(state.lineWidth)

  for i = 0, stepsPerFrame - 1 do
    local t = angle + i * stepDt
    local x = cx + (R - r) * cos(t) + d * cos(ratio * t)
    local y = cy + (R - r) * sin(t) - d * sin(ratio * t)

    if state.prevX and state.prevY then
      local segHue = (state.hue + i / stepsPerFrame * 0.15) % 1
      local segSat = 0.7 + (sin(t * 0.5) + 1) * 0.15
      local segLit = 0.45 + (sin(t * 0.3 + 1) + 1) * 0.15
      local cr, cg, cb = Util.hslToRgb(segHue, segSat, segLit)
      love.graphics.setColor(cr, cg, cb, 0.85 * (0.1 + reactMul * 0.9))
      love.graphics.line(state.prevX, state.prevY, x, y)
    end

    state.prevX = x
    state.prevY = y
  end

  state.angle = state.angle + stepsPerFrame * stepDt

  local glowR, glowG, glowB = Util.hslToRgb(state.hue, 0.9, 0.6)
  love.graphics.setColor(glowR, glowG, glowB, 0.4 * reactMul)
  love.graphics.circle("fill", state.prevX or cx, state.prevY or cy, 4)
end

Effects.register("Spirograph", Spirograph)

return Spirograph
