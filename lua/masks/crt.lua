--[[
  masks/crt.lua — CRT monitor post-processing mask

  Barrel distortion, scanlines, vignette, RGB phosphor offset, and flicker.

  React usage:
    <CRT mask />
    <CRT mask curvature={0.4} scanlineIntensity={0.3} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max
local sin = math.sin
local noise = love.math.noise

local CRT = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

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
  local props = state.props or {}
  local curvature = clamp(Util.prop(props, "curvature", 0.3), 0, 1)
  local scanIntensity = clamp(Util.prop(props, "scanlineIntensity", 0.25), 0, 1)
  local rgbShift = max(0, Util.prop(props, "rgbShift", 1.5))
  local vignetteStr = clamp(Util.prop(props, "vignette", 0.4), 0, 1)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local t = state.time

  -- Keep the captured content fully present, then layer CRT artifacts on top.
  local mixedBase = 0.95 + (state.flicker - 1.0) * 0.2
  local baseGain = clamp(1 + (mixedBase - 1) * effectMix, 0.85, 1.05)
  love.graphics.setColor(baseGain, baseGain, baseGain, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 then
    return
  end

  -- RGB phosphor ghosting (subtle additive fringing).
  if rgbShift > 0.01 then
    local ghostAlpha = (0.08 + scanIntensity * 0.15) * state.flicker * effectMix
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 0.18, 0.18, ghostAlpha)
    love.graphics.draw(source, -rgbShift, 0)
    love.graphics.setColor(0.15, 0.45, 1, ghostAlpha * 0.9)
    love.graphics.draw(source, rgbShift, 0)
    love.graphics.setBlendMode("alpha")
  end

  -- Scanlines (light modulation only; no hard occlusion).
  local spacing = 2
  local scrollOffset = (t * 15) % (spacing * 2)
  local scanAlpha = (0.05 + scanIntensity * 0.25) * effectMix
  love.graphics.setColor(0, 0, 0, scanAlpha)
  for y = scrollOffset, h, spacing * 2 do
    local yy = floor(y)
    if yy >= 0 and yy < h then
      love.graphics.rectangle("fill", 0, yy, w, 1)
    end
  end

  -- Phosphor dot grid texture.
  local dotSpacing = 3
  local dotAlpha = scanIntensity * 0.1 * effectMix
  if dotAlpha > 0.004 then
    love.graphics.setColor(0, 0, 0, dotAlpha)
    for gx = 0, w, dotSpacing do
      for gy = 0, h, dotSpacing do
        love.graphics.rectangle("fill", gx, gy, 1, 1)
      end
    end
  end

  -- Rolling horizontal sync bar (very subtle bright sweep).
  local barY = ((t * 45) % (h + 60)) - 30
  local barH = 8 + sin(t * 2.3) * 4
  love.graphics.setBlendMode("add")
  love.graphics.setColor(0.85, 0.95, 1, max(0, (0.05 + sin(t * 1.7) * 0.03) * effectMix))
  love.graphics.rectangle("fill", 0, barY, w, max(2, floor(barH)))
  love.graphics.setBlendMode("alpha")

  -- Soft edge haze (non-blocking). Intentionally no corner circles.
  local bandH = floor(h * 0.08 * vignetteStr)
  for i = 0, bandH do
    local alpha = (1 - i / max(1, bandH)) * vignetteStr * 0.35 * effectMix
    love.graphics.setColor(0, 0, 0, alpha)
    love.graphics.rectangle("fill", 0, i, w, 1)
    love.graphics.rectangle("fill", 0, h - 1 - i, w, 1)
  end

  local bandW = floor(w * 0.06 * vignetteStr)
  for i = 0, bandW do
    local alpha = (1 - i / max(1, bandW)) * vignetteStr * 0.24 * effectMix
    love.graphics.setColor(0, 0, 0, alpha)
    love.graphics.rectangle("fill", i, 0, 1, h)
    love.graphics.rectangle("fill", w - 1 - i, 0, 1, h)
  end

  -- Curvature shading: very subtle edge compression look.
  if curvature > 0 then
    local edgeDarken = curvature * 0.3 * effectMix
    for y = 0, floor(h * 0.03 * curvature) do
      local prog = 1 - y / max(1, floor(h * 0.03 * curvature))
      love.graphics.setColor(0, 0, 0, prog * edgeDarken)
      love.graphics.rectangle("fill", 0, y, w, 1)
      love.graphics.rectangle("fill", 0, h - 1 - y, w, 1)
    end
  end

  -- Subtle phosphor tint bloom.
  love.graphics.setBlendMode("add")
  love.graphics.setColor(0.08, 0.2, 0.08, 0.05 * state.flicker * effectMix)
  love.graphics.rectangle("fill", 0, 0, w, h)
  love.graphics.setBlendMode("alpha")
end

Masks.register("CRT", CRT)

return CRT
