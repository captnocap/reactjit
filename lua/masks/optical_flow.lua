--[[
  masks/optical_flow.lua — Motion trail / optical flow mask

  Keeps a persistent trail canvas that accumulates previous frames with
  slight decay + displacement, creating motion blur / flow streaks.

  React usage:
    <OpticalFlow mask />
    <OpticalFlow mask decay={0.92} displacement={4} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max
local noise = love.math.noise

local OpticalFlow = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function OpticalFlow.create(w, h, props)
  local trailCanvas = nil
  if w > 0 and h > 0 then
    trailCanvas = love.graphics.newCanvas(w, h)
  end
  return {
    time = 0,
    props = props or {},
    trailCanvas = trailCanvas,
    prevW = w,
    prevH = h,
  }
end

function OpticalFlow.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  -- Resize trail canvas if dimensions changed
  if (w ~= state.prevW or h ~= state.prevH) and w > 0 and h > 0 then
    if state.trailCanvas then state.trailCanvas:release() end
    state.trailCanvas = love.graphics.newCanvas(w, h)
    state.prevW = w
    state.prevH = h
  end
end

function OpticalFlow.draw(state, w, h, source)
  local props = state.props or {}
  local decay = clamp(Util.prop(props, "decay", 0.92), 0, 0.99)
  local displacement = max(0, Util.prop(props, "displacement", 3))
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local colorShift = Util.boolProp(props, "colorShift", true)
  local t = state.time

  -- Draw source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 or not state.trailCanvas then return end

  -- Accumulate: draw previous trail (decayed) + current source into trail canvas
  local prevCanvas = love.graphics.getCanvas()

  love.graphics.setCanvas(state.trailCanvas)

  -- Draw previous trail with decay (fade out old frames)
  local dx = (noise(t * 1.3, 0) - 0.5) * displacement * 2
  local dy = (noise(0, t * 1.1) - 0.5) * displacement * 2
  love.graphics.setColor(1, 1, 1, decay)
  love.graphics.draw(state.trailCanvas, dx, dy)

  -- Draw current frame on top (low opacity to blend)
  love.graphics.setColor(1, 1, 1, 1 - decay + 0.05)
  love.graphics.draw(source, 0, 0)

  love.graphics.setCanvas(prevCanvas)

  -- Overlay the trail on the output
  love.graphics.setBlendMode("add")
  if colorShift then
    -- Slight color fringing on the trail
    love.graphics.setColor(0.8, 0.3, 0.2, 0.4 * effectMix)
    love.graphics.draw(state.trailCanvas, -1, 0)
    love.graphics.setColor(0.2, 0.5, 0.8, 0.35 * effectMix)
    love.graphics.draw(state.trailCanvas, 1, 0)
    love.graphics.setColor(0.3, 0.8, 0.3, 0.3 * effectMix)
    love.graphics.draw(state.trailCanvas, 0, 0)
  else
    love.graphics.setColor(1, 1, 1, 0.6 * effectMix)
    love.graphics.draw(state.trailCanvas, 0, 0)
  end
  love.graphics.setBlendMode("alpha")
end

function OpticalFlow.destroy(state)
  if state and state.trailCanvas then
    state.trailCanvas:release()
    state.trailCanvas = nil
  end
end

Masks.register("OpticalFlow", OpticalFlow)

return OpticalFlow
