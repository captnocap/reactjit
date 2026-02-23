--[[
  masks/crt.lua — CRT monitor post-processing mask

  Barrel distortion, scanlines, vignette, RGB phosphor offset, and flicker.

  React usage:
    <CRT mask />
    <CRT mask curvature={0.4} scanlineIntensity={0.3} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, min, max = math.floor, math.min, math.max
local sin, cos = math.sin, math.cos
local sqrt, abs = math.sqrt, math.abs
local noise = love.math.noise

local CRT = {}

function CRT.create(w, h, props)
  return {
    time = 0,
    flicker = 1.0,
  }
end

function CRT.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  -- Subtle flicker
  local flickerAmt = Util.prop(props, "flicker", 0.03)
  state.flicker = 1.0 - flickerAmt * noise(42.7, state.time * 8.0)
end

function CRT.draw(state, w, h, source)
  local curvature = Util.prop(state.props or {}, "curvature", 0.3)
  local scanIntensity = Util.prop(state.props or {}, "scanlineIntensity", 0.25)
  local rgbShift = Util.prop(state.props or {}, "rgbShift", 1.5)
  local vignetteStr = Util.prop(state.props or {}, "vignette", 0.4)
  local t = state.time

  -- Draw source with slight color channel offsets for RGB phosphor effect
  -- Red channel shifted left
  love.graphics.setColor(1, 0, 0, 0.34 * state.flicker)
  love.graphics.draw(source, -rgbShift, 0)

  -- Green channel center (full)
  love.graphics.setColor(0, 1, 0, 0.34 * state.flicker)
  love.graphics.draw(source, 0, 0)

  -- Blue channel shifted right
  love.graphics.setColor(0, 0, 1, 0.34 * state.flicker)
  love.graphics.draw(source, rgbShift, 0)

  -- Full source on top for proper color
  love.graphics.setColor(1, 1, 1, 0.7 * state.flicker)
  love.graphics.draw(source, 0, 0)

  -- Scanlines
  local spacing = 2
  local scrollOffset = (t * 15) % (spacing * 2)
  for y = scrollOffset, h, spacing * 2 do
    local yy = floor(y)
    if yy >= 0 and yy < h then
      love.graphics.setColor(0, 0, 0, scanIntensity)
      love.graphics.rectangle("fill", 0, yy, w, 1)
    end
  end

  -- Phosphor dot grid (subtle)
  local dotSpacing = 3
  local dotAlpha = scanIntensity * 0.15
  if dotAlpha > 0.01 then
    for gx = 0, w, dotSpacing do
      for gy = 0, h, dotSpacing do
        love.graphics.setColor(0, 0, 0, dotAlpha)
        love.graphics.rectangle("fill", gx, gy, 1, 1)
      end
    end
  end

  -- Rolling horizontal sync bar
  local barY = ((t * 45) % (h + 60)) - 30
  local barH = 8 + sin(t * 2.3) * 4
  love.graphics.setColor(1, 1, 1, 0.03 + sin(t * 1.7) * 0.015)
  love.graphics.rectangle("fill", 0, barY, w, max(2, floor(barH)))

  -- Vignette (darken edges)
  local cx, cy = w * 0.5, h * 0.5
  local maxDist = sqrt(cx * cx + cy * cy)

  -- Top and bottom heavy vignette bands
  local bandH = floor(h * 0.12 * vignetteStr)
  for i = 0, bandH do
    local alpha = (1 - i / max(1, bandH)) * vignetteStr * 0.6
    love.graphics.setColor(0, 0, 0, alpha)
    love.graphics.rectangle("fill", 0, i, w, 1)
    love.graphics.rectangle("fill", 0, h - 1 - i, w, 1)
  end

  -- Left and right vignette bands
  local bandW = floor(w * 0.08 * vignetteStr)
  for i = 0, bandW do
    local alpha = (1 - i / max(1, bandW)) * vignetteStr * 0.4
    love.graphics.setColor(0, 0, 0, alpha)
    love.graphics.rectangle("fill", i, 0, 1, h)
    love.graphics.rectangle("fill", w - 1 - i, 0, 1, h)
  end

  -- Corner darkening (circular vignette approximation)
  local cornerR = min(w, h) * 0.15 * vignetteStr
  for corner = 1, 4 do
    local ox = (corner <= 2) and 0 or w
    local oy = (corner % 2 == 1) and 0 or h
    for r = 0, floor(cornerR) do
      local alpha = (1 - r / max(1, cornerR)) * vignetteStr * 0.35
      love.graphics.setColor(0, 0, 0, alpha)
      love.graphics.circle("fill", ox, oy, cornerR - r)
    end
  end

  -- CRT curvature: darken edges more aggressively to simulate barrel
  if curvature > 0 then
    local edgeDarken = curvature * 0.2
    -- Horizontal curvature bands (top/bottom darken more at center-x)
    for y = 0, floor(h * 0.05 * curvature) do
      local prog = 1 - y / max(1, floor(h * 0.05 * curvature))
      love.graphics.setColor(0, 0, 0, prog * edgeDarken)
      love.graphics.rectangle("fill", 0, y, w, 1)
      love.graphics.rectangle("fill", 0, h - 1 - y, w, 1)
    end
  end

  -- Subtle green phosphor tint
  love.graphics.setColor(0.1, 0.3, 0.1, 0.02 * state.flicker)
  love.graphics.rectangle("fill", 0, 0, w, h)
end

Masks.register("CRT", CRT)

return CRT
