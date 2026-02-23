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
  local cellSize = max(4, Util.prop(state.props, "cellSize", 8))
  local opacity = Util.prop(state.props, "opacity", 0.6)
  local colored = Util.boolProp(state.props, "colored", true)
  local t = state.time

  -- Draw source dimmed as base
  love.graphics.setColor(1, 1, 1, 1 - opacity * 0.7)
  love.graphics.draw(source, 0, 0)

  -- Get source image data for brightness sampling
  local imgData = source:newImageData()
  local font = getFont(cellSize)
  love.graphics.setFont(font)

  local cols = floor(w / cellSize)
  local rows = floor(h / cellSize)

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
      if ch ~= " " then
        local cx = col * cellSize
        local cy = row * cellSize

        if colored then
          love.graphics.setColor(r, g, b, opacity * a)
        else
          love.graphics.setColor(brightness, brightness, brightness, opacity * a)
        end
        love.graphics.print(ch, cx, cy)
      end
    end
  end

  imgData:release()
end

Masks.register("Ascii", Ascii)

return Ascii
