--[[
  effects/pixelsort.lua — Column-based pixel brightness sorting

  Horizontal color bands from amplitude form the base layer. When intensity
  crosses a threshold, random columns have their pixels sorted by brightness
  within contiguous spans, creating vertical smear streaks.

  Since direct pixel manipulation is expensive in Love2D, this implementation
  uses a visual approximation: bands with varying brightness get stretched
  vertically to simulate the sorted-column aesthetic.

  React usage:
    <PixelSort />
    <PixelSort speed={1.5} />
    <PixelSort reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, abs = math.random, math.floor, math.abs

local PixelSort = {}

local MAX_STREAKS = 300
local BAND_HEIGHT = 2

function PixelSort.create(w, h, props)
  -- Build color bands
  local bands = {}
  local numBands = floor(h / BAND_HEIGHT) + 1
  for i = 0, numBands - 1 do
    table.insert(bands, {
      y = i * BAND_HEIGHT,
      hue = (i / numBands) % 1,
      brightness = 0.3 + random() * 0.2,
      active = true,
    })
  end

  return {
    time = 0,
    bands = bands,
    streaks = {},
    sortIntensity = 0,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

function PixelSort.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.01)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.decay = decay
  local t = state.time
  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.5, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  if reactive then
    state.decay = Util.lerp(0.06, decay, state.reactiveIntensity)
  end

  -- Update bands (color evolves)
  for _, band in ipairs(state.bands) do
    band.hue = (band.hue + dt * 0.005 * speed) % 1
    band.brightness = 0.2 + (sin(t * 0.5 + band.y * 0.01) + 1) * 0.2 + amp * 0.3
  end

  -- Sort intensity: threshold-based
  local threshold = 0.4
  state.sortIntensity = 0
  if amp > threshold then
    state.sortIntensity = ((amp - threshold) / (1 - threshold)) * reactMul
  end
  if beat then
    state.sortIntensity = math.max(state.sortIntensity, 0.8 * reactMul)
  end

  -- Reactive: mouse speed drives sort intensity
  if reactive and mouse and mouse.inside then
    local mouseIntensity = Util.clamp(mouse.speed * 0.002, 0, 1) * state.reactiveIntensity
    state.sortIntensity = math.max(state.sortIntensity, mouseIntensity)
  end

  -- Spawn sort streaks when intensity is high
  if state.sortIntensity > 0.1 then
    local columnsToSort = floor(w * state.sortIntensity * 0.3)
    local streaksToAdd = floor(columnsToSort * dt * 60 * 0.1)

    for i = 1, streaksToAdd do
      if #state.streaks >= MAX_STREAKS then break end
      local sx
      if reactive and mouse and mouse.inside then
        sx = mouse.x + (random() - 0.5) * w * 0.4
      else
        sx = random() * w
      end
      local spanStart = random() * h
      local spanLen = 20 + random() * h * 0.4
      local brightness = random()
      table.insert(state.streaks, {
        x = sx,
        y = spanStart,
        height = spanLen,
        width = 1 + random() * 2,
        hue = (state.hue + random() * 0.15) % 1,
        brightness = brightness,
        alpha = 0.5 + state.sortIntensity * 0.4,
        age = 0,
        maxAge = 0.5 + random() * 1.5,
      })
    end
  end

  -- Age streaks
  local alive = {}
  for _, streak in ipairs(state.streaks) do
    streak.age = streak.age + dt
    if streak.age < streak.maxAge then
      streak.alpha = streak.alpha * (1 - dt * 1.5)
      if streak.alpha > 0.01 then
        table.insert(alive, streak)
      end
    end
  end
  state.streaks = alive

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function PixelSort.draw(state, w, h)
  -- Background
  if not state.cleared then
    love.graphics.setColor(0.03, 0.03, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.03, 0.03, 0.04, state.decay or 0.01)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  -- Draw base bands
  for _, band in ipairs(state.bands) do
    if band.active then
      local r, g, b = Util.hslToRgb(band.hue, 0.5 + band.brightness * 0.3, band.brightness * 0.4)
      local offset = (band.brightness - 0.5) * 30
      love.graphics.setColor(r, g, b, 0.15)
      love.graphics.rectangle("fill", offset, band.y, w, BAND_HEIGHT)
    end
  end

  -- Draw sort streaks (vertical sorted-pixel columns)
  for _, streak in ipairs(state.streaks) do
    -- Gradient from dark to bright (simulating sorted pixels)
    local segments = 8
    local segH = streak.height / segments
    for i = 0, segments - 1 do
      local brightness = i / segments  -- dark at top, bright at bottom
      local r, g, b = Util.hslToRgb(streak.hue, 0.6, 0.1 + brightness * 0.6)
      love.graphics.setColor(r, g, b, streak.alpha * (0.3 + brightness * 0.7))
      love.graphics.rectangle("fill", streak.x, streak.y + i * segH, streak.width, segH + 1)
    end
  end
end

Effects.register("PixelSort", PixelSort)

return PixelSort
