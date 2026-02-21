--[[
  effects/terrain.lua — Scrolling parallax mountain terrain

  24 layers of mountain silhouettes scrolling at different speeds,
  creating depth through parallax. Heights evolve from noise,
  colors shift slowly for a living landscape.

  React usage:
    <Terrain />
    <Terrain speed={1.5} />
    <Terrain reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, max, min = math.random, math.floor, math.max, math.min
local noise = love.math.noise

local Terrain = {}

local NUM_LAYERS = 24
local HISTORY_LENGTH = 120

function Terrain.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local layers = {}

  for i = 1, NUM_LAYERS do
    local depth = (i - 1) / NUM_LAYERS
    local heights = {}
    for j = 1, HISTORY_LENGTH do
      heights[j] = 0
    end
    layers[i] = {
      heights = heights,
      depth = depth,
      yBase = h * (0.95 - (i - 1) * (0.7 / NUM_LAYERS)),
      amplitude = 0.15 - depth * 0.08,
      scrollOffset = 0,
      hueOffset = (i - 1) / NUM_LAYERS + (random() - 0.5) * 0.1,
      speedVariance = 0.8 + random() * 0.4,
      freqBand = ((i - 1) % 8) + 1,
    }
  end

  return {
    time = 0,
    layers = layers,
    hue = random(),
    reactiveIntensity = 0,
  }
end

function Terrain.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local amplitude = Util.prop(props, "amplitude", nil)
  local reactive = Util.boolProp(props, "reactive", false)
  local infinite = Util.boolProp(props, "infinite", false)

  state.time = state.time + dt * speed
  local t = state.time

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)
  if reactive then
    amp = amp * reactMul
  end

  -- Simulate frequency bands from time oscillation
  local bands = {}
  for b = 1, 8 do
    bands[b] = (sin(t * (0.3 + b * 0.15) + b * 1.7) + 1) * 0.5 * amp
  end

  -- If reactive, mouse Y position influences bands
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    local my = mouse.y / h
    for b = 1, 8 do
      bands[b] = bands[b] + (1 - my) * state.reactiveIntensity * 0.3
    end
  end

  local scrollSpeed = 2 * speed
  if infinite then
    scrollSpeed = scrollSpeed * 1.5
  end

  for i, layer in ipairs(state.layers) do
    local bandVal = bands[layer.freqBand] or amp

    -- Scroll
    layer.scrollOffset = layer.scrollOffset + scrollSpeed * (0.3 + layer.depth * 0.7) * layer.speedVariance * dt * 60

    -- Add new height value
    local heightVariance = 1 + sin(t + i) * 0.15
    local newHeight = bandVal * h * layer.amplitude * heightVariance

    -- Perlin noise contribution for organic feel
    local noiseVal = noise(t * 0.1 + i * 10, layer.scrollOffset * 0.01) * h * layer.amplitude * 0.5
    newHeight = newHeight + noiseVal

    table.insert(layer.heights, newHeight)
    if #layer.heights > HISTORY_LENGTH then
      table.remove(layer.heights, 1)
    end

    -- Update yBase for resize
    layer.yBase = h * (0.95 - (i - 1) * (0.7 / NUM_LAYERS))
  end

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Terrain.draw(state, w, h)
  -- Sky gradient (dark top to slightly lighter bottom)
  love.graphics.setColor(0.04, 0.04, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Draw layers back to front
  for i = NUM_LAYERS, 1, -1 do
    local layer = state.layers[i]
    local heights = layer.heights
    local yBase = layer.yBase
    local depth = layer.depth
    local segmentWidth = w / (HISTORY_LENGTH - 1)

    -- Color based on layer hue and depth
    local layerHue = (state.hue + layer.hueOffset) % 1
    local depthFade = 1 - depth * 0.7
    local layerLit = (0.15 + depthFade * 0.35)
    local layerSat = 0.5 + depthFade * 0.3
    local r, g, b = Util.hslToRgb(layerHue, layerSat, layerLit)

    -- Apply depth darkening
    r = r * depthFade
    g = g * depthFade
    b = b * depthFade

    local layerAlpha = 0.6 + (1 - depth) * 0.35

    -- Build mountain polygon
    local verts = {}
    -- Start at bottom-left
    table.insert(verts, 0)
    table.insert(verts, h)

    -- Mountain silhouette
    for j = 1, #heights do
      local x = (j - 1) * segmentWidth
      local y = yBase - heights[j]
      table.insert(verts, x)
      table.insert(verts, y)
    end

    -- Close at bottom-right
    table.insert(verts, w)
    table.insert(verts, h)

    -- Draw filled polygon
    if #verts >= 6 then
      love.graphics.setColor(r, g, b, layerAlpha)
      local ok, tri = pcall(love.math.triangulate, verts)
      if ok and tri then
        for _, triangle in ipairs(tri) do
          love.graphics.polygon("fill", triangle)
        end
      end
    end

    -- Edge highlight on front layers
    if i <= 6 then
      local highlightAlpha = (1 - (i - 1) / 6) * 0.3 * depthFade
      love.graphics.setColor(min(1, r + 0.2), min(1, g + 0.2), min(1, b + 0.2), highlightAlpha)
      love.graphics.setLineWidth(1)
      -- Draw just the mountain top edge
      for j = 2, #heights do
        local x1 = (j - 2) * segmentWidth
        local y1 = yBase - heights[j - 1]
        local x2 = (j - 1) * segmentWidth
        local y2 = yBase - heights[j]
        love.graphics.line(x1, y1, x2, y2)
      end
    end
  end
end

Effects.register("Terrain", Terrain)

return Terrain
