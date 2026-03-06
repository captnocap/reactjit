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

local function addRoot(state, x, y, baseLength, hue, angleJitter, thickness)
  local trunkLen = baseLength * (0.72 + random() * 0.2)
  local angle = -pi / 2 + angleJitter
  local endX = x + cos(angle) * trunkLen
  local endY = y + sin(angle) * trunkLen

  table.insert(state.branches, {
    x1 = x, y1 = y,
    x2 = endX, y2 = endY,
    thickness = thickness,
    hue = hue,
    depth = 0,
    isLeaf = false,
  })

  table.insert(state.activeTips, {
    x = endX, y = endY,
    angle = angle,
    depth = 1,
    length = trunkLen,
    thickness = thickness * 0.82,
  })
end

local function seedForest(state, w, h, baseLength, count, hue)
  local y = h * 0.92
  for i = 1, count do
    local x = w * (0.12 + (i - 1) * (0.76 / max(1, count - 1)))
    addRoot(state, x, y, baseLength, hue, (random() - 0.5) * 0.25, 7 + random() * 1.5)
  end
end

function LSystem.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local baseLength = min(w, h) * 0.12

  local branches = {}
  local activeTips = {}

  local state = {
    time = 0,
    branches = branches,
    activeTips = activeTips,
    baseLength = baseLength,
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    growAccum = 0,
    rootCooldown = 0.2,
    decay = Util.clamp(Util.prop(props, "decay", 0.016), 0.004, 0.08),
  }
  if not reactive then
    seedForest(state, w, h, baseLength, 3, 0.31)
  end
  return state
end

function LSystem.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.016)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.rootCooldown = max(0, state.rootCooldown - dt)
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

  if reactive then
    state.decay = Util.lerp(0.04, Util.clamp(decay, 0.004, 0.08), state.reactiveIntensity)
  else
    state.decay = Util.clamp(decay, 0.004, 0.08)
  end

  -- Self-modulate
  local bass = Util.prop(props, "bass", (sin(t * 0.4) + 1) * 0.5)
  local mid = Util.prop(props, "mid", (sin(t * 0.25 + 1.5) + 1) * 0.5)
  local high = Util.prop(props, "high", (sin(t * 0.6 + 3.0) + 1) * 0.5)
  local amp = amplitude or ((sin(t * 0.7) + 1) * 0.35 + 0.15)

  -- Reactive: seed new roots at mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.3 then
    state.growAccum = state.growAccum + dt * mouse.speed * 0.005 * state.reactiveIntensity
    while state.growAccum >= 1 and #state.activeTips < MAX_TIPS do
      state.growAccum = state.growAccum - 1
      addRoot(
        state,
        mouse.x + (random() - 0.5) * 12,
        mouse.y + (random() - 0.5) * 12,
        state.baseLength * 0.9,
        state.hue,
        (random() - 0.5) * 0.5,
        5.5
      )
    end
  end

  -- Growth on beats or continuous
  local shouldGrow = false
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.5) > 0.85
  end

  -- Continuous growth accumulation
  local growthRate = (1.4 + amp * 3.2 + bass * 1.2) * speed * reactMul
  state.growAccum = state.growAccum + dt * growthRate

  if state.growAccum >= 0.18 or isBeat then
    shouldGrow = true
  end

  while shouldGrow and state.growAccum >= 0.18 and #state.activeTips > 0 and #state.branches < MAX_BRANCHES do
    state.growAccum = state.growAccum - 0.18
    local tipsToGrow = min(#state.activeTips, 4 + floor(amp * 18 + bass * 8))
    local newTips = {}

    for i = 1, tipsToGrow do
      local tip = state.activeTips[i]
      if tip then
        local centroid = (sin(t * 0.3) + 1) * 0.5
        local baseAngle = 0.18 + (1 - centroid) * 0.45 + high * 0.12
        
        local effDepth = (tip.depth - 1) % MAX_DEPTH + 1
        local branchLength = max(2.2, state.baseLength * (0.9 ^ (effDepth - 1)) * (0.55 + amp * 0.85))
        local branchHue = (state.hue + tip.depth * 0.05) % 1
        local asymmetry = (high - bass) * 0.25
        local energy = bass * 0.45 + mid * 0.35 + amp * 0.5

        local branchCount = 1
        if energy > 0.42 and effDepth < MAX_DEPTH - 1 then branchCount = 2 end
        if (isBeat or bass > 0.72) and effDepth < 4 then branchCount = 3 end
        if effDepth > 6 then branchCount = 1 end

        for b = 1, branchCount do
          local newAngle
          if branchCount == 1 then
            newAngle = tip.angle + (random() - 0.5) * (baseAngle * 0.6)
          elseif branchCount == 2 then
            newAngle = tip.angle + (b == 1 and -baseAngle or baseAngle) * 0.92 + asymmetry
          else
            newAngle = tip.angle + (b - 2) * baseAngle + asymmetry
          end

          local endX = tip.x + cos(newAngle) * branchLength
          local endY = tip.y + sin(newAngle) * branchLength
          local newThickness = max(0.35, tip.thickness * (0.62 + random() * 0.08))
          if effDepth == 1 and tip.depth > 1 then
            newThickness = max(newThickness, 1.5)
          end

          table.insert(state.branches, {
            x1 = tip.x, y1 = tip.y,
            x2 = endX, y2 = endY,
            thickness = newThickness,
            hue = branchHue,
            depth = tip.depth,
            isLeaf = false,
          })

          table.insert(newTips, {
            x = endX, y = endY,
            angle = newAngle,
            depth = tip.depth + 1,
            length = branchLength,
            thickness = newThickness,
          })
        end
      end
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

    if not reactive and #state.activeTips == 0 and state.rootCooldown <= 0 then
      seedForest(state, w, h, state.baseLength, 2 + floor(random() * 2), (state.hue + 0.05) % 1)
      state.rootCooldown = 0.9 + random() * 0.6
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
