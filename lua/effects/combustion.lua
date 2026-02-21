--[[
  effects/combustion.lua — Cinematic fire simulation

  Layered particle fire with fuel, flame, smoke, and ember phases.
  Tuned for smoother motion and richer color in Lua while keeping frame time stable.
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, pi = math.sin, math.pi
local random, floor, max, min = math.random, math.floor, math.max, math.min

local Combustion = {}

local MAX_PARTICLES_CAP = 2200
local MIN_PARTICLES = 80

local function particleBudget(w, h)
  return min(MAX_PARTICLES_CAP, max(MIN_PARTICLES, floor((w * h) / 380)))
end

-- Black-body radiation palette from temperature (0-1)
local function tempToColor(temp, life, isSmoke)
  if isSmoke then
    local gray = 0.1 + life * 0.12
    return gray, gray, gray, life * 0.34
  end

  local r, g, b
  local t = temp
  if t > 0.9 then
    r, g, b = 1, 1, 0.8 + (t - 0.9) * 2.0
  elseif t > 0.7 then
    r, g, b = 1, 0.78 + (t - 0.7) * 1.1, 0.18
  elseif t > 0.5 then
    r, g, b = 1, 0.38 + (t - 0.5) * 2.0, 0.02
  elseif t > 0.3 then
    r, g, b = 0.78 + (t - 0.3) * 1.12, (t - 0.3) * 1.8, 0
  else
    r, g, b = t * 2.45, 0, 0
  end

  return min(1, r), min(1, g), min(1, b), life * 0.82
end

local function buildSources(w, h, count)
  local sources = {}
  local baseline = h - max(12, h * 0.08)
  for i = 1, count do
    local nx = (i - 0.5) / count
    local baseX = w * nx
    sources[i] = {
      baseX = baseX,
      x = baseX,
      y = baseline,
      width = 14 + w * 0.03 + random() * 14,
      intensity = 0.45 + random() * 0.4,
      phase = random() * pi * 2,
      drift = 0.45 + random() * 1.2,
      spawnAccum = random(),
    }
  end
  return sources
end

local function ensureLayout(state, w, h)
  if state.w == w and state.h == h then return end

  state.w = w
  state.h = h
  state.baseline = h - max(12, h * 0.08)
  state.maxParticles = particleBudget(w, h)
  state.spawnScale = 8 + state.maxParticles * 0.01
  state.frameSpawnLimit = max(12, floor(state.maxParticles * 0.07))
  local sourceCount = Util.clamp(floor(w / 150), 3, 9)
  state.sources = buildSources(w, h, sourceCount)
  state.cleared = false
end

local function acquireParticle(state)
  local n = #state.pool
  if n == 0 then return {} end
  local p = state.pool[n]
  state.pool[n] = nil
  return p
end

local function recycleParticle(state, p)
  state.pool[#state.pool + 1] = p
end

local function configureParticle(p, kind, x, y, vx, vy, temp, size)
  p.kind = kind
  p.x = x
  p.y = y
  p.vx = vx
  p.vy = vy
  p.temperature = temp
  p.size = size
  p.age = 0
  p.life = 1
  p.seed = random() * 1000
  p.igniteAt = 8 + random() * 10

  if kind == "fuel" then
    p.maxLife = 26 + random() * 30
  elseif kind == "flame" then
    p.maxLife = 18 + random() * 24
  elseif kind == "smoke" then
    p.maxLife = 56 + random() * 88
  elseif kind == "ember" then
    p.maxLife = 30 + random() * 42
  end
end

local function spawnParticle(state, kind, x, y, vx, vy, temp, size)
  if #state.particles >= state.maxParticles then return nil end
  local p = acquireParticle(state)
  configureParticle(p, kind, x, y, vx, vy, temp, size)
  state.particles[#state.particles + 1] = p
  return p
end

local function igniteFuel(p, boost)
  p.kind = "flame"
  p.age = 0
  p.life = 1
  p.maxLife = 20 + random() * 22 + boost * 10
  p.temperature = max(p.temperature, 0.72 + boost * 0.16 + random() * 0.08)
  p.size = p.size * 0.55 + 1.4 + random() * 2.1
  p.vy = p.vy - (1.0 + boost * 1.1 + random() * 0.8)
  p.vx = p.vx * 0.32
end

function Combustion.create(w, h, props)
  local state = {
    time = 0,
    particles = {},
    pool = {},
    sources = {},
    maxParticles = particleBudget(w, h),
    spawnScale = 8 + particleBudget(w, h) * 0.01,
    frameSpawnLimit = max(12, floor(particleBudget(w, h) * 0.07)),
    baseline = h - max(12, h * 0.08),
    w = w,
    h = h,
    decay = Util.clamp(Util.prop(props, "decay", 0.16), 0.04, 0.35),
    reactiveIntensity = 0,
    mouseSpawnAccum = 0,
    beatGate = 0,
    turbulence = 0.6,
    oxygenLevel = 0.9,
    wind = 0,
    updraft = 0.8,
    panX = 0,
    panY = 0,
    cleared = false,
  }
  ensureLayout(state, w, h)
  return state
end

function Combustion.update(state, dt, props, w, h, mouse)
  ensureLayout(state, w, h)

  local speed = Util.clamp(Util.prop(props, "speed", 1.0), 0.1, 3.5)
  local decay = Util.clamp(Util.prop(props, "decay", 0.16), 0.04, 0.35)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)
  local infinite = Util.boolProp(props, "infinite", false)

  state.time = state.time + dt * speed
  local t = state.time
  local frame = dt * 60 * speed

  local bass = Util.prop(props, "bass", (sin(t * 0.42) + 1) * 0.5)
  local mid = Util.prop(props, "mid", (sin(t * 0.29 + 1.6) + 1) * 0.5)
  local high = Util.prop(props, "high", (sin(t * 0.67 + 2.9) + 1) * 0.5)
  local amp = Util.prop(props, "amplitude", 0.22 + (sin(t * 0.58) + 1) * 0.26)

  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.1, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.6, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  if reactive then
    state.decay = Util.lerp(0.24, decay, state.reactiveIntensity)
  else
    state.decay = decay
  end

  state.turbulence = 0.3 + high * 1.25
  state.oxygenLevel = Util.clamp(0.52 + mid * 0.28 + high * 0.22, 0.35, 1.15)
  state.updraft = 0.5 + bass * 0.8 + amp * 0.58
  state.wind = (
    sin(t * (0.35 + mid * 0.2)) +
    sin(t * 0.11 + 1.2) * 0.6
  ) * (0.35 + high * 0.9)

  local energy = Util.clamp(0.32 + bass * 0.45 + amp * 0.64, 0.12, 1.5) * reactMul
  if not reactive then
    energy = Util.clamp(energy, 0.2, 1.5)
  end

  -- Infinite canvas: drift source field sideways.
  if infinite then
    local propPanX = Util.prop(props, "panX", nil)
    local propPanY = Util.prop(props, "panY", nil)
    if propPanX then
      state.panX = propPanX
      state.panY = propPanY or 0
    else
      state.panX = state.panX + dt * (24 + mid * 22) * speed
      state.panY = sin(t * 0.25) * 8
    end
  else
    state.panX = Util.prop(props, "panX", 0)
    state.panY = Util.prop(props, "panY", 0)
  end

  local spawnedThisFrame = 0
  local sourceLoopW = w + 80
  for _, source in ipairs(state.sources) do
    local phaseT = t * (1.35 + source.drift * 0.7) + source.phase
    local flicker = Util.clamp(
      (sin(phaseT * 4.7) + sin(phaseT * 8.1 + 1.2) * 0.5 + 1.2) * 0.45,
      0,
      1
    )

    source.intensity = Util.clamp(0.3 + bass * 0.45 + amp * 0.4 + flicker * 0.45, 0.1, 1.35)
    local driftX = sin(phaseT * 0.9) * source.width * 0.16 + state.wind * source.width * 0.08
    local wrappedX = (source.baseX + driftX + state.panX) % sourceLoopW
    source.x = wrappedX - 40

    local reactiveLift = 0
    if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
      reactiveLift = (mouse.y - state.baseline) * 0.18 * state.reactiveIntensity
    end
    source.y = state.baseline + sin(phaseT * 2.6) * 2 + reactiveLift + state.panY * 0.18

    local spawnRate = (0.7 + source.intensity * 1.25 + energy * 1.1) * state.spawnScale * speed
    source.spawnAccum = source.spawnAccum + dt * spawnRate

    while source.spawnAccum >= 1 and spawnedThisFrame < state.frameSpawnLimit do
      source.spawnAccum = source.spawnAccum - 1
      spawnedThisFrame = spawnedThisFrame + 1

      local sx = source.x + (random() - 0.5) * source.width
      local sy = source.y + random() * 4
      local vx = (random() - 0.5) * (0.8 + high * 1.6) + state.wind * 0.2
      local vy = -0.4 - random() * 0.9 - source.intensity * 0.42
      local fuel = spawnParticle(
        state,
        "fuel",
        sx,
        sy,
        vx,
        vy,
        0.28 + source.intensity * 0.15,
        1.8 + random() * 2.6
      )

      if fuel and random() < (0.12 + energy * 0.24) then
        igniteFuel(fuel, energy * source.intensity)
      end

      if random() < (0.03 + energy * 0.06) then
        spawnParticle(
          state,
          "ember",
          sx,
          sy - 2,
          (random() - 0.5) * 2.8 + state.wind * 0.25,
          -1.1 - random() * 1.8,
          0.78 + random() * 0.16,
          0.9 + random() * 1.5
        )
      end
    end
  end

  -- Reactive torch at mouse.
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.15 then
    state.mouseSpawnAccum = state.mouseSpawnAccum + dt * (12 + mouse.speed * 0.25) * state.reactiveIntensity
    while state.mouseSpawnAccum >= 1 and spawnedThisFrame < state.frameSpawnLimit do
      state.mouseSpawnAccum = state.mouseSpawnAccum - 1
      spawnedThisFrame = spawnedThisFrame + 1

      local spread = 12 + (1 - state.reactiveIntensity) * 24
      local mx = mouse.x + (random() - 0.5) * spread
      local my = mouse.y + (random() - 0.5) * spread
      local flame = spawnParticle(
        state,
        "flame",
        mx,
        my,
        (mouse.dx or 0) * 0.08 + (random() - 0.5) * 2.2,
        -1.8 - random() * 2.2 - mouse.speed * 0.004,
        0.82 + random() * 0.16,
        1.8 + random() * 2.2
      )
      if flame then
        flame.maxLife = flame.maxLife * (0.8 + state.reactiveIntensity * 0.3)
      end
    end
  end

  -- Beat burst (with gate so held-true beat doesn't spam every frame).
  state.beatGate = max(0, state.beatGate - dt)
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.72) > 0.95
  end
  if isBeat and state.beatGate <= 0 and reactMul > 0.15 then
    state.beatGate = 0.14
    for _, source in ipairs(state.sources) do
      local burst = 2 + floor(amp * 5)
      for _ = 1, burst do
        if spawnedThisFrame >= state.frameSpawnLimit then break end
        spawnedThisFrame = spawnedThisFrame + 1
        spawnParticle(
          state,
          "flame",
          source.x + (random() - 0.5) * source.width * 0.8,
          source.y - 6 - random() * 8,
          (random() - 0.5) * 3.5 + state.wind * 0.4,
          -2.2 - random() * 2.8,
          0.82 + random() * 0.14,
          1.8 + random() * 2.2
        )
      end
      if amp > 0.45 and spawnedThisFrame < state.frameSpawnLimit then
        spawnedThisFrame = spawnedThisFrame + 1
        spawnParticle(
          state,
          "ember",
          source.x,
          source.y - 10,
          (random() - 0.5) * 4.0 + state.wind * 0.5,
          -2.6 - random() * 2.4,
          0.9,
          1.1 + random() * 1.6
        )
      end
    end
  end

  -- Update particles in place to reduce allocations.
  local particles = state.particles
  local count = #particles
  local write = 1
  for i = 1, count do
    local p = particles[i]
    p.age = p.age + frame
    p.life = max(0, 1 - (p.age / p.maxLife))

    if p.kind == "fuel" then
      p.temperature = min(1, p.temperature + (0.004 + energy * 0.003) * frame)
      local swirl = sin(t * 3.2 + p.seed + p.y * 0.03) * state.turbulence
      p.vx = p.vx + (state.wind * 0.12 + swirl * 0.06) * frame
      p.vy = p.vy - (0.035 + p.temperature * 0.06 + state.updraft * 0.03) * frame

      if p.age > p.igniteAt and random() < (0.02 + energy * 0.05) * (frame / 1.2) then
        igniteFuel(p, energy)
      end
    elseif p.kind == "flame" then
      local buoyancy = 0.13 + p.temperature * 0.26 + state.updraft * 0.07
      local swirl = sin(p.y * 0.04 + t * 4.3 + p.seed * 2.1) * (0.18 + state.turbulence * 0.55)
      p.vx = p.vx + (state.wind * 0.22 + swirl) * frame
      p.vy = p.vy - buoyancy * frame
      p.temperature = max(0.05, p.temperature - (0.006 + (1 - state.oxygenLevel) * 0.003) * frame)
      p.size = max(0.22, p.size * (1 - 0.012 * frame) + 0.015 * frame)

      if p.life < 0.52 and random() < 0.05 * frame then
        spawnParticle(
          state,
          "smoke",
          p.x + (random() - 0.5) * 2.5,
          p.y + (random() - 0.5) * 2.5,
          p.vx * 0.35 + (random() - 0.5) * 0.5,
          p.vy * 0.2 - 0.2,
          0.22,
          3.5 + random() * 3.0
        )
      end

      if p.life < 0.2 and random() < 0.04 * frame then
        spawnParticle(
          state,
          "ember",
          p.x,
          p.y,
          p.vx * 0.35 + (random() - 0.5) * 1.3,
          p.vy * 0.35 - 0.5,
          min(1, p.temperature + 0.2),
          0.7 + random() * 1.2
        )
      end
    elseif p.kind == "smoke" then
      local drift = sin(t * 1.5 + p.seed * 7) * 0.28
      p.vx = p.vx + (state.wind * 0.08 + drift * 0.08) * frame
      p.vy = p.vy - (0.024 + state.updraft * 0.02) * frame
      p.size = p.size + (0.08 + (1 - p.life) * 0.12) * frame
      p.temperature = max(0, p.temperature - 0.005 * frame)
    elseif p.kind == "ember" then
      p.vx = p.vx + state.wind * 0.04 * frame
      p.vy = p.vy + (0.04 - p.temperature * 0.03) * frame
      p.temperature = max(0, p.temperature - 0.011 * frame)
      p.size = max(0.24, p.size * (1 - 0.02 * frame))
    end

    p.x = p.x + p.vx * frame
    p.y = p.y + p.vy * frame

    if p.kind == "smoke" then
      p.vx = p.vx * 0.985
      p.vy = p.vy * 0.988
    elseif p.kind == "ember" then
      p.vx = p.vx * 0.97
      p.vy = p.vy * 0.97
    else
      p.vx = p.vx * 0.96
      p.vy = p.vy * 0.965
    end

    local alive =
      p.life > 0 and
      p.y > -h * 0.35 and
      p.y < h + 90 and
      p.x > -70 and
      p.x < w + 70

    if alive then
      particles[write] = p
      write = write + 1
    else
      recycleParticle(state, p)
    end
  end
  for i = write, count do
    particles[i] = nil
  end

  -- Hard cap after resize/burst.
  local finalCount = #particles
  if finalCount > state.maxParticles then
    for i = state.maxParticles + 1, finalCount do
      recycleParticle(state, particles[i])
      particles[i] = nil
    end
  end
end

function Combustion.draw(state, w, h)
  local g = love.graphics

  if not state.cleared then
    g.setColor(0.015, 0.012, 0.02, 1)
    g.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  end

  g.setColor(0.03, 0.02, 0.04, state.decay or 0.16)
  g.rectangle("fill", 0, 0, w, h)

  -- Source bed glow.
  g.setBlendMode("add")
  for _, source in ipairs(state.sources) do
    local r = source.width * (1.2 + source.intensity * 1.1)
    g.setColor(1, 0.22, 0.03, 0.04 + source.intensity * 0.05)
    g.circle("fill", source.x, source.y + 8, r)
    g.setColor(1, 0.45, 0.08, 0.05 + source.intensity * 0.08)
    g.circle("fill", source.x, source.y + 5, r * 0.55)
  end
  g.setBlendMode("alpha")

  -- Smoke back layer.
  for _, p in ipairs(state.particles) do
    if p.kind == "smoke" then
      local r, gC, b, a = tempToColor(p.temperature, p.life, true)
      local soft = p.size * (1.2 + (1 - p.life) * 0.8)
      g.setColor(r, gC, b, a * 0.35)
      g.circle("fill", p.x, p.y, soft * 1.2)
      g.setColor(r * 0.85, gC * 0.85, b * 0.85, a)
      g.circle("fill", p.x, p.y, soft * 0.7)
    end
  end

  -- Flame + ember additive pass.
  g.setBlendMode("add")
  for _, p in ipairs(state.particles) do
    if p.kind == "flame" or p.kind == "fuel" then
      local temp = p.kind == "fuel" and p.temperature * 0.82 or p.temperature
      local r, gC, b, a = tempToColor(temp, p.life, false)
      local flicker = 0.8 + sin(state.time * 18 + p.seed * 11) * 0.22
      local radius = p.size * flicker

      g.setColor(r, gC, b, a * (p.kind == "flame" and 0.24 or 0.14))
      g.circle("fill", p.x, p.y, radius * 2.4)

      g.setColor(r, gC, b, a * (p.kind == "flame" and 0.7 or 0.4))
      g.circle("fill", p.x, p.y - radius * 0.2, radius * 1.15)

      if temp > 0.78 then
        g.setColor(1, 0.95, 0.8, a * 0.32)
        g.circle("fill", p.x, p.y - radius * 0.35, max(0.3, radius * 0.42))
      end
    elseif p.kind == "ember" then
      local r, gC, b, a = tempToColor(p.temperature, p.life, false)
      g.setColor(r, gC, b, a * 0.9)
      g.circle("fill", p.x, p.y, max(0.4, p.size))
      g.setColor(1, 0.8, 0.35, a * 0.35)
      g.circle("fill", p.x, p.y, max(0.25, p.size * 0.5))

      g.setColor(r, gC, b, a * 0.35)
      g.setLineWidth(max(0.4, p.size * 0.4))
      g.line(p.x, p.y, p.x - p.vx * 2.2, p.y - p.vy * 2.2)
    end
  end
  g.setBlendMode("alpha")
  g.setLineWidth(1)
end

Effects.register("Combustion", Combustion)

return Combustion
