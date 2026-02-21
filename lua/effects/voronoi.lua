--[[
  effects/voronoi.lua — Voronoi diagram with spring-physics sites

  N seed points with spring return forces define colored nearest-neighbor
  regions. Beats explode sites outward, creating organic cell deformation.
  Rendered via brute-force on a coarse grid for performance.

  React usage:
    <Voronoi />
    <Voronoi speed={1.5} />
    <Voronoi reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt = math.random, math.floor, math.sqrt

local Voronoi = {}

local NUM_SITES = 40
local CELL_SIZE = 6  -- render resolution (pixels per cell)

local function poissonDisk(w, h, n)
  local sites = {}
  local minSep = sqrt(w * h / n) * 0.7
  local minSepSq = minSep * minSep
  for i = 1, n do
    local placed = false
    for attempt = 1, 20 do
      local x = random() * w
      local y = random() * h
      local ok = true
      for _, s in ipairs(sites) do
        local dx = x - s.homeX
        local dy = y - s.homeY
        if dx * dx + dy * dy < minSepSq then
          ok = false
          break
        end
      end
      if ok then
        table.insert(sites, {
          x = x, y = y,
          homeX = x, homeY = y,
          vx = 0, vy = 0,
          hue = random(),
          sat = 0.5 + random() * 0.3,
          lit = 0.35 + random() * 0.2,
        })
        placed = true
        break
      end
    end
    if not placed then
      local x, y = random() * w, random() * h
      table.insert(sites, {
        x = x, y = y,
        homeX = x, homeY = y,
        vx = 0, vy = 0,
        hue = random(),
        sat = 0.5 + random() * 0.3,
        lit = 0.35 + random() * 0.2,
      })
    end
  end
  return sites
end

function Voronoi.create(w, h, props)
  return {
    time = 0,
    sites = poissonDisk(w, h, NUM_SITES),
    hue = random(),
    reactiveIntensity = 0,
    gridCols = floor(w / CELL_SIZE) + 1,
    gridRows = floor(h / CELL_SIZE) + 1,
  }
end

function Voronoi.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
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

  -- Spring physics
  local attractStrength = (0.02 + (1 - amp) * 0.05) * reactMul
  for _, site in ipairs(state.sites) do
    site.vx = site.vx + (site.homeX - site.x) * attractStrength
    site.vy = site.vy + (site.homeY - site.y) * attractStrength
    site.vx = site.vx * 0.92
    site.vy = site.vy * 0.92
    site.x = site.x + site.vx
    site.y = site.y + site.vy
  end

  -- Reactive: mouse repels nearby sites
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    local repelForce = mouse.speed * 0.02 * state.reactiveIntensity
    for _, site in ipairs(state.sites) do
      local dx = site.x - mouse.x
      local dy = site.y - mouse.y
      local dist = sqrt(dx * dx + dy * dy)
      if dist < 150 and dist > 1 then
        local force = repelForce * (1 - dist / 150)
        site.vx = site.vx + (dx / dist) * force
        site.vy = site.vy + (dy / dist) * force
      end
    end
  end

  -- Beat explosion
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.9) > 0.95
  end
  if isBeat and reactMul > 0.2 then
    local force = amp * 15 * reactMul
    local cx, cy = w / 2, h / 2
    if reactive and mouse and mouse.inside then
      cx, cy = mouse.x, mouse.y
    end
    for _, site in ipairs(state.sites) do
      local dx = site.x - cx
      local dy = site.y - cy
      local dist = sqrt(dx * dx + dy * dy)
      if dist < 1 then dist = 1 end
      site.vx = site.vx + (dx / dist) * force
      site.vy = site.vy + (dy / dist) * force
    end
  end

  -- Drift site colors
  for _, site in ipairs(state.sites) do
    site.hue = (site.hue + dt * 0.005 * speed) % 1
  end

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Voronoi.draw(state, w, h)
  -- Full clear (redraws all cells each frame)
  love.graphics.setColor(0.04, 0.04, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local sites = state.sites
  local numSites = #sites
  local cellSize = CELL_SIZE

  -- Brute-force nearest-neighbor rendering on coarse grid
  for gy = 0, state.gridRows - 1 do
    local py = gy * cellSize + cellSize * 0.5
    for gx = 0, state.gridCols - 1 do
      local px = gx * cellSize + cellSize * 0.5
      local minDist = 1e9
      local secondDist = 1e9
      local nearest = nil
      for _, site in ipairs(sites) do
        local dx = px - site.x
        local dy = py - site.y
        local dist = dx * dx + dy * dy
        if dist < minDist then
          secondDist = minDist
          minDist = dist
          nearest = site
        elseif dist < secondDist then
          secondDist = dist
        end
      end
      if nearest then
        -- Edge detection: thin band where second-nearest is close
        local edge = sqrt(secondDist) - sqrt(minDist)
        local isEdge = edge < 4

        if isEdge then
          love.graphics.setColor(0.06, 0.06, 0.08, 0.9)
        else
          local r, g, b = Util.hslToRgb(nearest.hue, nearest.sat, nearest.lit)
          love.graphics.setColor(r, g, b, 0.85)
        end
        love.graphics.rectangle("fill", gx * cellSize, gy * cellSize, cellSize, cellSize)
      end
    end
  end
end

Effects.register("Voronoi", Voronoi)

return Voronoi
