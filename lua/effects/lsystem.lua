--[[
  effects/lsystem.lua — L-system fractal tree growth

  Fractal trees grow from root points. Active tips branch on beats,
  with angle and length determined by depth and time-varying parameters.
  Leaves spawn as small circles at deep tips.

  React usage:
    <LSystem />
    <LSystem speed={1.5} />
    <LSystem reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt, max, min = math.random, math.floor, math.sqrt, math.max, math.min

local LSystem = {}

local MAX_DEPTH = 10
local MAX_TIPS = 300
local MAX_BRANCHES = 5000

function LSystem.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local baseLength = min(w, h) * 0.12

  local branches = {}
  local activeTips = {}

  -- Create root trunks
  local rootCount = 3
  if not reactive then
    for i = 1, rootCount do
      local x = w * (0.15 + (i - 1) * 0.35)
      local y = h * 0.92
      local trunkLen = baseLength * 0.8
      local endY = y - trunkLen

      table.insert(branches, {
        x1 = x, y1 = y,
        x2 = x, y2 = endY,
        thickness = 8,
        hue = 0.33, -- green trunk
        depth = 0,
        isLeaf = false,
      })

      table.insert(activeTips, {
        x = x, y = endY,
        angle = -pi / 2,
        depth = 1,
        length = baseLength * 0.7,
        thickness = 7,
      })
    end
  end

  return {
    time = 0,
    branches = branches,
    activeTips = activeTips,
    baseLength = baseLength,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    growAccum = 0,
    lastGrowTime = 0,
  }
end

function LSystem.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.008)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.decay = decay
  state.baseLength = min(w, h) * 0.12
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

  -- Self-modulate
  local bass = (sin(t * 0.4) + 1) * 0.5
  local mid = (sin(t * 0.25 + 1.5) + 1) * 0.5
  local high = (sin(t * 0.6 + 3.0) + 1) * 0.5
  local amp = (sin(t * 0.7) + 1) * 0.35 + 0.15

  -- Reactive: seed new roots at mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.3 then
    state.growAccum = state.growAccum + dt * mouse.speed * 0.002 * state.reactiveIntensity
    while state.growAccum >= 1 and #state.activeTips < MAX_TIPS do
      state.growAccum = state.growAccum - 1
      local trunkLen = state.baseLength * 0.6
      table.insert(state.branches, {
        x1 = mouse.x, y1 = mouse.y,
        x2 = mouse.x, y2 = mouse.y - trunkLen,
        thickness = 6,
        hue = state.hue,
        depth = 0,
        isLeaf = false,
      })
      table.insert(state.activeTips, {
        x = mouse.x, y = mouse.y - trunkLen,
        angle = -pi / 2 + (random() - 0.5) * 0.5,
        depth = 1,
        length = state.baseLength * 0.5,
        thickness = 5,
      })
    end
  end

  -- Growth on beats or continuous
  local shouldGrow = false
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.5) > 0.85
  end

  -- Continuous growth accumulation
  local growthRate = (0.5 + amp * 2) * speed * reactMul
  state.growAccum = state.growAccum + dt * growthRate

  if state.growAccum >= 0.3 or isBeat then
    shouldGrow = true
    state.growAccum = 0
  end

  if shouldGrow and #state.activeTips > 0 and #state.branches < MAX_BRANCHES then
    local tipsToGrow = min(#state.activeTips, 5 + floor(amp * 15))
    local newTips = {}

    for i = 1, tipsToGrow do
      local tip = state.activeTips[i]
      if not tip or tip.depth >= MAX_DEPTH then goto continue end

      -- Branch angle from pitch-like parameter (centroid equivalent)
      local centroid = (sin(t * 0.3) + 1) * 0.5
      local baseAngle = 0.2 + (1 - centroid) * 0.5

      -- Length from depth and amplitude
      local lengthFactor = (0.7 ^ tip.depth) * (0.5 + amp)
      local branchLength = tip.length * lengthFactor

      -- Color
      local branchHue = (state.hue + tip.depth * 0.05) % 1

      -- Branch count (1-3)
      local branchCount = bass > 0.5 and 3 or (mid > 0.5 and 2 or 1)
      local asymmetry = (high - bass) * 0.3

      for b = 1, branchCount do
        local newAngle
        if branchCount == 1 then
          newAngle = tip.angle + (random() - 0.5) * baseAngle
        elseif branchCount == 2 then
          newAngle = tip.angle + (b == 1 and -baseAngle or baseAngle) + asymmetry
        else
          newAngle = tip.angle + (b - 2) * baseAngle + asymmetry
        end

        local endX = tip.x + cos(newAngle) * branchLength
        local endY = tip.y + sin(newAngle) * branchLength

        table.insert(state.branches, {
          x1 = tip.x, y1 = tip.y,
          x2 = endX, y2 = endY,
          thickness = tip.thickness * 0.7,
          hue = branchHue,
          depth = tip.depth,
          isLeaf = false,
        })

        if #state.activeTips + #newTips < MAX_TIPS then
          table.insert(newTips, {
            x = endX, y = endY,
            angle = newAngle,
            depth = tip.depth + 1,
            length = branchLength,
            thickness = tip.thickness * 0.7,
          })
        end
      end

      ::continue::
    end

    -- Remove processed tips, add new
    local remaining = {}
    for i = tipsToGrow + 1, #state.activeTips do
      table.insert(remaining, state.activeTips[i])
    end
    for _, tip in ipairs(newTips) do
      table.insert(remaining, tip)
    end
    state.activeTips = remaining

    -- Limit tips
    if #state.activeTips > MAX_TIPS then
      local trimmed = {}
      for i = #state.activeTips - MAX_TIPS + 1, #state.activeTips do
        table.insert(trimmed, state.activeTips[i])
      end
      state.activeTips = trimmed
    end
  end

  -- Spawn leaves at deep tips
  if amp > 0.15 and #state.activeTips > 0 then
    local leafCount = floor(2 + amp * 5)
    for i = 1, leafCount do
      if #state.branches >= MAX_BRANCHES then break end
      local tip = state.activeTips[random(1, #state.activeTips)]
      if tip and tip.depth >= 3 then
        table.insert(state.branches, {
          x1 = tip.x, y1 = tip.y,
          x2 = tip.x + (random() - 0.5) * 8,
          y2 = tip.y + (random() - 0.5) * 8,
          thickness = 2 + amp * 2,
          hue = (state.hue + 0.1 + random() * 0.1) % 1,
          depth = tip.depth,
          isLeaf = true,
        })
      end
    end
  end

  -- Limit branches
  if #state.branches > MAX_BRANCHES then
    local trimmed = {}
    for i = #state.branches - MAX_BRANCHES + 1, #state.branches do
      table.insert(trimmed, state.branches[i])
    end
    state.branches = trimmed
  end

  state.hue = (state.hue + dt * 0.006 * speed) % 1
end

function LSystem.draw(state, w, h)
  -- Very subtle fade for accumulation
  love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.008)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Draw branches
  for _, branch in ipairs(state.branches) do
    local r, g, b = Util.hslToRgb(branch.hue, 0.6, 0.45 + branch.depth * 0.03)

    if branch.isLeaf then
      -- Leaves as circles
      love.graphics.setColor(r, g, b, 0.55)
      love.graphics.circle("fill", branch.x1, branch.y1, branch.thickness)
    else
      -- Branches as lines
      love.graphics.setColor(r, g, b, 0.75)
      love.graphics.setLineWidth(max(0.5, branch.thickness))
      love.graphics.line(branch.x1, branch.y1, branch.x2, branch.y2)
    end
  end
end

Effects.register("LSystem", LSystem)

return LSystem
