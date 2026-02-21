--[[
  effects/stainedglass.lua — Triangular mesh with spring physics and color waves

  A grid of triangulated vertices with spring return forces, where color
  ripple waves propagate outward from periodic spawn points.

  React usage:
    <StainedGlass />
    <StainedGlass speed={0.8} />
    <StainedGlass reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt, atan2 = math.random, math.floor, math.sqrt, math.atan2

local StainedGlass = {}

local GRID_SPACING = 50
local JITTER = 18

local function buildMesh(w, h)
  local cols = floor(w / GRID_SPACING) + 3
  local rows = floor(h / GRID_SPACING) + 3
  local verts = {}
  local tris = {}

  -- Create vertices
  for r = 0, rows - 1 do
    for c = 0, cols - 1 do
      local x = (c - 1) * GRID_SPACING
      local y = (r - 1) * GRID_SPACING
      local isEdge = c == 0 or c == cols - 1 or r == 0 or r == rows - 1
      if not isEdge then
        x = x + (random() - 0.5) * JITTER * 2
        y = y + (random() - 0.5) * JITTER * 2
      end
      table.insert(verts, {
        x = x, y = y,
        homeX = x, homeY = y,
        vx = 0, vy = 0,
      })
    end
  end

  -- Triangulate quads
  for r = 0, rows - 2 do
    for c = 0, cols - 2 do
      local i0 = r * cols + c + 1       -- top-left
      local i1 = r * cols + (c + 1) + 1 -- top-right
      local i2 = (r + 1) * cols + c + 1 -- bottom-left
      local i3 = (r + 1) * cols + (c + 1) + 1 -- bottom-right

      table.insert(tris, {
        v = { i0, i1, i2 },
        hue = random(),
        sat = 0.5 + random() * 0.3,
        lit = 0.3 + random() * 0.2,
        targetHue = 0,
        targetSat = 0.5,
        targetLit = 0.35,
      })
      table.insert(tris, {
        v = { i1, i3, i2 },
        hue = random(),
        sat = 0.5 + random() * 0.3,
        lit = 0.3 + random() * 0.2,
        targetHue = 0,
        targetSat = 0.5,
        targetLit = 0.35,
      })
    end
  end

  return verts, tris, cols, rows
end

function StainedGlass.create(w, h, props)
  local verts, tris, cols, rows = buildMesh(w, h)
  return {
    time = 0,
    verts = verts,
    tris = tris,
    cols = cols,
    rows = rows,
    waves = {},
    hue = random(),
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

function StainedGlass.update(state, dt, props, w, h, mouse)
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
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Spring physics on vertices
  local returnStrength = (0.05 + amp * 0.1) * reactMul
  for _, v in ipairs(state.verts) do
    v.vx = v.vx + (v.homeX - v.x) * returnStrength
    v.vy = v.vy + (v.homeY - v.y) * returnStrength
    v.vx = v.vx * 0.9
    v.vy = v.vy * 0.9
    v.x = v.x + v.vx
    v.y = v.y + v.vy
  end

  -- Vertex disturbance from amplitude
  if amp > 0.3 and reactMul > 0.1 then
    local force = (amp - 0.3) * 3 * reactMul
    local cx, cy = w / 2, h / 2
    if reactive and mouse and mouse.inside then
      cx, cy = mouse.x, mouse.y
    end
    for _, v in ipairs(state.verts) do
      local dx = v.x - cx
      local dy = v.y - cy
      local dist = sqrt(dx * dx + dy * dy)
      if dist > 1 then
        v.vx = v.vx + (dx / dist) * force * (0.5 + random() * 0.5)
        v.vy = v.vy + (dy / dist) * force * (0.5 + random() * 0.5)
      end
    end
  end

  -- Color waves
  local isBeat = beat
  if not beat then
    isBeat = sin(t * pi * 0.7) > 0.93
  end

  -- Spawn wave on beat or periodically
  state.spawnAccum = state.spawnAccum + dt * (0.3 + amp * 0.5) * speed * reactMul
  local shouldSpawn = isBeat or state.spawnAccum >= 1
  if state.spawnAccum >= 1 then state.spawnAccum = state.spawnAccum - 1 end

  if shouldSpawn then
    local wx, wy = random() * w, random() * h
    if reactive and mouse and mouse.inside then
      wx, wy = mouse.x + (random() - 0.5) * 100, mouse.y + (random() - 0.5) * 100
    end
    table.insert(state.waves, {
      x = wx, y = wy,
      radius = 0,
      speed = 8 * (1 + speed),
      maxRadius = math.max(w, h) * 1.5,
      waveWidth = 100,
      hue = (state.hue + random() * 0.2) % 1,
      sat = 0.6 + amp * 0.3,
      lit = 0.35 + amp * 0.25,
    })
  end

  -- Update waves and affect triangles
  local aliveWaves = {}
  for _, wave in ipairs(state.waves) do
    wave.radius = wave.radius + wave.speed * (1 + speed) * dt * 60
    if wave.radius < wave.maxRadius then
      table.insert(aliveWaves, wave)

      local fadeOut = 1 - wave.radius / wave.maxRadius
      -- Affect triangles in the wavefront band
      for _, tri in ipairs(state.tris) do
        local v0 = state.verts[tri.v[1]]
        local v1 = state.verts[tri.v[2]]
        local v2 = state.verts[tri.v[3]]
        local cx = (v0.x + v1.x + v2.x) / 3
        local cy = (v0.y + v1.y + v2.y) / 3
        local dist = Util.dist(cx, cy, wave.x, wave.y)
        local diff = math.abs(dist - wave.radius)
        if diff < wave.waveWidth then
          local intensity = (1 - diff / wave.waveWidth) * fadeOut
          tri.targetHue = wave.hue + (random() - 0.5) * 0.05
          tri.targetSat = Util.lerp(tri.targetSat, wave.sat, intensity)
          tri.targetLit = Util.lerp(tri.targetLit, wave.lit, intensity)
        end
      end
    end
  end
  state.waves = aliveWaves

  -- Interpolate triangle colors
  local colorSpeed = (0.05 + speed * 0.1) * dt * 60
  for _, tri in ipairs(state.tris) do
    tri.hue = tri.hue + (tri.targetHue - tri.hue) * colorSpeed
    tri.sat = tri.sat + (tri.targetSat - tri.sat) * colorSpeed
    tri.lit = tri.lit + (tri.targetLit - tri.lit) * colorSpeed
  end

  state.hue = (state.hue + dt * 0.01 * speed) % 1
end

function StainedGlass.draw(state, w, h)
  -- Solid background (no trail accumulation needed)
  love.graphics.setColor(0.04, 0.04, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local verts = state.verts

  -- Fill triangles
  for _, tri in ipairs(state.tris) do
    local v0 = verts[tri.v[1]]
    local v1 = verts[tri.v[2]]
    local v2 = verts[tri.v[3]]
    local r, g, b = Util.hslToRgb(tri.hue % 1, tri.sat, tri.lit)
    love.graphics.setColor(r, g, b, 0.9)
    love.graphics.polygon("fill", v0.x, v0.y, v1.x, v1.y, v2.x, v2.y)
  end

  -- Leading (dark outlines between panes)
  love.graphics.setLineWidth(2.5)
  love.graphics.setColor(0.04, 0.04, 0.04, 0.85)
  for _, tri in ipairs(state.tris) do
    local v0 = verts[tri.v[1]]
    local v1 = verts[tri.v[2]]
    local v2 = verts[tri.v[3]]
    love.graphics.polygon("line", v0.x, v0.y, v1.x, v1.y, v2.x, v2.y)
  end

  -- Solder joints at vertices
  love.graphics.setColor(0.06, 0.06, 0.06, 0.7)
  for _, v in ipairs(verts) do
    love.graphics.circle("fill", v.x, v.y, 2.5)
  end
end

Effects.register("StainedGlass", StainedGlass)

return StainedGlass
