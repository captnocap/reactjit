--[[
  masks/scanlines.lua — Horizontal scanline overlay mask

  React usage:
    <Scanlines mask />
    <Scanlines mask intensity={0.4} spacing={3} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max

local Scanlines = {}

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

function Scanlines.create(w, h, props)
  return {
    time = 0,
  }
end

function Scanlines.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Scanlines.draw(state, w, h, source)
  local props = state.props or {}
  local intensity = clamp(Util.prop(props, "intensity", 0.3), 0, 1)
  local spacing = max(1, floor(Util.prop(props, "spacing", 2)))
  local tint = props.tint -- optional color tint (#RRGGBB)
  local scroll = Util.boolProp(props, "scroll", true)

  -- Draw the source content first
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  local offset = 0
  if scroll then
    offset = (state.time * 30) % (spacing * 2)
  end

  local lineHeight = max(1, floor(spacing * 0.35))
  local darkAlpha = 0.15 + intensity * 0.2
  local glowAlpha = 0.15 + intensity * 0.2

  -- Very light scanline contrast (non-occluding).
  love.graphics.setBlendMode("alpha")
  love.graphics.setColor(0, 0, 0, darkAlpha)
  for y = -spacing + offset, h, spacing * 2 do
    local yy = floor(y)
    if yy >= 0 and yy < h then
      love.graphics.rectangle("fill", 0, yy, w, lineHeight)
    end
  end

  -- Soft additive glow for line texture.
  love.graphics.setBlendMode("add")
  love.graphics.setColor(0.08, 0.14, 0.22, glowAlpha)
  for y = -spacing + offset, h, spacing * 2 do
    local yy = floor(y)
    if yy >= 0 and yy < h then
      love.graphics.rectangle("fill", 0, yy, w, lineHeight)
    end
  end

  -- Optional tint glow that sits on top of scanlines.
  local tr, tg, tb = parseTint(tint)
  if tr then
    local tintAlpha = glowAlpha * 0.7
    love.graphics.setColor(tr, tg, tb, tintAlpha)
    for y = -spacing + offset, h, spacing * 2 do
      local yy = floor(y)
      if yy >= 0 and yy < h then
        love.graphics.rectangle("fill", 0, yy, w, lineHeight)
      end
    end
  end
  love.graphics.setBlendMode("alpha")

  -- Minimal edge shading so visibility remains high.
  local vignetteIntensity = intensity * 0.3
  love.graphics.setColor(0, 0, 0, vignetteIntensity)
  love.graphics.rectangle("fill", 0, 0, w, max(1, floor(h * 0.02)))
  love.graphics.rectangle("fill", 0, h - max(1, floor(h * 0.02)), w, max(1, floor(h * 0.02)))
end

Masks.register("Scanlines", Scanlines)

return Scanlines
