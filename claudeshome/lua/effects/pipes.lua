--[[
  effects/pipes.lua — Classic screensaver-style 3D pipes

  Pipes grow on a grid, turning 90 degrees at joints, with 3D shading
  and spherical joints.

  React usage:
    <Pipes />
    <Pipes speed={2} />
    <Pipes reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, abs = math.random, math.floor, math.abs

local Pipes = {}

local GRID_SIZE = 40
local MAX_PIPES = 8

-- Direction vectors: right, down, left, up
local DX = { 1, 0, -1, 0 }
local DY = { 0, 1, 0, -1 }

local function snapToGrid(v, gridSize, maxV)
  return floor(random() * floor(maxV / gridSize)) * gridSize + floor(gridSize / 2)
end

local function newPipe(w, h, hue, speed)
  local dir = random(4)
  return {
    x = snapToGrid(0, GRID_SIZE, w),
    y = snapToGrid(0, GRID_SIZE, h),
    dir = dir,
    segments = {},
    joints = {},
    length = 0,
    maxLength = 500 + random() * 1000,
    growing = true,
    hue = hue,
    thickness = 6 + random() * 4,
    lastJointX = 0,
    lastJointY = 0,
    speed = speed,
  }
end

function Pipes.create(w, h, props)
  local hue = random()
  return {
    time = 0,
    pipes = { newPipe(w, h, hue, 4) },
    hue = hue,
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

function Pipes.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.01)
  local beat = Util.boolProp(props, "beat", false)
  local amplitude = Util.prop(props, "amplitude", nil)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  state.decay = decay

  local t = state.time
  local amp = amplitude or ((sin(t * 0.8) + 1) * 0.3 + 0.2)

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
    state.decay = Util.lerp(0.08, decay, state.reactiveIntensity)
  end

  local growthSpeed = (2 + amp * 8) * speed * reactMul * dt * 60

  -- Grow pipes
  local growingCount = 0
  for _, pipe in ipairs(state.pipes) do
    if pipe.growing and reactMul > 0.05 then
      growingCount = growingCount + 1
      local dx = DX[pipe.dir] * growthSpeed
      local dy = DY[pipe.dir] * growthSpeed

      local prevX, prevY = pipe.x, pipe.y
      pipe.x = pipe.x + dx
      pipe.y = pipe.y + dy
      pipe.length = pipe.length + growthSpeed

      -- Store segment
      table.insert(pipe.segments, { prevX, prevY, pipe.x, pipe.y, pipe.hue, pipe.thickness })

      -- Turn check
      local distFromJoint = Util.dist(pipe.x, pipe.y, pipe.lastJointX, pipe.lastJointY)
      local turnChance = 0.02 + amp * 0.1
      if beat then turnChance = 0.8 end

      if distFromJoint >= GRID_SIZE and random() < turnChance then
        -- Save joint
        table.insert(pipe.joints, { pipe.x, pipe.y, pipe.hue, pipe.thickness })
        pipe.lastJointX = pipe.x
        pipe.lastJointY = pipe.y
        -- Turn
        local turn = random() < 0.5 and 1 or -1
        pipe.dir = ((pipe.dir - 1 + turn) % 4) + 1
        pipe.hue = (pipe.hue + 0.03) % 1
      end

      -- Out of bounds: reset position
      if pipe.x < -20 or pipe.x > w + 20 or pipe.y < -20 or pipe.y > h + 20 then
        pipe.x = snapToGrid(0, GRID_SIZE, w)
        pipe.y = snapToGrid(0, GRID_SIZE, h)
        pipe.lastJointX = pipe.x
        pipe.lastJointY = pipe.y
        pipe.dir = random(4)
        table.insert(pipe.joints, { pipe.x, pipe.y, pipe.hue, pipe.thickness })
      end

      -- Max length reached
      if pipe.length > pipe.maxLength then
        pipe.growing = false
      end
    end
  end

  -- Cap segments (memory)
  for _, pipe in ipairs(state.pipes) do
    while #pipe.segments > 2000 do
      table.remove(pipe.segments, 1)
    end
  end

  -- Ensure enough growing pipes
  local target = reactive and (state.reactiveIntensity > 0.1 and 3 or 0) or 3
  if growingCount < target and #state.pipes < MAX_PIPES then
    state.hue = (state.hue + 0.15) % 1
    local p = newPipe(w, h, state.hue, 4)
    if reactive and mouse and mouse.inside then
      p.x = mouse.x
      p.y = mouse.y
    end
    p.lastJointX = p.x
    p.lastJointY = p.y
    table.insert(p.joints, { p.x, p.y, p.hue, p.thickness })
    table.insert(state.pipes, p)
  end

  -- Beat: spawn extra pipe
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 1.2) > 0.95
  end
  if isBeat and #state.pipes < MAX_PIPES and reactMul > 0.3 then
    state.hue = (state.hue + 0.2) % 1
    local p = newPipe(w, h, state.hue, 6)
    if reactive and mouse and mouse.inside then
      p.x = mouse.x
      p.y = mouse.y
    end
    p.lastJointX = p.x
    p.lastJointY = p.y
    table.insert(p.joints, { p.x, p.y, p.hue, p.thickness })
    table.insert(state.pipes, p)
  end
end

function Pipes.draw(state, w, h)
  if not state.cleared then
    love.graphics.setColor(0.04, 0.03, 0.06, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.03, 0.06, state.decay or 0.01)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  for _, pipe in ipairs(state.pipes) do
    -- Draw segments with 3D shading
    for _, seg in ipairs(pipe.segments) do
      local x1, y1, x2, y2, hue, thick = seg[1], seg[2], seg[3], seg[4], seg[5], seg[6]
      local r, g, b = Util.hslToRgb(hue, 0.6, 0.4)

      -- Shadow
      love.graphics.setLineWidth(thick * 1.2)
      love.graphics.setColor(r * 0.3, g * 0.3, b * 0.3, 0.5)
      love.graphics.line(x1 + 2, y1 + 2, x2 + 2, y2 + 2)

      -- Main body
      love.graphics.setLineWidth(thick)
      love.graphics.setColor(r, g, b, 0.9)
      love.graphics.line(x1, y1, x2, y2)

      -- Highlight
      love.graphics.setLineWidth(thick * 0.3)
      local hr, hg, hb = Util.hslToRgb(hue, 0.5, 0.65)
      love.graphics.setColor(hr, hg, hb, 0.7)
      love.graphics.line(x1 - 1, y1 - 1, x2 - 1, y2 - 1)
    end

    -- Joint spheres
    for _, joint in ipairs(pipe.joints) do
      local jx, jy, hue, thick = joint[1], joint[2], joint[3], joint[4]
      local r, g, b = Util.hslToRgb(hue, 0.6, 0.45)
      local radius = thick * 0.7

      love.graphics.setColor(r, g, b, 0.9)
      love.graphics.circle("fill", jx, jy, radius)
      -- Highlight on joint
      local hr, hg, hb = Util.hslToRgb(hue, 0.4, 0.7)
      love.graphics.setColor(hr, hg, hb, 0.6)
      love.graphics.circle("fill", jx - radius * 0.3, jy - radius * 0.3, radius * 0.4)
    end
  end
end

Effects.register("Pipes", Pipes)

return Pipes
