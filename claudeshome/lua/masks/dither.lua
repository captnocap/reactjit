--[[
  masks/dither.lua — Ordered dithering post-processing mask

  Applies Bayer matrix dithering to reduce the visual color palette,
  creating a retro/pixel-art aesthetic.

  React usage:
    <Dither mask />
    <Dither mask levels={4} scale={2} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max

local Dither = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

-- 4x4 Bayer matrix (normalized to 0-1)
local bayer4 = {
  { 0/16,  8/16,  2/16, 10/16 },
  { 12/16, 4/16, 14/16,  6/16 },
  { 3/16, 11/16,  1/16,  9/16 },
  { 15/16, 7/16, 13/16,  5/16 },
}

function Dither.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Dither.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Dither.draw(state, w, h, source)
  local props = state.props or {}
  local levels = max(2, floor(Util.prop(props, "levels", 4)))
  local scale = max(1, floor(Util.prop(props, "scale", 2)))
  local intensity = clamp(Util.prop(props, "intensity", 0.8), 0, 1)

  -- Base image remains intact; dither is layered as a texture overlay.
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  -- Overlay Bayer stipple: alternating subtle dark/light micro-cells.
  local step = scale
  local invLevels = 1 / max(1, levels)
  local darkStrength = 0.2 + intensity * 0.4
  local lightStrength = 0.1 + intensity * 0.25

  for y = 0, h - 1, step do
    for x = 0, w - 1, step do
      local bx = (floor(x / step) % 4) + 1
      local by = (floor(y / step) % 4) + 1
      local threshold = bayer4[by][bx]
      -- Tie strength to quantization levels: fewer levels = stronger stipple.
      local quantizeFactor = (1 - invLevels) * 0.6 + 0.4
      local centered = (threshold - 0.5) * 2 * quantizeFactor

      if centered >= 0 then
        love.graphics.setColor(0, 0, 0, centered * darkStrength)
      else
        love.graphics.setColor(1, 1, 1, -centered * lightStrength)
      end
      love.graphics.rectangle("fill", x, y, step, step)
    end
  end

  -- Optional pixel-grid accent for larger cell sizes.
  if scale >= 3 then
    local gridAlpha = intensity * 0.15
    love.graphics.setColor(0, 0, 0, gridAlpha)
    for x = 0, w, step do
      love.graphics.rectangle("fill", x, 0, 1, h)
    end
    for y = 0, h, step do
      love.graphics.rectangle("fill", 0, y, w, 1)
    end
  end
end

Masks.register("Dither", Dither)

return Dither
