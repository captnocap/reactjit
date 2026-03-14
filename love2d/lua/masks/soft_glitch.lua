--[[
  masks/soft_glitch.lua — Subtle digital glitch mask

  Gentle horizontal offsets per scanline band, subtle color fringing,
  occasional micro-stutter. Like a signal with slight interference.

  React usage:
    <SoftGlitch mask />
    <SoftGlitch mask drift={0.5} fringe={1.5} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local floor, max = math.floor, math.max
local sin = math.sin
local noise = love.math.noise

local SoftGlitch = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function SoftGlitch.create(w, h, props)
  return {
    time = 0,
    props = props or {},
    stutterTimer = 0,
    stutterActive = false,
    stutterX = 0,
  }
end

function SoftGlitch.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed

  local drift = clamp(Util.prop(props, "drift", 0.4), 0, 1)

  -- Occasional micro-stutter
  state.stutterTimer = state.stutterTimer + dt
  if state.stutterTimer > 1.5 + (1 - drift) * 3 then
    state.stutterTimer = 0
    state.stutterActive = true
    state.stutterX = (noise(state.time * 10, 42) - 0.5) * 8 * drift
  elseif state.stutterActive and state.stutterTimer > 0.08 then
    state.stutterActive = false
    state.stutterX = 0
  end
end

function SoftGlitch.draw(state, w, h, source)
  local props = state.props or {}
  local drift = clamp(Util.prop(props, "drift", 0.4), 0, 1)
  local fringe = max(0, Util.prop(props, "fringe", 1.0))
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local bandHeight = max(4, floor(Util.prop(props, "bandHeight", 20)))
  local t = state.time

  -- Draw source as base
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)

  if effectMix <= 0 then return end

  -- Gentle scanline band displacement
  local bands = floor(h / bandHeight)
  for i = 0, bands - 1 do
    local by = i * bandHeight
    local bh = bandHeight

    -- Smooth noise-driven horizontal offset
    local offsetX = (noise(i * 0.8, t * 1.5) - 0.5) * drift * 6 * effectMix
    -- Add stutter displacement
    if state.stutterActive then
      offsetX = offsetX + state.stutterX * effectMix
    end

    if math.abs(offsetX) > 0.5 then
      love.graphics.setScissor(0, by, w, bh)
      love.graphics.setColor(1, 1, 1, 0.4 * effectMix)
      love.graphics.draw(source, offsetX, 0)
      love.graphics.setScissor()
    end
  end

  -- Subtle color fringing (always-on, very light)
  if fringe > 0.01 then
    local fringeAmt = fringe * effectMix
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 0.2, 0.1, 0.1 * fringeAmt)
    love.graphics.draw(source, -fringeAmt, 0)
    love.graphics.setColor(0.1, 0.2, 1, 0.08 * fringeAmt)
    love.graphics.draw(source, fringeAmt, 0)
    love.graphics.setBlendMode("alpha")
  end

  -- Occasional thin interference lines
  local lineCount = floor(drift * 3 * effectMix)
  for i = 1, lineCount do
    local ly = floor(noise(i * 5.3, t * 3) * h)
    local alpha = 0.15 * effectMix * noise(i * 2.1, t * 6)
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.rectangle("fill", 0, ly, w, 1)
  end

  -- Very subtle brightness fluctuation
  local flicker = noise(t * 4, 17.3)
  if flicker > 0.7 then
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 1, 1, (flicker - 0.7) * 0.15 * effectMix)
    love.graphics.rectangle("fill", 0, 0, w, h)
    love.graphics.setBlendMode("alpha")
  end
end

Masks.register("SoftGlitch", SoftGlitch)

return SoftGlitch
