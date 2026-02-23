--[[
  masks/vhs.lua — VHS tape playback post-processing mask

  Tracking lines, color bleed, noise bands, horizontal jitter, head switching.

  React usage:
    <VHS mask />
    <VHS mask tracking={0.5} noise={0.3} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, min, max = math.floor, math.min, math.max
local sin, cos = math.sin, math.cos
local random = math.random
local noise = love.math.noise
local abs = math.abs

local VHS = {}

function VHS.create(w, h, props)
  return {
    time = 0,
    jitterX = 0,
    trackingOffset = 0,
    headSwitchTimer = 0,
    headSwitchY = -100,
    noiseLines = {},
    props = props or {},
  }
end

function VHS.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  local tracking = Util.prop(props, "tracking", 0.3)

  -- Horizontal jitter
  local jitterAmt = tracking * 3
  state.jitterX = (noise(state.time * 12, 7.3) - 0.5) * jitterAmt

  -- Tracking drift
  state.trackingOffset = sin(state.time * 0.7) * tracking * 4 + noise(state.time * 2.1, 3.7) * tracking * 2

  -- Head switching artifact (periodic)
  state.headSwitchTimer = state.headSwitchTimer + dt
  if state.headSwitchTimer > 2.5 + random() * 3 then
    state.headSwitchTimer = 0
    state.headSwitchY = h * (0.85 + random() * 0.12)
  else
    state.headSwitchY = state.headSwitchY + dt * 200
  end

  -- Generate noise line positions
  if random() < 0.15 then
    state.noiseLines[#state.noiseLines + 1] = {
      y = random() * h,
      life = 0.05 + random() * 0.1,
      intensity = 0.3 + random() * 0.5,
      width = 1 + floor(random() * 3),
    }
  end

  -- Age noise lines
  for i = #state.noiseLines, 1, -1 do
    state.noiseLines[i].life = state.noiseLines[i].life - dt
    if state.noiseLines[i].life <= 0 then
      table.remove(state.noiseLines, i)
    end
  end
  -- Cap
  while #state.noiseLines > 12 do
    table.remove(state.noiseLines, 1)
  end
end

function VHS.draw(state, w, h, source)
  local tracking = Util.prop(state.props, "tracking", 0.3)
  local noiseAmt = Util.prop(state.props, "noise", 0.2)
  local colorBleed = Util.prop(state.props, "colorBleed", 2.0)
  local t = state.time

  -- Color bleed: draw source with slight horizontal channel offsets
  -- Red bleeds right, blue bleeds left
  love.graphics.setColor(1, 0, 0, 0.3)
  love.graphics.draw(source, colorBleed + state.jitterX, 0)
  love.graphics.setColor(0, 1, 0, 0.36)
  love.graphics.draw(source, state.jitterX * 0.5, 0)
  love.graphics.setColor(0, 0, 1, 0.3)
  love.graphics.draw(source, -colorBleed + state.jitterX, 0)

  -- Main source on top
  love.graphics.setColor(1, 1, 1, 0.68)
  love.graphics.draw(source, state.jitterX, 0)

  -- Tracking lines (horizontal bands of distortion)
  local trackCount = max(1, floor(3 * tracking))
  for i = 1, trackCount do
    local ty = ((t * 40 + i * h / trackCount) % (h + 20)) - 10
    local th = 2 + floor(noise(i * 3.1, t * 1.5) * 6 * tracking)
    local shift = (noise(i * 2.7, t * 3) - 0.5) * 12 * tracking
    love.graphics.setColor(1, 1, 1, 0.08 + tracking * 0.12)
    love.graphics.draw(source, shift, 0, 0, 1, 1, 0, -ty)
    -- Only draw thin strip at tracking line position
    love.graphics.setScissor(0, floor(ty), w, max(1, th))
    love.graphics.setColor(1, 1, 1, 0.15)
    love.graphics.draw(source, shift, 0)
    love.graphics.setScissor()
  end

  -- Noise lines (horizontal static bursts)
  for _, nl in ipairs(state.noiseLines) do
    local alpha = nl.intensity * noiseAmt * min(1, nl.life * 10)
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.rectangle("fill", 0, floor(nl.y), w, nl.width)
  end

  -- Static noise overlay (sparse dots)
  local dotCount = floor(w * h * 0.0004 * noiseAmt)
  for i = 1, dotCount do
    local dx = random() * w
    local dy = random() * h
    local brightness = 0.5 + random() * 0.5
    love.graphics.setColor(brightness, brightness, brightness, noiseAmt * 0.4)
    love.graphics.rectangle("fill", floor(dx), floor(dy), 1, 1)
  end

  -- Head switching artifact (bottom of frame distortion)
  if state.headSwitchY < h + 20 and state.headSwitchY > h * 0.7 then
    local switchH = 6 + floor(tracking * 8)
    local switchY = floor(state.headSwitchY)
    love.graphics.setScissor(0, switchY, w, switchH)
    local shift = (8 + tracking * 20) * (sin(t * 30) > 0 and 1 or -1)
    love.graphics.setColor(1, 1, 1, 0.6)
    love.graphics.draw(source, shift, 0)
    love.graphics.setScissor()
    -- White line at switch point
    love.graphics.setColor(1, 1, 1, 0.15 * tracking)
    love.graphics.rectangle("fill", 0, switchY, w, 1)
  end

  -- Slight overall desaturation / warm tint
  love.graphics.setColor(0.15, 0.08, 0.02, 0.06)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Bottom edge noise band
  love.graphics.setColor(0, 0, 0, 0.1 * tracking)
  love.graphics.rectangle("fill", 0, h - 3, w, 3)
end

Masks.register("VHS", VHS)

return VHS
