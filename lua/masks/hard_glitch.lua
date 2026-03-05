--[[
  masks/hard_glitch.lua — Aggressive digital glitch mask

  Heavy block displacement, RGB channel splits, random fills, scanline
  corruption, and flicker. Looks like a broken GPU or corrupted stream.

  React usage:
    <HardGlitch mask />
    <HardGlitch mask chaos={0.6} blockSize={40} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max, min = math.floor, math.max, math.min
local random = math.random
local sin = math.sin
local noise = love.math.noise

local HardGlitch = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function HardGlitch.create(w, h, props)
  return {
    time = 0,
    props = props or {},
    glitchBursts = {},
    burstTimer = 0,
    frameSkip = false,
  }
end

function HardGlitch.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  local chaos = clamp(Util.prop(props, "chaos", 0.5), 0, 1)
  local blockSize = max(8, floor(Util.prop(props, "blockSize", 40)))

  -- Trigger glitch bursts
  state.burstTimer = state.burstTimer + dt
  local burstInterval = max(0.05, 0.5 - chaos * 0.45)

  if state.burstTimer > burstInterval then
    state.burstTimer = 0
    state.frameSkip = random() < chaos * 0.3

    -- Generate new displacement blocks
    state.glitchBursts = {}
    local numBlocks = floor(1 + chaos * 12)
    for i = 1, numBlocks do
      local bw = blockSize + floor(random() * blockSize * 3)
      local bh = max(2, floor(random() * blockSize * 0.5))
      state.glitchBursts[i] = {
        x = floor(random() * w),
        y = floor(random() * h),
        w = bw,
        h = bh,
        shiftX = (random() - 0.5) * w * chaos * 0.4,
        shiftY = (random() - 0.5) * 10,
        type = random() < 0.7 and "shift" or (random() < 0.5 and "fill" or "rgb"),
        color = { random(), random(), random(), 0.3 + random() * 0.5 },
      }
    end
  end

  -- Age bursts slightly
  for _, b in ipairs(state.glitchBursts) do
    b.shiftX = b.shiftX + (random() - 0.5) * 2
  end
end

function HardGlitch.draw(state, w, h, source)
  local props = state.props or {}
  local chaos = clamp(Util.prop(props, "chaos", 0.5), 0, 1)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local rgbSplit = max(0, Util.prop(props, "rgbSplit", 6)) * chaos

  -- Draw source (possibly with frame skip flicker)
  if state.frameSkip then
    love.graphics.setColor(1, 1, 1, 0.7)
  else
    love.graphics.setColor(1, 1, 1, 1)
  end
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 then return end

  -- RGB channel split
  if rgbSplit > 0.5 then
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 0, 0, 0.08 * effectMix)
    love.graphics.draw(source, -rgbSplit, 0)
    love.graphics.setColor(0, 0, 1, 0.06 * effectMix)
    love.graphics.draw(source, rgbSplit, 0)
    love.graphics.setColor(0, 1, 0, 0.04 * effectMix)
    love.graphics.draw(source, 0, -rgbSplit * 0.5)
    love.graphics.setBlendMode("alpha")
  end

  -- Glitch displacement blocks
  for _, b in ipairs(state.glitchBursts) do
    local bx = floor(b.x)
    local by = floor(b.y)
    local bw = min(b.w, w)
    local bh = min(b.h, h)

    if b.type == "shift" then
      -- Displaced strip from source
      love.graphics.setScissor(max(0, bx), max(0, by), bw, bh)
      love.graphics.setColor(1, 1, 1, 0.8 * effectMix)
      love.graphics.draw(source, b.shiftX, b.shiftY)
      love.graphics.setScissor()

    elseif b.type == "fill" then
      -- Random colored block
      local c = b.color
      love.graphics.setColor(c[1], c[2], c[3], c[4] * effectMix * 0.5)
      love.graphics.rectangle("fill", bx, by, bw, bh)

    elseif b.type == "rgb" then
      -- Per-channel displaced strips
      love.graphics.setScissor(max(0, bx), max(0, by), bw, bh)
      love.graphics.setBlendMode("add")
      love.graphics.setColor(1, 0, 0, 0.2 * effectMix)
      love.graphics.draw(source, b.shiftX * 1.5, 0)
      love.graphics.setColor(0, 1, 0, 0.15 * effectMix)
      love.graphics.draw(source, -b.shiftX, 0)
      love.graphics.setColor(0, 0, 1, 0.2 * effectMix)
      love.graphics.draw(source, b.shiftX * 0.7, b.shiftY)
      love.graphics.setBlendMode("alpha")
      love.graphics.setScissor()
    end
  end

  -- Horizontal corruption scanlines
  local scanCount = floor(chaos * 8 * effectMix)
  for i = 1, scanCount do
    local sy = floor(noise(i * 7.3, state.time * 5) * h)
    local sh = max(1, floor(1 + random() * 3))
    local shift = (noise(i * 3.1, state.time * 8) - 0.5) * w * chaos * 0.3
    love.graphics.setScissor(0, sy, w, sh)
    love.graphics.setColor(1, 1, 1, 0.6 * effectMix)
    love.graphics.draw(source, shift, 0)
    love.graphics.setScissor()
  end

  -- Random static burst dots
  if chaos > 0.3 then
    local dotCount = floor(w * h * 0.0005 * chaos * effectMix)
    for _ = 1, dotCount do
      local dx = floor(random() * w)
      local dy = floor(random() * h)
      love.graphics.setColor(random(), random(), random(), 0.15 * effectMix)
      love.graphics.rectangle("fill", dx, dy, max(1, floor(random() * 3)), 1)
    end
  end
end

Masks.register("HardGlitch", HardGlitch)

return HardGlitch
