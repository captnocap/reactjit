--[[
  masks/scanlines.lua — Horizontal scanline overlay mask

  React usage:
    <Scanlines mask />
    <Scanlines mask intensity={0.4} spacing={3} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, min, max = math.floor, math.min, math.max
local sin = math.sin

local Scanlines = {}

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
  -- Draw the source content first
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  local props = state.props or {}
  local intensity = Util.prop(props, "intensity", 0.3)
  local spacing = Util.prop(props, "spacing", 2)
  local tint = props.tint -- optional color tint
  local scroll = Util.boolProp(props, "scroll", true)

  local offset = 0
  if scroll then
    offset = (state.time * 30) % (spacing * 2)
  end

  -- Draw scanlines
  local tr, tg, tb = 0, 0, 0
  if type(tint) == "string" then
    -- Simple hex parse for tint
    tr, tg, tb = 0.1, 0.2, 0.1  -- default green tint
  end

  for y = -spacing + offset, h, spacing * 2 do
    local yy = floor(y)
    if yy >= 0 and yy < h then
      love.graphics.setColor(tr, tg, tb, intensity)
      love.graphics.rectangle("fill", 0, yy, w, max(1, floor(spacing * 0.5)))
    end
  end

  -- Subtle vignette at edges
  local vignetteIntensity = intensity * 0.3
  love.graphics.setColor(0, 0, 0, vignetteIntensity)
  love.graphics.rectangle("fill", 0, 0, w, max(1, floor(h * 0.02)))
  love.graphics.rectangle("fill", 0, h - max(1, floor(h * 0.02)), w, max(1, floor(h * 0.02)))
end

Masks.register("Scanlines", Scanlines)

return Scanlines
