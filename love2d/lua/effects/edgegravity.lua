--[[
  effects/edgegravity.lua — Spring particles with edge attraction and audio-like forces

  Particles have home positions spread across the canvas. A spring force
  always pulls them home. Self-animating forces (wander, burst, swirl, jitter)
  fight the spring, creating dynamic light trails in the void.

  React usage:
    <EdgeGravity />
    <EdgeGravity speed={1.5} />
    <EdgeGravity reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt, max, min = math.random, math.floor, math.sqrt, math.max, math.min
local abs = math.abs

local EdgeGravity = {}

local MAX_PARTICLES = 400
local MAX_TRAILS = 3000

function EdgeGravity.create(w, h, props)
  local particles = {}
  local reactive = Util.boolProp(props, "reactive", false)

  for i = 1, MAX_PARTICLES do
    local homeX = w * 0.15 + random() * w * 0.7
    local homeY = h * 0.15 + random() * h * 0.7
    table.insert(particles, {
      x = homeX + (random() - 0.5) * 50,
      y = homeY + (random() - 0.5) * 50,
      homeX = homeX,
      homeY = homeY,
      vx = 0,
      vy = 0,
      hue = random(),
      thickness = 1 + random() * 4,
      trailDuration = 0.4 + random() * 0.5,
      speedMult = 0.8 + random() * 1.2,
      wanderAngle = random() * pi * 2,
      intensity = 0.5 + random() * 0.5,
      prevX = homeX,
      prevY = homeY,
    })
  end

  return {
    time = 0,
    particles = particles,
    trails = {},
    hue = random(),
    cleared = false,
    reactiveIntensity = 0,
    centerX = w / 2,
    centerY = h / 2,
  }
end

function EdgeGravity.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.05)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  local t = state.time

  state.centerX = w / 2
  state.centerY = h / 2

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Self-modulate audio-like signals
  local bass = (sin(t * 0.4) + 1) * 0.5
  local mid = (sin(t * 0.25 + 1.5) + 1) * 0.5
  local high = (sin(t * 0.6 + 3.0) + 1) * 0.5
  local amp = (sin(t * 0.7) + 1) * 0.35 + 0.15

  if reactive then
    decay = Util.lerp(0.15, decay, state.reactiveIntensity)
  end

  -- Beat detection
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.8) > 0.94
  end

  local cx, cy = state.centerX, state.centerY

  for _, p in ipairs(state.particles) do
    p.prevX = p.x
    p.prevY = p.y

    -- 1. Spring to home
    local toDx = p.homeX - p.x
    local toDy = p.homeY - p.y
    local homeDist = sqrt(toDx * toDx + toDy * toDy) + 0.001
    local springStrength = 0.02
    local springX = (toDx / homeDist) * min(homeDist * springStrength, 2)
    local springY = (toDy / homeDist) * min(homeDist * springStrength, 2)

    -- 2. Wander
    local audioEnergy = amp * 2 * reactMul
    local angleShift = bass * 0.5 - high * 0.3
    p.wanderAngle = p.wanderAngle + angleShift * 0.1 + (random() - 0.5) * 0.2
    local wanderStr = audioEnergy * 2.5 * p.speedMult
    local wanderX = cos(p.wanderAngle) * wanderStr
    local wanderY = sin(p.wanderAngle) * wanderStr

    -- 3. Burst from center (bass)
    local cdx = p.x - cx
    local cdy = p.y - cy
    local cDist = sqrt(cdx * cdx + cdy * cdy) + 0.001
    local burstStr = bass * 3 * reactMul
    local burstX = (cdx / cDist) * burstStr
    local burstY = (cdy / cDist) * burstStr

    -- 4. Swirl (mid)
    local swirlStr = mid * 2 * reactMul
    local swirlX = (-cdy / cDist) * swirlStr
    local swirlY = (cdx / cDist) * swirlStr

    -- 5. Jitter (high)
    local jitterStr = high * 3 * reactMul
    local jitterX = (random() - 0.5) * jitterStr
    local jitterY = (random() - 0.5) * jitterStr

    -- Reactive: mouse influence
    if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
      local mdx = mouse.x - p.x
      local mdy = mouse.y - p.y
      local mDist = sqrt(mdx * mdx + mdy * mdy) + 0.001
      if mDist < 150 then
        local attract = (150 - mDist) / 150 * state.reactiveIntensity * 2
        burstX = burstX + (mdx / mDist) * attract
        burstY = burstY + (mdy / mDist) * attract
      end
    end

    -- Combine forces
    p.vx = p.vx + springX + wanderX + burstX + swirlX + jitterX
    p.vy = p.vy + springY + wanderY + burstY + swirlY + jitterY

    -- Damping
    local damping = 0.92
    p.vx = p.vx * damping
    p.vy = p.vy * damping

    -- Speed limit
    local vel = sqrt(p.vx * p.vx + p.vy * p.vy)
    if vel > 20 then
      p.vx = p.vx / vel * 20
      p.vy = p.vy / vel * 20
    end

    -- Update position
    p.x = p.x + p.vx * dt * 60
    p.y = p.y + p.vy * dt * 60

    -- Bounce off edges
    if p.x < 5 then p.x = 5; p.vx = abs(p.vx) * 0.7 end
    if p.x > w - 5 then p.x = w - 5; p.vx = -abs(p.vx) * 0.7 end
    if p.y < 5 then p.y = 5; p.vy = abs(p.vy) * 0.7 end
    if p.y > h - 5 then p.y = h - 5; p.vy = -abs(p.vy) * 0.7 end

    -- Intensity from speed
    local spd = sqrt(p.vx * p.vx + p.vy * p.vy)
    p.intensity = min(1, 0.3 + spd * 0.15 + amp * 0.4)

    -- Hue drift
    p.hue = (p.hue + high * 0.002 * speed) % 1

    -- Create trail segment
    if spd > 0.5 then
      table.insert(state.trails, {
        x1 = p.prevX, y1 = p.prevY,
        x2 = p.x, y2 = p.y,
        hue = p.hue,
        thickness = p.thickness * (0.5 + spd * 0.2),
        intensity = p.intensity,
        life = p.trailDuration,
        decay = (1 - p.trailDuration) * 0.02 + 0.005,
      })
    end
  end

  -- Beat kick
  if isBeat and reactMul > 0.3 then
    local beatStr = 6 + bass * 12
    for _, p in ipairs(state.particles) do
      local kickAngle = p.wanderAngle + (random() - 0.5)
      p.vx = p.vx + cos(kickAngle) * beatStr * p.speedMult
      p.vy = p.vy + sin(kickAngle) * beatStr * p.speedMult
      p.wanderAngle = p.wanderAngle + (random() - 0.5) * 0.5
    end
  end

  -- Decay trails
  local aliveTrails = {}
  for _, tr in ipairs(state.trails) do
    tr.life = tr.life - tr.decay * dt * 60
    if tr.life > 0 then
      table.insert(aliveTrails, tr)
    end
  end
  state.trails = aliveTrails

  -- Limit trails
  if #state.trails > MAX_TRAILS then
    local trimmed = {}
    for i = #state.trails - MAX_TRAILS + 1, #state.trails do
      table.insert(trimmed, state.trails[i])
    end
    state.trails = trimmed
  end

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function EdgeGravity.draw(state, w, h)
  -- Semi-transparent background for trail persistence
  love.graphics.setColor(0.04, 0.04, 0.04, 0.08)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Draw trails
  for _, tr in ipairs(state.trails) do
    local alpha = tr.life * tr.intensity
    local r, g, b = Util.hslToRgb(tr.hue, 0.8, 0.6)

    -- Main trail
    love.graphics.setColor(r, g, b, alpha)
    love.graphics.setLineWidth(tr.thickness)
    love.graphics.line(tr.x1, tr.y1, tr.x2, tr.y2)

    -- Glow
    love.graphics.setColor(r, g, b, alpha * 0.2)
    love.graphics.setLineWidth(tr.thickness * 3)
    love.graphics.line(tr.x1, tr.y1, tr.x2, tr.y2)
  end

  -- Draw particles
  for _, p in ipairs(state.particles) do
    local r, g, b = Util.hslToRgb(p.hue, 0.7, 0.7)
    local size = p.thickness * (1 + p.intensity * 0.5)

    -- Glow
    love.graphics.setColor(r, g, b, p.intensity * 0.25)
    love.graphics.circle("fill", p.x, p.y, size * 3)

    -- Core
    love.graphics.setColor(1, 1, 1, p.intensity * 0.7)
    love.graphics.circle("fill", p.x, p.y, size)
  end
end

Effects.register("EdgeGravity", EdgeGravity)

return EdgeGravity
