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
local sin = math.sin
local random = math.random
local noise = love.math.noise

local VHS = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

-- Parse #RGB, #RRGGBB, or #RRGGBBAA tint strings.
local function parseTint(tint)
  if type(tint) ~= "string" then return nil end
  local hex = tint:gsub("^#", "")
  if #hex == 3 then
    local r = tonumber(hex:sub(1, 1) .. hex:sub(1, 1), 16)
    local g = tonumber(hex:sub(2, 2) .. hex:sub(2, 2), 16)
    local b = tonumber(hex:sub(3, 3) .. hex:sub(3, 3), 16)
    if r and g and b then return r / 255, g / 255, b / 255 end
    return nil
  end
  if #hex ~= 6 and #hex ~= 8 then return nil end
  local r = tonumber(hex:sub(1, 2), 16)
  local g = tonumber(hex:sub(3, 4), 16)
  local b = tonumber(hex:sub(5, 6), 16)
  if not r or not g or not b then return nil end
  return r / 255, g / 255, b / 255
end

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
  local jitterAmt = tracking * 12
  state.jitterX = (noise(state.time * 12, 7.3) - 0.5) * jitterAmt

  -- Tracking drift
  state.trackingOffset = sin(state.time * 0.7) * tracking * 8 + noise(state.time * 2.1, 3.7) * tracking * 5

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
  local props = state.props or {}
  local tracking = clamp(Util.prop(props, "tracking", 0.3), 0, 1)
  local noiseAmt = clamp(Util.prop(props, "noise", 0.2), 0, 1)
  local colorBleed = max(0, Util.prop(props, "colorBleed", 2.0))
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local tr, tg, tb = parseTint(props.tint)
  local t = state.time

  -- Keep the original captured content intact as the base, offset by the tracking drift.
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, state.trackingOffset, 0)

  if effectMix <= 0 then
    return
  end

  -- Horizontal jitter ghost (overlay only, not replacement).
  love.graphics.setColor(1, 1, 1, (0.15 + tracking * 0.2) * effectMix)
  love.graphics.draw(source, state.jitterX, 0)

  -- Color bleed: additive edge fringing around the base image.
  if colorBleed > 0.01 then
    local bleedAlpha = (0.1 + tracking * 0.15 + min(0.1, colorBleed * 0.05)) * effectMix
    love.graphics.setBlendMode("add")
    if tr then
      love.graphics.setColor(tr, tg, tb, bleedAlpha * 1.3)
    else
      love.graphics.setColor(1, 0.2, 0.12, bleedAlpha)
    end
    love.graphics.draw(source, colorBleed + 1 + state.jitterX * 0.8, 0)
    if tr then
      love.graphics.setColor(tr * 0.7 + 0.3, tg * 0.45, min(1, tb * 0.9 + 0.2), bleedAlpha)
    else
      love.graphics.setColor(0.12, 0.35, 1, bleedAlpha * 0.85)
    end
    love.graphics.draw(source, -colorBleed - 1 + state.jitterX * 0.4, 0)
    love.graphics.setBlendMode("alpha")
  end

  -- Tracking lines (horizontal bands of distortion)
  local trackCount = max(1, floor(1 + tracking * 6 * effectMix))
  for i = 1, trackCount do
    local ty = ((t * 40 + i * h / trackCount) % (h + 20)) - 10
    local th = max(1, 3 + floor(noise(i * 3.1, t * 1.5) * 12 * tracking))
    local shift = (noise(i * 2.7, t * 3) - 0.5) * 35 * tracking * effectMix
    -- Draw only a thin strip at each tracking line position.
    love.graphics.setScissor(0, floor(ty), w, max(1, th))
    love.graphics.setColor(1, 1, 1, (0.7 + tracking * 0.3) * effectMix)
    love.graphics.draw(source, shift, 0)
    love.graphics.setScissor()
  end

  -- Noise lines (horizontal static bursts)
  for _, nl in ipairs(state.noiseLines) do
    local alpha = nl.intensity * noiseAmt * 0.8 * min(1, nl.life * 10) * effectMix
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.rectangle("fill", 0, floor(nl.y), w, nl.width)
  end

  -- Static noise overlay (sparse dots)
  local dotCount = floor(w * h * 0.001 * noiseAmt * effectMix)
  for i = 1, dotCount do
    local dx = random() * w
    local dy = random() * h
    local brightness = 0.5 + random() * 0.5
    love.graphics.setColor(brightness, brightness, brightness, noiseAmt * 0.5 * effectMix)
    love.graphics.rectangle("fill", floor(dx), floor(dy), 1, 1)
  end

  if state.headSwitchY < h + 20 and state.headSwitchY > h * 0.7 then
    local switchH = 8 + floor(tracking * 16)
    local switchY = floor(state.headSwitchY)
    love.graphics.setScissor(0, switchY, w, switchH)
    local shift = (16 + tracking * 30) * (sin(t * 30) > 0 and 1 or -1)
    love.graphics.setColor(1, 1, 1, (0.8 + tracking * 0.2) * effectMix)
    love.graphics.draw(source, shift, 0)
    love.graphics.setScissor()
    -- White line at switch point
    love.graphics.setColor(1, 1, 1, 0.15 * tracking * effectMix)
    love.graphics.rectangle("fill", 0, switchY, w, 1)
  end

  -- Slight overall warm tint as additive bloom, not darkening.
  love.graphics.setBlendMode("add")
  if tr then
    love.graphics.setColor(tr, tg, tb, (0.3 + tracking * 0.3) * effectMix)
  else
    love.graphics.setColor(0.12, 0.06, 0.02, (0.15 + tracking * 0.15) * effectMix)
  end
  love.graphics.rectangle("fill", 0, 0, w, h)
  love.graphics.setBlendMode("alpha")
end

Masks.register("VHS", VHS)

return VHS
