-- boids.tsl — Boids flocking simulation (separation, alignment, cohesion)
--
-- This file is transpiled to lua/tsl/boids.lua by `reactjit build`.
-- It runs inside the Boids capability tick, called once per frame from Lua.
-- No React, no bridge — pure math at LuaJIT speed.
--
-- The React side owns: count, speed, radius sliders, pause/resume.
-- This file owns: what every boid does with that information each frame.
local PERCEPTION = 80
local SEP_RADIUS = 25
local MAX_SPEED = 180
local MAX_FORCE = 320
local WRAP_MARGIN = 20
-- ── Vector helpers ────────────────────────────────────────────
local function vecLen(x, y)
  return math.sqrt(x * x + y * y)
end
local function vecNorm(x, y)
  local len = vecLen(x, y)
  if len < 0.0001 then
    return {0, 0}
  end
  return {x / len, y / len}
end
local function vecLimit(x, y, max)
  local len = vecLen(x, y)
  if len > max then
    return {x / len * max, y / len * max}
  end
  return {x, y}
end
-- ── Flocking rules ────────────────────────────────────────────
-- Steer away from neighbours that are too close
local function separation(boids, i, sepRadius)
  local sx = 0
  local sy = 0
  local count = 0
  local b = boids[i]
  for j = 1 + 1, #boids + 1 do
    if j ~= i then
      local other = boids[j]
      local dx = b.x - other.x
      local dy = b.y - other.y
      local d = vecLen(dx, dy)
      if d > 0 and d < sepRadius then
        -- Weight by inverse distance — closer = stronger push
        sx = sx + dx / d
        sy = sy + dy / d
        count = count + 1
      end
    end
  end
  if count == 0 then
    return {0, 0}
  end
  return vecNorm(sx / count, sy / count)
end
-- Steer toward the average heading of neighbours
local function alignment(boids, i, perception)
  local ax = 0
  local ay = 0
  local count = 0
  local b = boids[i]
  for j = 1 + 1, #boids + 1 do
    if j ~= i then
      local other = boids[j]
      local dx = other.x - b.x
      local dy = other.y - b.y
      if vecLen(dx, dy) < perception then
        ax = ax + other.vx
        ay = ay + other.vy
        count = count + 1
      end
    end
  end
  if count == 0 then
    return {0, 0}
  end
  return vecNorm(ax / count, ay / count)
end
-- Steer toward the average position of neighbours
local function cohesion(boids, i, perception)
  local cx = 0
  local cy = 0
  local count = 0
  local b = boids[i]
  for j = 1 + 1, #boids + 1 do
    if j ~= i then
      local other = boids[j]
      local dx = other.x - b.x
      local dy = other.y - b.y
      if vecLen(dx, dy) < perception then
        cx = cx + other.x
        cy = cy + other.y
        count = count + 1
      end
    end
  end
  if count == 0 then
    return {0, 0}
  end
  -- Desired = direction toward average position
  local tx = cx / count - b.x
  local ty = cy / count - b.y
  return vecNorm(tx, ty)
end
-- ── Public API ────────────────────────────────────────────────
-- Spawn N boids randomly across the canvas
local function init(count, w, h)
  local boids = {}
  for i = 1, count do
    local angle = math.random() * math.pi * 2
    table.insert(boids, {
      x = math.random() * w,
      y = math.random() * h,
      vx = math.cos(angle) * 60,
      vy = math.sin(angle) * 60,
    })
  end
  return boids
end
-- Advance the simulation by dt seconds.
-- Mutates boids in place — no allocation per frame.
local function update(boids, dt, w, h, speedScale, sepWeight, aliWeight, cohWeight)
  local maxSpd = MAX_SPEED * speedScale
  local maxFrc = MAX_FORCE * speedScale
  for i = 1 + 1, #boids + 1 do
    local b = boids[i]
    -- Compute steering forces from the three rules
    local _tsl_tmp = separation(boids, i, SEP_RADIUS)
    local sx = _tsl_tmp[1]
    local sy = _tsl_tmp[2]
    local _tsl_tmp = alignment(boids, i, PERCEPTION)
    local ax = _tsl_tmp[1]
    local ay = _tsl_tmp[2]
    local _tsl_tmp = cohesion(boids, i, PERCEPTION)
    local cx = _tsl_tmp[1]
    local cy = _tsl_tmp[2]
    -- Weighted sum → acceleration
    local fx = sx * sepWeight + ax * aliWeight + cx * cohWeight
    local fy = sy * sepWeight + ay * aliWeight + cy * cohWeight
    -- Cap the total force
    local _tsl_tmp = vecLimit(fx, fy, maxFrc)
    local lfx = _tsl_tmp[1]
    local lfy = _tsl_tmp[2]
    fx = lfx
    fy = lfy
    -- Integrate velocity
    b.vx = b.vx + fx * dt
    b.vy = b.vy + fy * dt
    -- Cap speed
    local _tsl_tmp = vecLimit(b.vx, b.vy, maxSpd)
    local lvx = _tsl_tmp[1]
    local lvy = _tsl_tmp[2]
    b.vx = lvx
    b.vy = lvy
    -- Integrate position
    b.x = b.x + b.vx * dt
    b.y = b.y + b.vy * dt
    -- Wrap at screen edges
    if b.x < -WRAP_MARGIN then
      b.x = w + WRAP_MARGIN
    end
    if b.x > w + WRAP_MARGIN then
      b.x = -WRAP_MARGIN
    end
    if b.y < -WRAP_MARGIN then
      b.y = h + WRAP_MARGIN
    end
    if b.y > h + WRAP_MARGIN then
      b.y = -WRAP_MARGIN
    end
  end
end

return {
  init = init,
  update = update,
}
