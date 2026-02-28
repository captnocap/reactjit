--[[
  effects/reactiondiffusion.lua — Gray-Scott reaction-diffusion

  Two chemicals (A and B) diffuse and react on a grid. A feeds in, B kills out.
  Different feed/kill rates produce radically different patterns:
  mitosis, coral, worms, mazes. Parameters drift over time.

  React usage:
    <ReactionDiffusion />
    <ReactionDiffusion speed={1.5} />
    <ReactionDiffusion reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, cos, pi = math.sin, math.cos, math.pi
local random, floor, max, min = math.random, math.floor, math.max, math.min

local ReactionDiffusion = {}

local SCALE = 6 -- Each cell = 6x6 pixels

function ReactionDiffusion.create(w, h, props)
  local gw = floor(w / SCALE)
  local gh = floor(h / SCALE)
  local size = gw * gh

  -- Initialize chemical grids
  local gridA = {}
  local gridB = {}
  local nextA = {}
  local nextB = {}

  for i = 1, size do
    gridA[i] = 1
    gridB[i] = 0
    nextA[i] = 1
    nextB[i] = 0
  end

  -- Seed initial patterns
  local state = {
    time = 0,
    gridA = gridA,
    gridB = gridB,
    nextA = nextA,
    nextB = nextB,
    gw = gw,
    gh = gh,
    dA = 1.0,
    dB = 0.5,
    feed = 0.055,
    kill = 0.062,
    targetFeed = 0.055,
    targetKill = 0.062,
    stepsPerFrame = 6,
    hue = random(),
    reactiveIntensity = 0,
    spawnAccum = 0,
  }

  -- Central seed
  local cx, cy = floor(gw / 2), floor(gh / 2)
  for dy = -12, 12 do
    for dx = -12, 12 do
      if dx * dx + dy * dy < 144 then
        local x = cx + dx
        local y = cy + dy
        if x >= 1 and x <= gw and y >= 1 and y <= gh then
          gridB[(y - 1) * gw + x] = 1
        end
      end
    end
  end

  -- Ring of seeds
  local ringR = min(gw, gh) * 0.25
  for i = 0, 7 do
    local angle = i / 8 * pi * 2
    local sx = floor(gw / 2 + cos(angle) * ringR)
    local sy = floor(gh / 2 + sin(angle) * ringR)
    for j = 1, 80 do
      local rx = sx + floor(random() * 10) - 5
      local ry = sy + floor(random() * 10) - 5
      if rx >= 1 and rx <= gw and ry >= 1 and ry <= gh then
        gridB[(ry - 1) * gw + rx] = random()
      end
    end
  end

  -- Scattered seeds
  for i = 1, 12 do
    local sx = floor(random() * gw) + 1
    local sy = floor(random() * gh) + 1
    for j = 1, 40 do
      local rx = sx + floor(random() * 6) - 3
      local ry = sy + floor(random() * 6) - 3
      if rx >= 1 and rx <= gw and ry >= 1 and ry <= gh then
        gridB[(ry - 1) * gw + rx] = random()
      end
    end
  end

  return state
end

local function seedCircle(state, cx, cy, radius)
  local gw, gh = state.gw, state.gh
  local r2 = radius * radius
  for dy = -radius, radius do
    for dx = -radius, radius do
      if dx * dx + dy * dy < r2 then
        local x = cx + dx
        local y = cy + dy
        if x >= 1 and x <= gw and y >= 1 and y <= gh then
          state.gridB[(y - 1) * gw + x] = 1
        end
      end
    end
  end
end

local function laplacian(grid, x, y, gw, gh)
  local xm = ((x - 2) % gw) + 1
  local xp = (x % gw) + 1
  local ym = ((y - 2) % gh) + 1
  local yp = (y % gh) + 1
  local idx = (y - 1) * gw + x

  return grid[(ym - 1) * gw + xm] * 0.05
       + grid[(ym - 1) * gw + x] * 0.2
       + grid[(ym - 1) * gw + xp] * 0.05
       + grid[(y - 1) * gw + xm] * 0.2
       + grid[idx] * -1
       + grid[(y - 1) * gw + xp] * 0.2
       + grid[(yp - 1) * gw + xm] * 0.05
       + grid[(yp - 1) * gw + x] * 0.2
       + grid[(yp - 1) * gw + xp] * 0.05
end

local function step(state)
  local gw, gh = state.gw, state.gh
  local gridA, gridB = state.gridA, state.gridB
  local nextA, nextB = state.nextA, state.nextB
  local dA, dB = state.dA, state.dB
  local feed, kill = state.feed, state.kill

  for y = 1, gh do
    for x = 1, gw do
      local idx = (y - 1) * gw + x
      local a = gridA[idx]
      local b = gridB[idx]

      local lapA = laplacian(gridA, x, y, gw, gh)
      local lapB = laplacian(gridB, x, y, gw, gh)

      local reaction = a * b * b

      nextA[idx] = max(0, min(1, a + dA * lapA - reaction + feed * (1 - a)))
      nextB[idx] = max(0, min(1, b + dB * lapB + reaction - (kill + feed) * b))
    end
  end

  -- Swap buffers
  state.gridA, state.nextA = state.nextA, state.gridA
  state.gridB, state.nextB = state.nextB, state.gridB
end

function ReactionDiffusion.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

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

  -- Self-modulate feed/kill for pattern variety
  local bass = (sin(t * 0.15) + 1) * 0.5
  local mid = (sin(t * 0.1 + 1.5) + 1) * 0.5

  state.targetFeed = 0.03 + bass * 0.03
  state.targetKill = 0.058 + mid * 0.012

  -- Smooth transition
  state.feed = state.feed + (state.targetFeed - state.feed) * 0.05
  state.kill = state.kill + (state.targetKill - state.kill) * 0.05

  -- Beat seeding
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.4) > 0.90
  end

  if isBeat and reactMul > 0.2 then
    local count = 1 + floor(bass * 2)
    for i = 1, count do
      local sx, sy
      if reactive and mouse and mouse.inside then
        sx = floor(mouse.x / SCALE) + 1
        sy = floor(mouse.y / SCALE) + 1
      else
        sx = floor(random() * state.gw) + 1
        sy = floor(random() * state.gh) + 1
      end
      seedCircle(state, sx, sy, 4 + floor(bass * 8))
    end
  end

  -- Reactive: seed at mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
    state.spawnAccum = state.spawnAccum + dt * mouse.speed * 0.005 * state.reactiveIntensity
    while state.spawnAccum >= 1 do
      state.spawnAccum = state.spawnAccum - 1
      local sx = floor(mouse.x / SCALE) + 1
      local sy = floor(mouse.y / SCALE) + 1
      seedCircle(state, sx, sy, 3 + floor(state.reactiveIntensity * 4))
    end
  end

  -- Run simulation steps
  state.stepsPerFrame = max(2, floor(4 + speed * 4))
  for i = 1, state.stepsPerFrame do
    step(state)
  end

  state.hue = (state.hue + dt * 0.005 * speed) % 1
end

function ReactionDiffusion.draw(state, w, h)
  local gw, gh = state.gw, state.gh
  local gridB = state.gridB
  local hue = state.hue
  local cs = SCALE

  -- Draw cells
  for y = 1, gh do
    for x = 1, gw do
      local idx = (y - 1) * gw + x
      local b = gridB[idx]

      if b > 0.01 then
        -- Intensity from B concentration with gamma
        local intensity = b ^ 0.5
        local cellHue = (hue + b * 0.15) % 1
        local r, g, bl = Util.hslToRgb(cellHue, 0.6 + b * 0.2, 0.15 + intensity * 0.45)

        love.graphics.setColor(r, g, bl, 1)
        love.graphics.rectangle("fill", (x - 1) * cs, (y - 1) * cs, cs, cs)
      else
        love.graphics.setColor(0.03, 0.03, 0.05, 1)
        love.graphics.rectangle("fill", (x - 1) * cs, (y - 1) * cs, cs, cs)
      end
    end
  end
end

Effects.register("ReactionDiffusion", ReactionDiffusion)

return ReactionDiffusion
