--[[
  effects/contours.lua — Topographic contour map via marching squares

  A 2D scalar height field built from noise, sine waves, and gaussian peaks
  is rendered with 12 contour levels using marching squares.

  React usage:
    <Contours />
    <Contours speed={1.5} />
    <Contours reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, abs, exp = math.random, math.floor, math.abs, math.exp
local noise = love.math.noise

local Contours = {}

local CELL_SIZE = 8
local NUM_LEVELS = 12

function Contours.create(w, h, props)
  local cols = floor(w / CELL_SIZE) + 1
  local rows = floor(h / CELL_SIZE) + 1
  local field = {}
  for i = 1, cols * rows do
    field[i] = 0
  end

  return {
    time = 0,
    field = field,
    cols = cols,
    rows = rows,
    peaks = {},
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

function Contours.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.02)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local infinite = Util.boolProp(props, "infinite", false)
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
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Spawn peaks on beats or from mouse
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.7) > 0.93
  end
  if isBeat and reactMul > 0.2 then
    local count = 1 + floor(amp * 2)
    for i = 1, count do
      local px, py = random() * w, random() * h
      if reactive and mouse and mouse.inside then
        px = mouse.x + (random() - 0.5) * 100
        py = mouse.y + (random() - 0.5) * 100
      end
      table.insert(state.peaks, {
        x = px, y = py,
        radius = 80 + amp * 120,
        height = 0.5 + amp * 0.5,
        age = 0,
        maxAge = 5 + random() * 4,
      })
    end
  end

  -- Reactive: spawn peaks at mouse continuously
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
    state.spawnAccum = state.spawnAccum + dt * mouse.speed * 0.005 * state.reactiveIntensity
    while state.spawnAccum >= 1 do
      state.spawnAccum = state.spawnAccum - 1
      table.insert(state.peaks, {
        x = mouse.x + (random() - 0.5) * 30,
        y = mouse.y + (random() - 0.5) * 30,
        radius = 60 + amp * 80,
        height = 0.4 + state.reactiveIntensity * 0.4,
        age = 0,
        maxAge = 3 + random() * 3,
      })
    end
  end

  -- Age peaks
  local alivePeaks = {}
  for _, peak in ipairs(state.peaks) do
    peak.age = peak.age + dt
    if peak.age < peak.maxAge then
      table.insert(alivePeaks, peak)
    end
  end
  state.peaks = alivePeaks

  -- Update height field
  local cols, rows = state.cols, state.rows
  local panX = infinite and t * 0.1 or 0
  local interpSpeed = (0.1 + speed * 0.1) * reactMul

  for r = 0, rows - 1 do
    for c = 0, cols - 1 do
      local px = c * CELL_SIZE
      local py = r * CELL_SIZE
      local idx = r * cols + c + 1

      -- Noise base
      local height = (noise((px * 0.003 + panX), py * 0.003, t * 0.05) - 0.3) * 0.5

      -- Wave ripple
      height = height + sin(px * 0.01 + t) * cos(py * 0.01 + t * 0.7) * 0.1 * amp

      -- Gaussian peaks
      for _, peak in ipairs(state.peaks) do
        local dx = px - peak.x
        local dy = py - peak.y
        local distSq = dx * dx + dy * dy
        local radSq = peak.radius * peak.radius * 0.5
        local falloff = exp(-distSq / radSq)
        local life = 1 - peak.age / peak.maxAge
        height = height + peak.height * falloff * life
      end

      height = Util.clamp(height, 0, 1)

      -- Lerp toward target
      state.field[idx] = state.field[idx] + (height - state.field[idx]) * interpSpeed
    end
  end

  state.hue = (state.hue + dt * 0.005 * speed) % 1
end

function Contours.draw(state, w, h)
  -- Full clear
  love.graphics.setColor(0.03, 0.03, 0.05, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local field = state.field
  local cols, rows = state.cols, state.rows
  local cs = CELL_SIZE

  love.graphics.setLineWidth(1.2)

  -- Draw contour levels via marching squares
  for level = 0, NUM_LEVELS - 1 do
    local threshold = (level + 1) / (NUM_LEVELS + 1)
    local levelHue = (state.hue + level / NUM_LEVELS * 0.4) % 1
    local levelLit = 0.25 + threshold * 0.4
    local r, g, b = Util.hslToRgb(levelHue, 0.6, levelLit)
    love.graphics.setColor(r, g, b, 0.7 + threshold * 0.2)

    for row = 0, rows - 2 do
      for col = 0, cols - 2 do
        local tl = field[row * cols + col + 1]
        local tr = field[row * cols + (col + 1) + 1]
        local br = field[(row + 1) * cols + (col + 1) + 1]
        local bl = field[(row + 1) * cols + col + 1]

        local caseIdx = 0
        if tl >= threshold then caseIdx = caseIdx + 1 end
        if tr >= threshold then caseIdx = caseIdx + 2 end
        if br >= threshold then caseIdx = caseIdx + 4 end
        if bl >= threshold then caseIdx = caseIdx + 8 end

        if caseIdx > 0 and caseIdx < 15 then
          local x0 = col * cs
          local y0 = row * cs

          -- Interpolation helpers
          local function lerpEdge(a, b, th)
            if abs(b - a) < 0.001 then return 0.5 end
            return Util.clamp((th - a) / (b - a), 0, 1)
          end

          local topT = lerpEdge(tl, tr, threshold)
          local rightT = lerpEdge(tr, br, threshold)
          local bottomT = lerpEdge(bl, br, threshold)
          local leftT = lerpEdge(tl, bl, threshold)

          local topX = x0 + topT * cs
          local topY = y0
          local rightX = x0 + cs
          local rightY = y0 + rightT * cs
          local bottomX = x0 + bottomT * cs
          local bottomY = y0 + cs
          local leftX = x0
          local leftY = y0 + leftT * cs

          -- Marching squares line segments
          if caseIdx == 1 or caseIdx == 14 then
            love.graphics.line(leftX, leftY, topX, topY)
          elseif caseIdx == 2 or caseIdx == 13 then
            love.graphics.line(topX, topY, rightX, rightY)
          elseif caseIdx == 3 or caseIdx == 12 then
            love.graphics.line(leftX, leftY, rightX, rightY)
          elseif caseIdx == 4 or caseIdx == 11 then
            love.graphics.line(rightX, rightY, bottomX, bottomY)
          elseif caseIdx == 5 then
            love.graphics.line(leftX, leftY, topX, topY)
            love.graphics.line(rightX, rightY, bottomX, bottomY)
          elseif caseIdx == 6 or caseIdx == 9 then
            love.graphics.line(topX, topY, bottomX, bottomY)
          elseif caseIdx == 7 or caseIdx == 8 then
            love.graphics.line(leftX, leftY, bottomX, bottomY)
          elseif caseIdx == 10 then
            love.graphics.line(topX, topY, rightX, rightY)
            love.graphics.line(leftX, leftY, bottomX, bottomY)
          end
        end
      end
    end
  end
end

Effects.register("Contours", Contours)

return Contours
