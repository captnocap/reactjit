--[[
  masks/tile.lua — Tiling / kaleidoscope mask

  Repeats the source content in a grid pattern at reduced scale,
  optionally with mirror/rotation for kaleidoscope effects.

  React usage:
    <Tile mask />
    <Tile mask columns={4} rows={3} mirror />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max

local Tile = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function Tile.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Tile.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Tile.draw(state, w, h, source)
  local props = state.props or {}
  local columns = max(1, floor(Util.prop(props, "columns", 3)))
  local rows = max(1, floor(Util.prop(props, "rows", 3)))
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local mirror = Util.boolProp(props, "mirror", false)
  local gap = max(0, floor(Util.prop(props, "gap", 0)))
  local animated = Util.boolProp(props, "animated", false)
  local t = state.time

  if effectMix <= 0 or (columns == 1 and rows == 1) then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  -- Tile dimensions
  local tileW = floor((w - gap * (columns - 1)) / columns)
  local tileH = floor((h - gap * (rows - 1)) / rows)

  if tileW <= 0 or tileH <= 0 then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  local scaleX = tileW / w
  local scaleY = tileH / h

  -- Optional animated scale pulse
  local pulse = 1.0
  if animated then
    pulse = 1.0 + math.sin(t * 2) * 0.02
  end

  -- Background (clear to transparent)
  love.graphics.setColor(1, 1, 1, 1)

  for row = 0, rows - 1 do
    for col = 0, columns - 1 do
      local tx = col * (tileW + gap)
      local ty = row * (tileH + gap)

      love.graphics.push()
      love.graphics.translate(tx, ty)

      -- Mirror logic: flip alternating tiles
      local flipX = 1
      local flipY = 1
      if mirror then
        if col % 2 == 1 then flipX = -1 end
        if row % 2 == 1 then flipY = -1 end
      end

      if flipX == -1 or flipY == -1 then
        love.graphics.translate(
          flipX == -1 and tileW or 0,
          flipY == -1 and tileH or 0
        )
      end

      -- Apply animated pulse from tile center
      if animated then
        local cx = tileW * 0.5 * flipX
        local cy = tileH * 0.5 * flipY
        love.graphics.translate(cx, cy)
        love.graphics.scale(pulse, pulse)
        love.graphics.translate(-cx, -cy)
      end

      love.graphics.scale(scaleX * flipX, scaleY * flipY)

      -- Draw source scaled to fit tile
      love.graphics.setColor(1, 1, 1, effectMix)
      love.graphics.draw(source, 0, 0)

      love.graphics.pop()
    end
  end
end

Masks.register("Tile", Tile)

return Tile
