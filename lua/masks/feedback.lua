--[[
  masks/feedback.lua — Video feedback loop mask

  Classic video feedback: the output is fed back as input with slight
  scale/rotation/translation, creating recursive tunnel and spiral effects.

  React usage:
    <Feedback mask />
    <Feedback mask zoom={1.02} rotation={0.01} decay={0.95} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max
local sin, cos = math.sin, math.cos
local noise = love.math.noise

local Feedback = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function Feedback.create(w, h, props)
  local feedCanvas = nil
  if w > 0 and h > 0 then
    feedCanvas = love.graphics.newCanvas(w, h)
  end
  return {
    time = 0,
    props = props or {},
    feedCanvas = feedCanvas,
    prevW = w,
    prevH = h,
    initialized = false,
  }
end

function Feedback.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  if (w ~= state.prevW or h ~= state.prevH) and w > 0 and h > 0 then
    if state.feedCanvas then state.feedCanvas:release() end
    state.feedCanvas = love.graphics.newCanvas(w, h)
    state.prevW = w
    state.prevH = h
    state.initialized = false
  end
end

function Feedback.draw(state, w, h, source)
  local props = state.props or {}
  local zoom = max(0.9, Util.prop(props, "zoom", 1.02))
  local rotation = Util.prop(props, "rotation", 0.005)
  local decay = clamp(Util.prop(props, "decay", 0.94), 0, 0.99)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local hueShift = Util.boolProp(props, "hueShift", true)
  local t = state.time

  -- Draw source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 or not state.feedCanvas then return end

  -- Update feedback canvas: draw previous feedback (transformed) + new source
  local prevCanvas = love.graphics.getCanvas()

  love.graphics.setCanvas(state.feedCanvas)

  if not state.initialized then
    -- First frame: start with current source
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    state.initialized = true
  else
    -- Draw previous feedback with decay, zoom, and rotation
    local cx = w * 0.5
    local cy = h * 0.5
    local rot = rotation + sin(t * 0.7) * rotation * 0.3

    love.graphics.push()
    love.graphics.translate(cx, cy)
    love.graphics.rotate(rot)
    love.graphics.scale(zoom, zoom)
    love.graphics.translate(-cx, -cy)
    love.graphics.setColor(1, 1, 1, decay)
    love.graphics.draw(state.feedCanvas, 0, 0)
    love.graphics.pop()

    -- Blend in current source
    love.graphics.setColor(1, 1, 1, 1 - decay + 0.02)
    love.graphics.draw(source, 0, 0)
  end

  love.graphics.setCanvas(prevCanvas)

  -- Overlay feedback on output
  love.graphics.setBlendMode("add")
  if hueShift then
    -- Cycle through color channels for psychedelic look
    local phase = t * 0.5
    local r = 0.5 + sin(phase) * 0.3
    local g = 0.5 + sin(phase + 2.094) * 0.3
    local b = 0.5 + sin(phase + 4.189) * 0.3
    love.graphics.setColor(r, g, b, 0.2 * effectMix)
  else
    love.graphics.setColor(1, 1, 1, 0.2 * effectMix)
  end
  love.graphics.draw(state.feedCanvas, 0, 0)
  love.graphics.setBlendMode("alpha")
end

function Feedback.destroy(state)
  if state and state.feedCanvas then
    state.feedCanvas:release()
    state.feedCanvas = nil
  end
end

Masks.register("FeedbackLoop", Feedback)

return Feedback
