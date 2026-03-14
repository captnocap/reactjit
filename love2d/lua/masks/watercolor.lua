--[[
  masks/watercolor.lua — Watercolor / painterly wash mask

  Soft edge bleeding, paper texture, color diffusion, and wet-on-wet
  blending. Creates a hand-painted watercolor aesthetic.

  React usage:
    <Watercolor mask />
    <Watercolor mask bleed={0.5} paper={0.3} />
    <Watercolor mask shaderTint="#cba6f7" shaderSaturation={0.85} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")
local ShaderGrade = require("lua.masks.shader_grade")

local floor, max = math.floor, math.max
local sin, cos = math.sin, math.cos
local noise = love.math.noise
local random = math.random

local Watercolor = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function Watercolor.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Watercolor.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Watercolor.draw(state, w, h, source)
  local props = state.props or {}
  local bleed = clamp(Util.prop(props, "bleed", 0.5), 0, 1)
  local paper = clamp(Util.prop(props, "paper", 0.3), 0, 1)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local wetness = clamp(Util.prop(props, "wetness", 0.4), 0, 1)
  local t = state.time

  -- Base pass: shader-graded wash derived from imaging color ops.
  local shaderHue = Util.prop(props, "shaderHue", 8)
  local shaderSaturation = Util.prop(props, "shaderSaturation", 0.9)
  local shaderValue = Util.prop(props, "shaderValue", 1.03)
  local shaderContrast = Util.prop(props, "shaderContrast", 0.94)
  local shaderPosterize = Util.prop(props, "shaderPosterize", 0)
  local shaderGrain = Util.prop(props, "shaderGrain", 0.015 + paper * 0.03)
  local shaderVignette = Util.prop(props, "shaderVignette", 0.08)
  local shaderTint = props.shaderTint or Masks.getThemeToken("accent", "#cba6f7")
  local shaderTintMix = Util.prop(props, "shaderTintMix", 0.08 + bleed * 0.12)
  ShaderGrade.draw(source, w, h, {
    time = t,
    hue = shaderHue * effectMix,
    saturation = 1 + (shaderSaturation - 1) * effectMix,
    value = 1 + (shaderValue - 1) * effectMix,
    contrast = 1 + (shaderContrast - 1) * effectMix,
    posterize = effectMix > 0.01 and shaderPosterize or 0,
    grain = shaderGrain * effectMix,
    vignette = shaderVignette * effectMix,
    tint = shaderTint,
    tintMix = shaderTintMix * effectMix,
  })

  if effectMix <= 0 then return end

  -- Soft edge bleeding: draw source multiple times at slight offsets
  -- This creates the look of paint bleeding into wet paper
  local bleedRadius = bleed * 4 * effectMix
  local passes = max(1, floor(3 + bleed * 5))
  local bleedAlpha = 0.15 * effectMix * bleed

  love.graphics.setBlendMode("alpha")
  for i = 1, passes do
    local angle = (i / passes) * math.pi * 2 + t * 0.1
    local dist = bleedRadius * (0.5 + noise(i * 2.3, t * 0.3) * 0.5)
    local dx = cos(angle) * dist
    local dy = sin(angle) * dist
    love.graphics.setColor(1, 1, 1, bleedAlpha)
    love.graphics.draw(source, dx, dy)
  end

  -- Wet-on-wet: larger, softer bleed passes
  if wetness > 0.01 then
    local wetRadius = wetness * 8 * effectMix
    local wetAlpha = 0.08 * effectMix * wetness
    for i = 1, 3 do
      local angle = (i / 3) * math.pi * 2 + t * 0.05 + 1.0
      local dist = wetRadius * noise(i * 4.1, t * 0.2)
      love.graphics.setColor(1, 1, 1, wetAlpha)
      love.graphics.draw(source, cos(angle) * dist, sin(angle) * dist)
    end
  end

  -- Paper texture: noise-based stipple overlay
  if paper > 0.01 then
    local texScale = 4
    local texAlpha = paper * 0.15 * effectMix

    -- Dark speckles (paper grain)
    for y = 0, h - 1, texScale do
      for x = 0, w - 1, texScale do
        local n = noise(x * 0.08, y * 0.08, 3.7)
        if n > 0.45 then
          local grain = (n - 0.45) * 3.6  -- 0-1 range above threshold
          love.graphics.setColor(0, 0, 0, grain * texAlpha)
          love.graphics.rectangle("fill", x, y, texScale, texScale)
        end
      end
    end

    -- Light speckles (paper highlights)
    for y = 0, h - 1, texScale do
      for x = 0, w - 1, texScale do
        local n = noise(x * 0.08 + 100, y * 0.08 + 100, 7.1)
        if n > 0.55 then
          local grain = (n - 0.55) * 2.2
          love.graphics.setBlendMode("add")
          love.graphics.setColor(1, 1, 1, grain * texAlpha * 0.5)
          love.graphics.rectangle("fill", x, y, texScale, texScale)
          love.graphics.setBlendMode("alpha")
        end
      end
    end
  end

  -- Edge darkening (watercolor pool effect at edges)
  local edgeAlpha = bleed * 0.15 * effectMix
  local bandSize = floor(max(2, w * 0.03 * bleed))
  for i = 0, bandSize do
    local prog = 1 - i / max(1, bandSize)
    love.graphics.setColor(0, 0, 0, prog * edgeAlpha)
    love.graphics.rectangle("fill", i, i, w - i * 2, 1)
    love.graphics.rectangle("fill", i, h - 1 - i, w - i * 2, 1)
    love.graphics.rectangle("fill", i, i, 1, h - i * 2)
    love.graphics.rectangle("fill", w - 1 - i, i, 1, h - i * 2)
  end
end

Masks.register("Watercolor", Watercolor)

return Watercolor
