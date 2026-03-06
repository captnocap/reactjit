--[[
  masks/slit_scan.lua — Slit Scan / Time Displacement mask

  Records a history of frames and renders the screen in horizontal
  or vertical strips sampled from different points in time, creating
  a delayed warping effect (classic slit-scan).

  React usage:
    <SlitScan mask />
    <SlitScan mask bands={32} delay={0.5} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max

local SlitScan = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function SlitScan.create(w, h, props)
  return {
    time = 0,
    props = props or {},
    frames = {}, -- Circular buffer of canvases
    frameIdx = 1,
    maxFrames = 60,
    prevW = w,
    prevH = h,
  }
end

function SlitScan.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  if (w ~= state.prevW or h ~= state.prevH) and w > 0 and h > 0 then
    -- Resize clearing buffer
    for _, canvas in ipairs(state.frames) do
      canvas:release()
    end
    state.frames = {}
    state.frameIdx = 1
    state.prevW = w
    state.prevH = h
  end
end

function SlitScan.draw(state, w, h, source)
  local props = state.props or {}
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local bands = max(2, floor(Util.prop(props, "bands", 64)))
  local delay = clamp(Util.prop(props, "delay", 1.0), 0, 1)
  local vertical = Util.boolProp(props, "vertical", false)

  if effectMix <= 0 or w <= 0 or h <= 0 then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  -- Record current frame
  local targetFrames = max(2, floor(60 * delay))
  if #state.frames < targetFrames then
    table.insert(state.frames, love.graphics.newCanvas(w, h))
  elseif #state.frames > targetFrames then
    local removed = table.remove(state.frames, 1)
    removed:release()
    if state.frameIdx > #state.frames then
       state.frameIdx = 1
    end
  end

  local curCanvas = state.frames[state.frameIdx]
  if not curCanvas then
    curCanvas = love.graphics.newCanvas(w, h)
    table.insert(state.frames, curCanvas)
    state.frameIdx = #state.frames
  end

  local prevCanvas = love.graphics.getCanvas()
  love.graphics.setCanvas(curCanvas)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)
  love.graphics.setCanvas(prevCanvas)

  -- Draw slit scan
  love.graphics.setColor(1, 1, 1, 1)
  
  if not vertical then
    local bandH = h / bands
    for i = 0, bands - 1 do
      local sy = floor(i * bandH)
      local sh = floor(bandH) + 1
      -- time delay based on Y position
      -- top is newest, bottom is oldest
      local offset = floor((i / (bands - 1)) * (#state.frames - 1) * effectMix)
      local sampleIdx = state.frameIdx - offset
      while sampleIdx < 1 do sampleIdx = sampleIdx + #state.frames end
      
      local drawCanvas = state.frames[sampleIdx]
      if drawCanvas then
        love.graphics.setScissor(0, sy, w, sh)
        love.graphics.draw(drawCanvas, 0, 0)
      end
    end
  else
    local bandW = w / bands
    for i = 0, bands - 1 do
      local sx = floor(i * bandW)
      local sw = floor(bandW) + 1
      -- time delay based on X position
      local offset = floor((i / (bands - 1)) * (#state.frames - 1) * effectMix)
      local sampleIdx = state.frameIdx - offset
      while sampleIdx < 1 do sampleIdx = sampleIdx + #state.frames end
      
      local drawCanvas = state.frames[sampleIdx]
      if drawCanvas then
        love.graphics.setScissor(sx, 0, sw, h)
        love.graphics.draw(drawCanvas, 0, 0)
      end
    end
  end
  
  love.graphics.setScissor()

  state.frameIdx = state.frameIdx + 1
  if state.frameIdx > #state.frames then
    state.frameIdx = 1
  end
end

function SlitScan.destroy(state)
  if state and state.frames then
    for _, canvas in ipairs(state.frames) do
      canvas:release()
    end
    state.frames = {}
  end
end

Masks.register("SlitScan", SlitScan)

return SlitScan
