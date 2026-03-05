--[[
  masks/data_mosh.lua — Datamoshing / corrupted video compression mask

  Keeps a "reference frame" and periodically refuses to update regions,
  creating the look of missing I-frames in a video codec. Blocks from
  old frames persist and drift.

  React usage:
    <DataMosh mask />
    <DataMosh mask blockSize={32} corruption={0.4} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max, min = math.floor, math.max, math.min
local random = math.random
local noise = love.math.noise

local DataMosh = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function DataMosh.create(w, h, props)
  local refCanvas = nil
  if w > 0 and h > 0 then
    refCanvas = love.graphics.newCanvas(w, h)
  end
  return {
    time = 0,
    props = props or {},
    refCanvas = refCanvas,
    prevW = w,
    prevH = h,
    frameCount = 0,
    frozenBlocks = {},  -- { x, y, w, h, driftX, driftY, age }
    iFrameTimer = 0,
  }
end

function DataMosh.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
  state.frameCount = state.frameCount + 1

  -- Resize if needed
  if (w ~= state.prevW or h ~= state.prevH) and w > 0 and h > 0 then
    if state.refCanvas then state.refCanvas:release() end
    state.refCanvas = love.graphics.newCanvas(w, h)
    state.prevW = w
    state.prevH = h
    state.frozenBlocks = {}
  end

  local corruption = clamp(Util.prop(props, "corruption", 0.3), 0, 1)
  local blockSize = max(8, floor(Util.prop(props, "blockSize", 32)))

  -- Periodically spawn frozen blocks
  state.iFrameTimer = state.iFrameTimer + dt
  local iFrameInterval = max(0.1, 2.0 - corruption * 1.5)

  if state.iFrameTimer > iFrameInterval then
    state.iFrameTimer = 0
    -- Add new frozen blocks
    local numBlocks = floor(2 + corruption * 8)
    for _ = 1, numBlocks do
      local bw = blockSize + floor(random() * blockSize * 2)
      local bh = blockSize + floor(random() * blockSize)
      state.frozenBlocks[#state.frozenBlocks + 1] = {
        x = floor(random() * w),
        y = floor(random() * h),
        w = bw,
        h = bh,
        driftX = (random() - 0.5) * 4,
        driftY = random() * 2,
        age = 0,
        maxAge = 0.5 + random() * 3,
      }
    end
  end

  -- Age and drift frozen blocks
  for i = #state.frozenBlocks, 1, -1 do
    local b = state.frozenBlocks[i]
    b.age = b.age + dt
    b.x = b.x + b.driftX * dt * 30
    b.y = b.y + b.driftY * dt * 30
    if b.age > b.maxAge then
      table.remove(state.frozenBlocks, i)
    end
  end

  -- Cap
  while #state.frozenBlocks > 30 do
    table.remove(state.frozenBlocks, 1)
  end
end

function DataMosh.draw(state, w, h, source)
  local props = state.props or {}
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local corruption = clamp(Util.prop(props, "corruption", 0.3), 0, 1)

  -- Draw current source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 or not state.refCanvas then return end

  -- Every few frames, snapshot current source into reference canvas
  if state.frameCount % max(1, floor(8 - corruption * 6)) == 0 then
    local prevCanvas = love.graphics.getCanvas()
    love.graphics.setCanvas(state.refCanvas)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    love.graphics.setCanvas(prevCanvas)
  end

  -- Draw frozen blocks from reference frame at drifted positions
  for _, b in ipairs(state.frozenBlocks) do
    local alpha = (1 - b.age / b.maxAge) * effectMix * 0.8
    if alpha > 0.01 then
      local bx = floor(b.x)
      local by = floor(b.y)
      local bw = min(b.w, w - bx)
      local bh = min(b.h, h - by)
      if bx >= 0 and by >= 0 and bw > 0 and bh > 0 then
        love.graphics.setScissor(bx, by, bw, bh)
        -- Draw reference frame with slight offset
        local shiftX = (noise(b.x * 0.1, state.time) - 0.5) * 10 * corruption
        love.graphics.setColor(1, 1, 1, alpha)
        love.graphics.draw(state.refCanvas, shiftX, 0)
        love.graphics.setScissor()
      end
    end
  end

  -- Horizontal block-shift corruption lines
  local lineCount = floor(corruption * 6 * effectMix)
  for i = 1, lineCount do
    local ly = floor(noise(i * 3.7, state.time * 2) * h)
    local lh = max(1, floor(2 + corruption * 8))
    local shift = (noise(i * 5.1, state.time * 4) - 0.5) * 40 * corruption
    love.graphics.setScissor(0, ly, w, lh)
    love.graphics.setColor(1, 1, 1, 0.5 * effectMix)
    love.graphics.draw(state.refCanvas, shift, 0)
    love.graphics.setScissor()
  end

  -- Occasional color channel artifacts
  if corruption > 0.2 then
    love.graphics.setBlendMode("add")
    local ghostAlpha = corruption * 0.04 * effectMix
    love.graphics.setColor(1, 0, 0, ghostAlpha)
    love.graphics.draw(state.refCanvas, -2, 0)
    love.graphics.setColor(0, 0, 1, ghostAlpha)
    love.graphics.draw(state.refCanvas, 2, 0)
    love.graphics.setBlendMode("alpha")
  end
end

function DataMosh.destroy(state)
  if state and state.refCanvas then
    state.refCanvas:release()
    state.refCanvas = nil
  end
end

Masks.register("DataMosh", DataMosh)

return DataMosh
