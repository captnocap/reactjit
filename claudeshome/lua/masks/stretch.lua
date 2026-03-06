--[[
  masks/stretch.lua — Pixel stretch / smear mask

  Draws thin horizontal strips of the source with noise-driven offsets,
  creating a stretched/smeared/melting pixel effect.

  React usage:
    <Stretch mask />
    <Stretch mask amount={0.5} direction="horizontal" />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max, min = math.floor, math.max, math.min
local sin = math.sin
local noise = love.math.noise

local Stretch = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function Stretch.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Stretch.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Stretch.draw(state, w, h, source)
  local props = state.props or {}
  local amount = clamp(Util.prop(props, "amount", 0.5), 0, 1)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local stripHeight = max(1, floor(Util.prop(props, "stripHeight", 2)))
  local vertical = Util.boolProp(props, "vertical", false)
  local t = state.time

  -- Draw source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 or amount <= 0 then return end

  local maxShift = w * amount * 0.3 * effectMix

  if not vertical then
    -- Horizontal stretch: each strip shifts left/right
    local strips = floor(h / stripHeight)
    for i = 0, strips - 1 do
      local sy = i * stripHeight
      local sh = stripHeight

      -- Multi-octave noise for organic feel
      local n1 = (noise(i * 0.15, t * 0.8) - 0.5) * 2
      local n2 = (noise(i * 0.5, t * 1.5) - 0.5) * 2
      local n3 = (noise(i * 1.2, t * 3.0) - 0.5) * 2
      local shift = (n1 * 0.6 + n2 * 0.3 + n3 * 0.1) * maxShift

      -- Threshold: only stretch strips above a noise threshold for sparsity
      local threshold = noise(i * 0.3, t * 0.5)
      if threshold > 0.35 and math.abs(shift) > 0.5 then
        love.graphics.setScissor(0, sy, w, sh)
        love.graphics.setColor(1, 1, 1, 1.0 * effectMix)
        love.graphics.draw(source, shift, 0)

        -- Smear trail: draw the strip extended in shift direction
        local trailAlpha = 0.45 * effectMix * amount
        local trailSteps = max(1, floor(math.abs(shift) / 4))
        for s = 1, trailSteps do
          local frac = s / trailSteps
          local trailShift = shift * frac
          love.graphics.setColor(1, 1, 1, trailAlpha * (1 - frac))
          love.graphics.draw(source, trailShift, 0)
        end
        love.graphics.setScissor()
      end
    end
  else
    -- Vertical stretch: each column strip shifts up/down
    local stripWidth = max(1, stripHeight)
    local strips = floor(w / stripWidth)
    local maxVShift = h * amount * 0.3 * effectMix

    for i = 0, strips - 1 do
      local sx = i * stripWidth

      local n1 = (noise(t * 0.8, i * 0.15) - 0.5) * 2
      local n2 = (noise(t * 1.5, i * 0.5) - 0.5) * 2
      local shift = (n1 * 0.7 + n2 * 0.3) * maxVShift

      local threshold = noise(t * 0.5, i * 0.3)
      if threshold > 0.35 and math.abs(shift) > 0.5 then
        love.graphics.setScissor(sx, 0, stripWidth, h)
        love.graphics.setColor(1, 1, 1, 1.0 * effectMix)
        love.graphics.draw(source, 0, shift)
        love.graphics.setScissor()
      end
    end
  end
end

Masks.register("Stretch", Stretch)

return Stretch
