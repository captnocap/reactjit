--[[
  effects/feedback.lua — Ping-pong canvas feedback with zoom/rotation

  Each frame blits the previous canvas back onto itself with a zoom/rotation
  UV transform, creating infinite-zoom spiral echo patterns. Particles or
  ring spawns provide the "seed" content that echoes.

  React usage:
    <Feedback />
    <Feedback speed={1.5} decay={0.95} />
    <Feedback reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor, sqrt = math.random, math.floor, math.sqrt

local Feedback = {}

function Feedback.create(w, h, props)
  -- Second canvas for ping-pong
  local prevCanvas = love.graphics.newCanvas(w, h)

  -- Seed particles
  local particles = {}
  local reactive = Util.boolProp(props, "reactive", false)
  if not reactive then
    for i = 1, 20 do
      table.insert(particles, {
        x = random() * w,
        y = random() * h,
        vx = (random() - 0.5) * 3,
        vy = (random() - 0.5) * 3,
        hue = random(),
        size = 2 + random() * 3,
        age = 0,
      })
    end
  end

  return {
    time = 0,
    prevCanvas = prevCanvas,
    particles = particles,
    hue = random(),
    zoom = 1.02,
    rotation = 0.005,
    feedbackAmount = 0.92,
    cleared = false,
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

function Feedback.destroy(state)
  if state and state.prevCanvas then
    state.prevCanvas:release()
  end
end

function Feedback.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.92)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  local t = state.time
  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)

  -- Feedback parameters
  state.feedbackAmount = decay
  state.zoom = 1.01 + amp * 0.02
  state.rotation = (sin(t * 0.3) * 0.01 + amp * 0.005) * speed

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = math.min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = math.max(state.reactiveIntensity - dt * 1.5, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Reactive: mouse drives zoom and rotation
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.1 then
    state.zoom = 1.01 + mouse.speed * 0.00005 * state.reactiveIntensity
    state.rotation = (mouse.dx or 0) * 0.0003 * state.reactiveIntensity
  end

  -- Update seed particles
  local alive = {}
  for _, p in ipairs(state.particles) do
    p.x = p.x + p.vx * speed * dt * 60
    p.y = p.y + p.vy * speed * dt * 60
    p.age = p.age + dt
    p.hue = (p.hue + dt * 0.02 * speed) % 1

    -- Bounce
    if p.x < 0 or p.x > w then p.vx = -p.vx end
    if p.y < 0 or p.y > h then p.vy = -p.vy end

    if p.age < 15 then
      table.insert(alive, p)
    end
  end
  state.particles = alive

  -- Spawn seed particles
  local spawnRate = (0.5 + amp * 2) * speed * reactMul
  if reactive and mouse and mouse.inside then
    spawnRate = spawnRate + mouse.speed * 0.005 * state.reactiveIntensity
  end

  state.spawnAccum = state.spawnAccum + dt * spawnRate
  while state.spawnAccum >= 1 and #state.particles < 60 do
    state.spawnAccum = state.spawnAccum - 1
    local sx, sy
    if reactive and mouse and mouse.inside then
      sx = mouse.x + (random() - 0.5) * 30
      sy = mouse.y + (random() - 0.5) * 30
    else
      sx = w * 0.3 + random() * w * 0.4
      sy = h * 0.3 + random() * h * 0.4
    end
    table.insert(state.particles, {
      x = sx, y = sy,
      vx = (random() - 0.5) * 4,
      vy = (random() - 0.5) * 4,
      hue = (state.hue + random() * 0.15) % 1,
      size = 2 + random() * 3,
      age = 0,
    })
  end

  -- Beat: rings
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.8) > 0.96
  end
  if isBeat and reactMul > 0.3 then
    local count = 3 + floor(random() * 4)
    for i = 1, count do
      if #state.particles >= 60 then break end
      local angle = random() * pi * 2
      local dist = 20 + random() * 40
      local cx, cy = w / 2, h / 2
      if reactive and mouse and mouse.inside then
        cx, cy = mouse.x, mouse.y
      end
      table.insert(state.particles, {
        x = cx + cos(angle) * dist,
        y = cy + sin(angle) * dist,
        vx = cos(angle) * 3,
        vy = sin(angle) * 3,
        hue = (state.hue + random() * 0.1) % 1,
        size = 3 + random() * 4,
        age = 0,
      })
    end
  end

  state.hue = (state.hue + dt * 0.01 * speed) % 1
end

function Feedback.draw(state, w, h)
  -- Step 1: Draw the feedback of the previous frame (zoomed + rotated)
  local zoom = state.zoom
  local rot = state.rotation
  local amount = state.feedbackAmount

  love.graphics.setColor(1, 1, 1, amount)
  love.graphics.push()
  love.graphics.translate(w / 2, h / 2)
  love.graphics.rotate(rot)
  love.graphics.scale(zoom, zoom)
  love.graphics.translate(-w / 2, -h / 2)
  love.graphics.draw(state.prevCanvas, 0, 0)
  love.graphics.pop()

  -- Step 2: Draw seed content on top
  for _, p in ipairs(state.particles) do
    local r, g, b = Util.hslToRgb(p.hue, 0.8, 0.6)
    local alpha = math.max(0, 1 - p.age * 0.15)
    -- Glow
    love.graphics.setColor(r, g, b, alpha * 0.3)
    love.graphics.circle("fill", p.x, p.y, p.size * 3)
    -- Core
    love.graphics.setColor(r, g, b, alpha * 0.9)
    love.graphics.circle("fill", p.x, p.y, p.size)
  end

  -- Step 3: Copy the current canvas to prevCanvas for next frame's feedback
  -- We'll do this by drawing the current canvas state onto prevCanvas
  local currentCanvas = love.graphics.getCanvas()
  if currentCanvas then
    love.graphics.push("all")
    love.graphics.setCanvas(state.prevCanvas)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(currentCanvas, 0, 0)
    love.graphics.pop()
  end
end

Effects.register("Feedback", Feedback)

return Feedback
