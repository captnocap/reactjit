--[[
  masks/luma_mesh.lua — Wireframe mesh displaced by brightness

  Samples brightness at grid vertices and displaces them vertically,
  drawing a luminance-driven wireframe over the source content.

  React usage:
    <LumaMesh mask />
    <LumaMesh mask gridSize={12} displacement={40} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max, min = math.floor, math.max, math.min
local sqrt = math.sqrt
local noise = love.math.noise

local LumaMesh = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function LumaMesh.create(w, h, props)
  return {
    time = 0,
    props = props or {},
    prevImgData = nil,
  }
end

function LumaMesh.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function LumaMesh.draw(state, w, h, source)
  local props = state.props or {}
  local gridSize = max(4, floor(Util.prop(props, "gridSize", 16)))
  local displacement = max(0, Util.prop(props, "displacement", 30))
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local lineWidth = max(0.5, Util.prop(props, "lineWidth", 1))
  local colored = Util.boolProp(props, "colored", true)
  local t = state.time

  -- Draw source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 then return end

  -- Sample brightness from source
  local imgData = source:newImageData()
  local cols = floor(w / gridSize) + 1
  local rows = floor(h / gridSize) + 1

  -- Build vertex grid: sample brightness, compute displaced positions
  local grid = {}
  for row = 0, rows - 1 do
    grid[row] = {}
    for col = 0, cols - 1 do
      local sx = min(w - 1, floor(col * gridSize))
      local sy = min(h - 1, floor(row * gridSize))
      local r, g, b = imgData:getPixel(sx, sy)
      local brightness = r * 0.299 + g * 0.587 + b * 0.114

      -- Displace based on brightness + time noise
      local n = noise(col * 0.4, row * 0.4, t * 0.3)
      local disp = brightness * displacement * effectMix + n * displacement * 0.1 * effectMix
      local px = sx
      local py = sy - disp

      grid[row][col] = { x = px, y = py, r = r, g = g, b = b, brightness = brightness }
    end
  end

  -- Draw wireframe lines
  love.graphics.setLineWidth(lineWidth)

  for row = 0, rows - 1 do
    for col = 0, cols - 1 do
      local v = grid[row][col]

      -- Horizontal line to next column
      if col < cols - 1 then
        local v2 = grid[row][col + 1]
        local avg = (v.brightness + v2.brightness) * 0.5
        local alpha = (0.4 + avg * 0.8) * effectMix

        if colored then
          local cr = (v.r + v2.r) * 0.5
          local cg = (v.g + v2.g) * 0.5
          local cb = (v.b + v2.b) * 0.5
          love.graphics.setColor(cr, cg, cb, alpha)
        else
          love.graphics.setColor(avg, avg, avg, alpha)
        end
        love.graphics.line(v.x, v.y, v2.x, v2.y)
      end

      -- Vertical line to next row
      if row < rows - 1 then
        local v2 = grid[row + 1][col]
        local avg = (v.brightness + v2.brightness) * 0.5
        local alpha = (0.4 + avg * 0.8) * effectMix

        if colored then
          local cr = (v.r + v2.r) * 0.5
          local cg = (v.g + v2.g) * 0.5
          local cb = (v.b + v2.b) * 0.5
          love.graphics.setColor(cr, cg, cb, alpha)
        else
          love.graphics.setColor(avg, avg, avg, alpha)
        end
        love.graphics.line(v.x, v.y, v2.x, v2.y)
      end
    end
  end

  love.graphics.setLineWidth(1)
  imgData:release()
end

Masks.register("LumaMesh", LumaMesh)

return LumaMesh
