--[[
  effects/mycelium.lua — Agent-based mycelium growth network

  Growth tips walk forward via noise-steered angles, leaving polyline trails,
  occasionally branching. Synapse connections form between nearby tips.

  React usage:
    <Mycelium />
    <Mycelium speed={1.5} decay={0.02} />
    <Mycelium reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt = math.random, math.floor, math.sqrt

local Mycelium = {}

local MAX_TIPS = 120
local MAX_SYNAPSES = 200

-- Cheap deterministic noise (from the JS source)
local function noise3D(x, y, z)
  local v = math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return (v - floor(v)) * 2 - 1
end

local function newTip(x, y, angle, speed, hue)
  return {
    x = x, y = y,
    angle = angle,
    speed = speed,
    path = { x, y },
    age = 0,
    maxAge = 500 + random() * 200,
    alive = true,
    branchCooldown = 30 + random() * 20,
    hue = hue,
    alpha = 0.8,
  }
end

function Mycelium.create(w, h, props)
  local reactive = Util.boolProp(props, "reactive", false)
  local tips = {}
  if not reactive then
    for i = 1, 8 do
      table.insert(tips, newTip(
        random() * w, random() * h,
        random() * pi * 2,
        3.5 * (0.8 + random() * 0.4),
        random()
      ))
    end
  end

  return {
    time = 0,
    tips = tips,
    deadPaths = {},
    synapses = {},
    hue = random(),
    cleared = false,
    spawnAccum = 0,
    reactiveIntensity = 0,
    panX = 0,
    panY = 0,
  }
end

function Mycelium.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.02)
  local beat = Util.boolProp(props, "beat", false)
  local amplitude = Util.prop(props, "amplitude", nil)
  local infinite = Util.boolProp(props, "infinite", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.decay = decay

  local t = state.time

  -- Infinite: pan offset for noise sampling
  if infinite then
    state.panX = state.panX + dt * 20 * speed
    state.panY = state.panY + dt * 8 * speed
  end

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 2.5, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  if reactive then
    state.decay = Util.lerp(0.08, decay, state.reactiveIntensity)
  end

  local amp = amplitude or ((sin(t * 0.7) + 1) * 0.3 + 0.25)
  local tipSpeed = (3.5 + amp * 2) * speed

  -- Grow alive tips
  local aliveTips = {}
  for _, tip in ipairs(state.tips) do
    if tip.alive then
      -- Noise steering
      local nx = (tip.x + state.panX) * 0.015
      local ny = (tip.y + state.panY) * 0.005
      local noiseAngle = noise3D(nx, ny, t * 0.5) * pi
      tip.angle = tip.angle + noiseAngle * 0.1

      local moveSpeed = tipSpeed * (0.8 + random() * 0.4) * reactMul
      tip.x = tip.x + cos(tip.angle) * moveSpeed * dt * 60
      tip.y = tip.y + sin(tip.angle) * moveSpeed * dt * 60
      tip.age = tip.age + dt * 60

      -- Store path point
      table.insert(tip.path, tip.x)
      table.insert(tip.path, tip.y)
      -- Cap path length
      if #tip.path > 600 then
        table.remove(tip.path, 1)
        table.remove(tip.path, 1)
      end

      -- Branching
      tip.branchCooldown = tip.branchCooldown - 1
      if tip.branchCooldown <= 0 and #state.tips < MAX_TIPS then
        local branchProb = (0.01 + amp * 0.02) * reactMul
        if random() < branchProb then
          local bAngle = tip.angle + (random() - 0.5) * pi * 0.8
          local child = newTip(tip.x, tip.y, bAngle, tip.speed * 0.9, (tip.hue + random() * 0.05) % 1)
          table.insert(state.tips, child)
          tip.branchCooldown = 30 + floor(random() * 20)
        end
      end

      -- Death check
      local margin = 50
      if tip.x < -margin or tip.x > w + margin or
         tip.y < -margin or tip.y > h + margin or
         tip.age > tip.maxAge then
        tip.alive = false
        if #tip.path >= 4 then
          table.insert(state.deadPaths, { path = tip.path, hue = tip.hue, alpha = 0.4 })
        end
      else
        table.insert(aliveTips, tip)
      end
    end
  end
  state.tips = aliveTips

  -- Cap dead paths
  while #state.deadPaths > 80 do
    table.remove(state.deadPaths, 1)
  end

  -- Synapse connections (between close tips)
  if #state.tips > 1 and random() < 0.05 * reactMul then
    for i = 1, #state.tips do
      for j = i + 1, #state.tips do
        if #state.synapses >= MAX_SYNAPSES then break end
        local dx = state.tips[j].x - state.tips[i].x
        local dy = state.tips[j].y - state.tips[i].y
        local dist = sqrt(dx * dx + dy * dy)
        if dist > 5 and dist < 40 then
          table.insert(state.synapses, {
            x1 = state.tips[i].x, y1 = state.tips[i].y,
            x2 = state.tips[j].x, y2 = state.tips[j].y,
            alpha = 0.6,
            hue = (state.tips[i].hue + state.tips[j].hue) * 0.5,
          })
        end
      end
    end
  end

  -- Fade synapses
  local aliveConns = {}
  for _, syn in ipairs(state.synapses) do
    syn.alpha = syn.alpha - dt * 0.3
    if syn.alpha > 0.02 then
      table.insert(aliveConns, syn)
    end
  end
  state.synapses = aliveConns

  -- Spawn: beat or reactive mouse
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.8) > 0.96
  end
  if isBeat and reactMul > 0.3 then
    local count = 1 + floor(amp * 3)
    for i = 1, count do
      if #state.tips >= MAX_TIPS then break end
      table.insert(state.tips, newTip(
        random() * w, random() * h,
        random() * pi * 2,
        tipSpeed * (0.8 + random() * 0.4),
        (state.hue + random() * 0.1) % 1
      ))
    end
  end

  -- Reactive: spawn at mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
    state.spawnAccum = state.spawnAccum + dt * (0.5 + mouse.speed * 0.003) * state.reactiveIntensity
    while state.spawnAccum >= 1 and #state.tips < MAX_TIPS do
      state.spawnAccum = state.spawnAccum - 1
      local angle = random() * pi * 2
      table.insert(state.tips, newTip(
        mouse.x + (random() - 0.5) * 20,
        mouse.y + (random() - 0.5) * 20,
        angle, tipSpeed * 0.8,
        (state.hue + random() * 0.1) % 1
      ))
    end
  end

  -- Keep at least a few tips alive in non-reactive mode
  if not reactive and #state.tips < 3 then
    for i = 1, 3 - #state.tips do
      table.insert(state.tips, newTip(
        random() * w, random() * h,
        random() * pi * 2,
        tipSpeed,
        (state.hue + random() * 0.1) % 1
      ))
    end
  end

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Mycelium.draw(state, w, h)
  if not state.cleared then
    love.graphics.setColor(0.02, 0.02, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.02, 0.02, 0.04, state.decay or 0.02)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  -- Dead paths
  love.graphics.setLineWidth(1)
  for _, dp in ipairs(state.deadPaths) do
    if #dp.path >= 4 then
      local r, g, b = Util.hslToRgb(dp.hue, 0.5, 0.35)
      love.graphics.setColor(r, g, b, dp.alpha)
      love.graphics.line(dp.path)
    end
  end

  -- Synapses
  love.graphics.setLineWidth(1)
  for _, syn in ipairs(state.synapses) do
    local r, g, b = Util.hslToRgb(syn.hue, 0.7, 0.6)
    love.graphics.setColor(r, g, b, syn.alpha)
    love.graphics.line(syn.x1, syn.y1, syn.x2, syn.y2)
    love.graphics.circle("fill", (syn.x1 + syn.x2) / 2, (syn.y1 + syn.y2) / 2, 1.5)
  end

  -- Alive tips: paths + glowing head
  love.graphics.setLineWidth(1.5)
  for _, tip in ipairs(state.tips) do
    if #tip.path >= 4 then
      local r, g, b = Util.hslToRgb(tip.hue, 0.6, 0.5)
      love.graphics.setColor(r, g, b, tip.alpha * 0.7)
      love.graphics.line(tip.path)
    end

    -- Glowing head
    local r, g, b = Util.hslToRgb(tip.hue, 0.8, 0.7)
    love.graphics.setColor(r, g, b, 0.4)
    love.graphics.circle("fill", tip.x, tip.y, 6)
    love.graphics.setColor(1, 1, 1, 0.8)
    love.graphics.circle("fill", tip.x, tip.y, 2)
  end
end

Effects.register("Mycelium", Mycelium)

return Mycelium
