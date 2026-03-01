--[[
  masks/ascii.lua — ASCII art conversion post-processing mask

  Overlays a character grid that maps brightness regions to ASCII characters,
  creating a terminal/matrix aesthetic on top of the rendered content.

  React usage:
    <Ascii mask />
    <Ascii mask cellSize={8} opacity={0.7} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, min, max = math.floor, math.min, math.max
local noise = love.math.noise

local Ascii = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

-- Character ramp from dark to bright (sorted by visual density)
local charRamp = { " ", ".", ":", "-", "=", "+", "*", "#", "%", "@" }
local rampLen = #charRamp

local fontCache = {}
local function getFont(size)
  size = max(6, floor(size))
  if not fontCache[size] then
    fontCache[size] = love.graphics.newFont(size)
  end
  return fontCache[size]
end

function Ascii.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Ascii.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Ascii.draw(state, w, h, source)
  local props = state.props or {}
  local cellSize = max(4, floor(Util.prop(props, "cellSize", 8)))
  local opacity = clamp(Util.prop(props, "opacity", 0.6), 0, 1)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local colored = Util.boolProp(props, "colored", true)
  local t = state.time

  -- Keep full source image as base and overlay ASCII glyphs on top.
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  -- Get source image data for brightness sampling
  local imgData = source:newImageData()
  local font = getFont(cellSize)
  love.graphics.setFont(font)
  local glyphAlpha = (0.08 + opacity * 0.52) * effectMix

  local cols = floor(w / cellSize)
  local rows = floor(h / cellSize)

  if effectMix <= 0 then
    imgData:release()
    return
  end

  if colored then
    love.graphics.setBlendMode("add")
  else
    love.graphics.setBlendMode("alpha")
  end

  for row = 0, rows - 1 do
    for col = 0, cols - 1 do
      -- Sample center pixel of each cell
      local sx = min(w - 1, floor(col * cellSize + cellSize * 0.5))
      local sy = min(h - 1, floor(row * cellSize + cellSize * 0.5))
      local r, g, b, a = imgData:getPixel(sx, sy)

      -- Perceived brightness (luminance)
      local brightness = r * 0.299 + g * 0.587 + b * 0.114

      -- Map brightness to character
      local charIdx = max(1, min(rampLen, floor(brightness * rampLen) + 1))

      -- Add slight noise variation for texture
      local noiseVal = noise(col * 0.3, row * 0.3, t * 0.5)
      charIdx = max(1, min(rampLen, charIdx + floor((noiseVal - 0.5) * 1.5)))

      local ch = charRamp[charIdx]
      if ch ~= " " and a > 0.01 then
        local cx = col * cellSize
        local cy = row * cellSize

        if colored then
          love.graphics.setColor(max(0.08, r), max(0.08, g), max(0.08, b), glyphAlpha * a * 0.8)
        else
          local v = brightness * 0.85 + 0.15
          love.graphics.setColor(v, v, v, glyphAlpha * a)
        end
        love.graphics.print(ch, cx, cy)
      end
    end
  end

  love.graphics.setBlendMode("alpha")
  imgData:release()
end

Masks.register("Ascii", Ascii)

return Ascii
