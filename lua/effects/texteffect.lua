--[[
  effects/texteffect.lua — Lua-native animated typography effects

  React usage:
    <TextEffect type="burst-hover" text="HOVER ME" />
    <TextEffect type="spin-3d" text="EAT SLEEP RAVE" />
    <TextEffect type="gradient-typing" text="LUA TYPE FX" />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, cos = math.sin, math.cos
local floor, min, max = math.floor, math.min, math.max
local abs, pi = math.abs, math.pi
local random = math.random
local noise = love.math.noise

local utf8Ok, utf8lib = pcall(require, "utf8")

local TextEffect = {}
local fontCache = {}

local function getFont(size)
  size = max(8, floor(size or 24))
  if not fontCache[size] then
    fontCache[size] = love.graphics.newFont(size)
  end
  return fontCache[size]
end

local function toChars(text)
  local chars = {}
  if utf8Ok and utf8lib and utf8lib.codes then
    for _, code in utf8lib.codes(text) do
      chars[#chars + 1] = utf8lib.char(code)
    end
  else
    for i = 1, #text do
      chars[#chars + 1] = text:sub(i, i)
    end
  end
  if #chars == 0 then chars[1] = " " end
  return chars
end

local function charsWidth(font, chars, spacing)
  local w = 0
  for i, ch in ipairs(chars) do
    w = w + font:getWidth(ch)
    if i < #chars then w = w + spacing end
  end
  return w
end

local function takeChars(chars, count)
  local n = max(0, min(#chars, floor(count or #chars)))
  local out = {}
  for i = 1, n do out[#out + 1] = chars[i] end
  return out
end

local function charsToString(chars)
  if #chars == 0 then return "" end
  return table.concat(chars, "")
end

local function alignedX(align, w, textW, pad)
  if align == "left" then return pad end
  if align == "right" then return w - textW - pad end
  return (w - textW) / 2
end

local function drawChars(font, chars, x, y, spacing, drawFn)
  local cx = x
  for i, ch in ipairs(chars) do
    if drawFn then
      drawFn(i, ch, cx, y)
    else
      love.graphics.print(ch, cx, y)
    end
    cx = cx + font:getWidth(ch)
    if i < #chars then cx = cx + spacing end
  end
end

local function variantAlias(variant)
  if variant == "neon-glow" then return "neon" end
  if variant == "wavy" then return "wavy-text" end
  return variant
end

local function spawnParticles(state, count, cx, cy, speedMul, hueBase, spread)
  if not state.particles then state.particles = {} end
  local pCount = max(1, floor(count or 8))
  local sp = speedMul or 120
  local h = hueBase or 0.08
  local jitter = spread or 6

  for i = 1, pCount do
    local a = (i / pCount) * pi * 2 + random() * 0.3
    local v = sp * (0.42 + random() * 0.88)
    state.particles[#state.particles + 1] = {
      x = cx + (random() - 0.5) * jitter,
      y = cy + (random() - 0.5) * jitter,
      vx = cos(a) * v,
      vy = sin(a) * v * 0.72,
      life = 0.22 + random() * 0.65,
      maxLife = 0.22 + random() * 0.65,
      size = 1.2 + random() * 2.9,
      hue = (h + random() * 0.22) % 1,
    }
  end

  if #state.particles > 320 then
    local drop = #state.particles - 320
    for _ = 1, drop do
      table.remove(state.particles, 1)
    end
  end
end

local function updateParticles(state, dt)
  local particles = state.particles
  if not particles or #particles == 0 then return end

  for i = #particles, 1, -1 do
    local p = particles[i]
    p.life = p.life - dt
    if p.life <= 0 then
      table.remove(particles, i)
    else
      p.x = p.x + p.vx * dt
      p.y = p.y + p.vy * dt
      p.vx = p.vx * (1 - min(0.7, dt * 2.6))
      p.vy = p.vy * (1 - min(0.5, dt * 1.8)) + dt * 30
    end
  end
end

local function drawParticles(state, alphaMul)
  local particles = state.particles
  if not particles or #particles == 0 then return end
  local mul = alphaMul or 1

  for i = 1, #particles do
    local p = particles[i]
    local lf = p.life / max(0.001, p.maxLife)
    local a = min(1, lf * mul)
    local r, g, b = Util.hslToRgb(p.hue, 0.92, 0.64)
    love.graphics.setColor(r, g, b, a * 0.7)
    love.graphics.circle("fill", p.x, p.y, p.size * (0.5 + lf * 1.2))
  end
end

function TextEffect.create(w, h, props)
  return {
    time = 0,
    glitch = 0,
    pulse = 0.5,
    drift = 0,
    hover = 0,
    burst = 0,
    wasInside = false,
    typeProgress = 0,
    typeErase = false,
    typeHold = 0,
    prevTyped = 0,
    revealPulse = 0,
    lastText = "",
    particles = {},
    props = props or {},
  }
end

function TextEffect.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local variant = variantAlias(tostring(state.props.effectType or state.props.type or "gradient-wave"))
  local speed = Util.prop(state.props, "speed", 1.0)
  local amplitude = Util.prop(state.props, "amplitude", 0.5)
  local reactive = Util.boolProp(state.props, "reactive", false)
  local beat = Util.boolProp(state.props, "beat", false)
  local infinite = Util.boolProp(state.props, "infinite", false)

  state.time = state.time + dt * speed
  state.pulse = Util.lerp(state.pulse, amplitude, min(1, dt * 8))

  if infinite then
    state.drift = sin(state.time * 0.9) * 18
  else
    state.drift = 0
  end

  local inside = mouse and mouse.inside or false
  state.hover = Util.lerp(state.hover, inside and 1 or 0, min(1, dt * 12))
  if inside and not state.wasInside then
    state.burst = 1
    spawnParticles(state, 24, (mouse and mouse.x or w * 0.5), (mouse and mouse.y or h * 0.5), 170, 0.06, 20)
  end
  state.wasInside = inside
  state.burst = max(0, state.burst - dt * 1.35)

  if beat then
    state.glitch = min(1, state.glitch + 0.6 + amplitude * 0.3)
    state.burst = min(1, state.burst + 0.4)
  end

  if reactive and mouse and inside then
    local push = min(0.22, (mouse.speed or 0) * 0.002)
    state.glitch = min(1, state.glitch + push)
    if variant == "burst-hover" then
      state.burst = min(1, state.burst + push * 2)
      if push > 0.12 then
        spawnParticles(state, 8, mouse.x, mouse.y, 190, 0.05 + push * 0.2, 18)
      end
    end
  end

  state.glitch = max(0, state.glitch - dt * 0.85)
  state.revealPulse = max(0, (state.revealPulse or 0) - dt * 2.4)

  local text = tostring(state.props.text or "LUA TYPE FX")
  if text ~= state.lastText then
    state.lastText = text
    state.typeProgress = 0
    state.typeErase = false
    state.typeHold = 0
    state.prevTyped = 0
  end

  local len = #toChars(text)
  local typingSpeed = Util.prop(state.props, "typingSpeed", 14)
  local eraseSpeed = Util.prop(state.props, "eraseSpeed", 20)

  if variant == "typewriter" then
    state.typeProgress = min(len, state.typeProgress + dt * typingSpeed)
    state.typeErase = false
    state.typeHold = 0
  elseif variant == "typewriter-text" then
    if not state.typeErase then
      state.typeProgress = min(len, state.typeProgress + dt * (typingSpeed * 1.05))
      if state.typeProgress >= len then
        state.typeHold = state.typeHold + dt
        if state.typeHold > 0.65 then
          state.typeErase = true
        end
      end
    else
      state.typeProgress = max(0, state.typeProgress - dt * eraseSpeed * 1.3)
      if state.typeProgress <= 0 then
        state.typeErase = false
        state.typeHold = 0
      end
    end
  elseif variant == "gradient-typing" then
    if not state.typeErase then
      state.typeProgress = min(len, state.typeProgress + dt * (typingSpeed * 1.15))
      if state.typeProgress >= len then
        state.typeHold = state.typeHold + dt
        if state.typeHold > 1.2 then
          state.typeErase = true
        end
      end
    else
      state.typeProgress = max(0, state.typeProgress - dt * eraseSpeed * 0.52)
      if state.typeProgress <= 0 then
        state.typeErase = false
        state.typeHold = 0
      end
    end
  elseif variant == "editor-illustration" then
    if not state.typeErase then
      state.typeProgress = min(len, state.typeProgress + dt * typingSpeed * 0.9)
      if state.typeProgress >= len then
        state.typeHold = state.typeHold + dt
        if state.typeHold > 1.1 then
          state.typeErase = true
        end
      end
    else
      state.typeProgress = max(0, state.typeProgress - dt * eraseSpeed * 0.82)
      if state.typeProgress <= 0 then
        state.typeErase = false
        state.typeHold = 0
      end
    end
  else
    state.typeProgress = len
    state.typeErase = false
    state.typeHold = 0
  end

  local typedNow = floor(state.typeProgress)
  local typedDelta = typedNow - (state.prevTyped or 0)
  if typedDelta > 0 then
    state.revealPulse = min(1.3, (state.revealPulse or 0) + typedDelta * 0.28)
    if variant == "typewriter" or variant == "typewriter-text" or variant == "gradient-typing" then
      spawnParticles(state, min(typedDelta * 4, 10), w * 0.5 + state.drift * 0.2, h * 0.5, 110, 0.55, 24)
    end
  end
  state.prevTyped = typedNow

  if beat then
    spawnParticles(state, 18, w * 0.5, h * 0.5, 180, 0.1 + amplitude * 0.3, 12)
  end

  updateParticles(state, dt)
end

local function drawTerminal(state, props, w, h, font, chars, x, y, spacing, textW)
  local t = state.time

  love.graphics.setColor(0.015, 0.07, 0.04, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local scanOffset = (t * 95) % 4
  for sy = -4 + scanOffset, h, 4 do
    love.graphics.setColor(0.12, 0.55, 0.28, 0.09)
    love.graphics.rectangle("fill", 0, sy, w, 1)
  end

  for i = 1, 6 do
    local by = noise(i * 0.77, t * 0.8) * h
    local bh = 1 + floor(noise(i * 1.71, t * 1.1) * 2)
    love.graphics.setColor(0.2, 0.95, 0.55, 0.03 + state.glitch * 0.1)
    love.graphics.rectangle("fill", 0, by, w, bh)
  end

  love.graphics.setColor(0.35, 1.0, 0.66, 0.12)
  drawChars(font, chars, x + 1, y, spacing)
  drawChars(font, chars, x - 1, y, spacing)

  love.graphics.setColor(0.66, 1.0, 0.8, 0.98)
  drawChars(font, chars, x, y, spacing)

  if floor(t * 2) % 2 == 0 then
    local cursorX = x + textW + 3
    love.graphics.setColor(0.66, 1.0, 0.8, 0.9)
    love.graphics.rectangle("fill", cursorX, y + 2, max(2, floor(font:getHeight() * 0.08)), font:getHeight() - 4)
  end
end

local function drawGradientWave(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local amp = 3 + state.pulse * 6

  love.graphics.setColor(0.02, 0.03, 0.07, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local phase = t * 2.3 + i * 0.5
    local yOff = sin(phase) * amp * 0.35
    local hue = ((i / max(1, #chars)) * 0.78 + t * 0.08) % 1
    local r, g, b = Util.hslToRgb(hue, 0.9, 0.62)

    love.graphics.setColor(r, g, b, 0.3)
    love.graphics.print(ch, cx, cy + yOff + 1)
    love.graphics.setColor(r, g, b, 0.98)
    love.graphics.print(ch, cx, cy + yOff)
  end)
end

local function drawNeon(state, props, w, h, font, chars, x, y, spacing, textW)
  local t = state.time
  local baseHue = (0.82 + sin(t * 0.23) * 0.06) % 1
  local pulse = 0.62 + 0.38 * sin(t * 2.6)
  local flicker = 0.78 + noise(91.2, t * 8.4) * 0.32
  local intensity = min(1.45, 0.68 + pulse * 0.46 + flicker * 0.4 + state.glitch * 0.5)
  local nr, ng, nb = Util.hslToRgb(baseHue, 0.96, 0.62)

  love.graphics.setColor(0.018, 0.012, 0.05, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  local sweepY = (t * 72) % (h + 24) - 12
  love.graphics.setColor(nr, ng, nb, 0.06 * intensity)
  love.graphics.rectangle("fill", 0, sweepY, w, 16)

  local haloPadX = font:getHeight() * 0.9
  local haloPadY = font:getHeight() * 0.45
  local haloX = x - haloPadX
  local haloY = y - haloPadY
  local haloW = textW + haloPadX * 2
  local haloH = font:getHeight() + haloPadY * 2
  for r = 4, 1, -1 do
    love.graphics.setColor(nr, ng, nb, (0.022 + r * 0.015) * intensity)
    love.graphics.rectangle("fill", haloX - r * 6, haloY - r * 4, haloW + r * 12, haloH + r * 8, 12, 12)
  end

  for i = 1, 4 do
    local sx = noise(i * 2.7, t * 0.95) * (w - 60)
    local sy = y + noise(i * 4.1, t * 1.4) * font:getHeight()
    local sw = 32 + noise(i * 6.2, t * 1.7) * 96
    love.graphics.setColor(1.0, 0.65, 0.92, 0.035 + 0.03 * pulse)
    love.graphics.rectangle("fill", sx, sy, sw, 1)
  end

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local phase = t * 3.1 + i * 0.34
    local hue = (baseHue + sin(phase) * 0.08 + i * 0.012) % 1
    local r, g, b = Util.hslToRgb(hue, 0.98, 0.64)
    local yOff = sin(phase * 0.85) * (0.3 + state.pulse * 0.55)
    local glowAlpha = 0.08 + 0.07 * intensity

    for spread = 3, 1, -1 do
      love.graphics.setColor(r, g, b, glowAlpha * spread)
      love.graphics.print(ch, cx + spread * 0.23, cy + yOff)
      love.graphics.print(ch, cx - spread * 0.23, cy + yOff)
    end

    love.graphics.setColor(1.0, 0.96, 1.0, min(1, 0.84 + intensity * 0.24))
    love.graphics.print(ch, cx + state.glitch * 0.55, cy + yOff)
  end)
end

local function drawGlitch(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local shift = 2 + state.glitch * 8

  love.graphics.setColor(0.05, 0.05, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  love.graphics.setColor(0.95, 0.95, 0.98, 0.88)
  drawChars(font, chars, x, y, spacing)

  love.graphics.setColor(1.0, 0.25, 0.35, 0.56)
  drawChars(font, chars, x + shift * 0.35, y, spacing)
  love.graphics.setColor(0.25, 0.95, 1.0, 0.56)
  drawChars(font, chars, x - shift * 0.35, y, spacing)

  local sliceH = max(2, floor(font:getHeight() / 4))
  for i = 0, 3 do
    local sy = y + i * sliceH + floor(noise(i * 1.9, t * 4) * 2)
    local offset = (noise(i * 3.1, t * 12) - 0.5) * state.glitch * 24
    love.graphics.setScissor(0, sy, w, sliceH)
    love.graphics.setColor(1, 1, 1, 0.7)
    drawChars(font, chars, x + offset, y, spacing)
  end
  love.graphics.setScissor()

  for sy = 0, h, 2 do
    love.graphics.setColor(1, 1, 1, 0.045)
    love.graphics.rectangle("fill", 0, sy, w, 1)
  end
end

local function drawBurstHover(state, props, w, h, font, chars, x, y, spacing, textW)
  local t = state.time
  local energy = min(1.55, state.burst + state.hover * 0.55 + state.glitch * 0.35)
  local centerX = x + textW * 0.5
  local centerY = y + font:getHeight() * 0.55

  love.graphics.setColor(0.04, 0.03, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 7, 1, -1 do
    local radius = (textW * 0.24 + i * 24) * (0.22 + energy * 0.56)
    love.graphics.setColor(1.0, 0.34 + i * 0.04, 0.12 + i * 0.02, 0.012 * i + 0.038 * energy)
    love.graphics.circle("fill", centerX, centerY, radius)
  end

  local wave = (1 - state.burst) * (120 + textW * 0.45)
  love.graphics.setColor(1.0, 0.64, 0.22, 0.22 + energy * 0.2)
  love.graphics.circle("line", centerX, centerY, wave)
  love.graphics.setColor(1.0, 0.43, 0.14, 0.12 + energy * 0.2)
  love.graphics.circle("line", centerX, centerY, wave * 0.72)

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local norm = (#chars <= 1) and 0 or ((i - 1) / (#chars - 1) - 0.5)
    local angle = norm * pi * 1.3 + t * 5.2 + i * 0.17
    local push = energy * (26 + abs(norm) * 66)
    local ox = cos(angle) * push * 0.28 + norm * energy * 40
    local oy = -abs(sin(angle)) * push * 0.16 + sin(t * 7 + i * 0.6) * 2.7 * energy
    local hue = (0.02 + i / max(1, #chars) * 0.14 + t * 0.08) % 1
    local r, g, b = Util.hslToRgb(hue, 0.95, 0.64)

    love.graphics.setColor(r, g, b, 0.24 + energy * 0.2)
    love.graphics.print(ch, cx + ox * 1.45, cy + oy)
    love.graphics.setColor(1, 0.7, 0.38, 0.14 + energy * 0.25)
    love.graphics.print(ch, cx + ox * 0.5, cy + oy + 1)

    love.graphics.setColor(1.0, 0.95, 0.86, 0.95)
    love.graphics.print(ch, cx + ox, cy + oy)
  end)

  for i = 1, 36 do
    local a = (i / 36) * pi * 2 + t * 3.2
    local r = (24 + noise(i * 2.2, t * 4.6) * 132) * (0.18 + energy)
    local px = centerX + cos(a) * r
    local py = centerY + sin(a * 1.6) * r * 0.32
    love.graphics.setColor(1, 0.74, 0.45, 0.1 + energy * 0.2)
    love.graphics.circle("fill", px, py, 0.9 + energy * 1.4)
  end

  drawParticles(state, 0.9 + energy * 0.7)
end

local function drawDancingShadow(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local amp = 5 + state.pulse * 10 + state.hover * 7

  love.graphics.setColor(0.08, 0.08, 0.12, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 18 do
    local yy = (i / 18) * h
    local a = 0.02 + noise(i * 1.8, t * 0.9) * 0.03 + state.hover * 0.03
    love.graphics.setColor(0.26, 0.3, 0.44, a)
    love.graphics.rectangle("fill", 0, yy, w, 1)
  end

  for i = 1, 5 do
    local sx = sin(t * (1.15 + i * 0.42) + i * 1.3) * amp * (0.75 + i * 0.1)
    local sy = cos(t * (1.55 + i * 0.34) + i * 0.9) * (1.8 + i * 0.45)
    local shadowAlpha = 0.11 + i * 0.06 + state.hover * 0.06
    love.graphics.setColor(0.0, 0.0, 0.0, shadowAlpha)
    drawChars(font, chars, x + sx, y + sy + i * 0.9, spacing)
    love.graphics.setColor(0.16, 0.24, 0.36, shadowAlpha * 0.55)
    drawChars(font, chars, x - sx * 0.45, y + sy + i * 1.2, spacing)
  end

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local hue = (0.08 + i / max(1, #chars) * 0.26 + t * 0.05) % 1
    local r, g, b = Util.hslToRgb(hue, 0.92, 0.7)
    local bob = sin(t * 2.7 + i * 0.6) * (0.5 + state.hover * 1.0)
    love.graphics.setColor(1, 1, 1, 0.16)
    love.graphics.print(ch, cx + 1, cy + bob + 1)
    love.graphics.setColor(r, g, b, 0.98)
    love.graphics.print(ch, cx, cy + bob)
  end)
end

local function drawMelting(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local fh = font:getHeight()

  love.graphics.setColor(0.04, 0.04, 0.07, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local charW = font:getWidth(ch)
    local meltNoise = noise(i * 0.41, t * 0.85 + i * 0.2)
    local drip = (4 + meltNoise * fh * (0.5 + state.pulse * 0.6) + state.hover * 9)
    local hue = (0.58 + i / max(1, #chars) * 0.12 + t * 0.03) % 1
    local r, g, b = Util.hslToRgb(hue, 0.86, 0.7)

    love.graphics.setColor(r, g, b, 0.18)
    love.graphics.print(ch, cx + 0.8, cy + 1)

    love.graphics.setColor(r, g, b, 0.95)
    love.graphics.print(ch, cx, cy)

    local dripX = cx + charW * 0.35
    local dripW = max(2, charW * 0.25)
    love.graphics.setColor(r, g, b, 0.54)
    love.graphics.rectangle("fill", dripX, cy + fh - 3, dripW, drip)
    love.graphics.circle("fill", dripX + dripW * 0.5, cy + fh - 3 + drip, dripW * 0.45)
  end)
end

local function drawTextMask(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time

  love.graphics.setColor(0.02, 0.02, 0.04, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 8 do
    local bx = ((i * 120 + t * 150) % (w + 180)) - 110
    local hue = (0.48 + i * 0.05 + t * 0.06) % 1
    local r, g, b = Util.hslToRgb(hue, 0.78, 0.5)
    love.graphics.setColor(r, g, b, 0.08)
    love.graphics.polygon("fill", bx, 0, bx + 110, 0, bx + 52, h, bx - 40, h)
  end

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local charW = max(2, font:getWidth(ch))
    local charH = font:getHeight()
    local bands = 7

    for band = 0, bands - 1 do
      local bx = cx + (band / bands) * charW
      local bw = max(1, charW / bands + 1.2)
      local sweep = sin(t * 2.8 + i * 0.35 + band * 0.9) * 0.08
      local hue = ((i * 0.07) + (band * 0.12) + t * 0.16 + sweep) % 1
      local r, g, b = Util.hslToRgb(hue, 0.94, 0.64)

      love.graphics.setScissor(bx, cy - 2, bw, charH + 4)
      love.graphics.setColor(r, g, b, 0.95)
      love.graphics.print(ch, cx, cy)
      love.graphics.setColor(r, g, b, 0.22)
      love.graphics.print(ch, cx, cy + sin(t * 4 + band + i * 0.5) * 1.2)
      love.graphics.setColor(1, 1, 1, 0.12)
      love.graphics.print(ch, cx + 1, cy + 1)
      love.graphics.setScissor()
    end
  end)

  for i = 1, 22 do
    local px = noise(i * 1.7, t * 0.85) * w
    local py = noise(i * 2.1, t * 1.1 + 7) * h
    love.graphics.setColor(1, 1, 1, 0.05 + noise(i * 3.3, t * 1.8) * 0.05)
    love.graphics.circle("fill", px, py, 0.7 + noise(i * 2.9, t * 1.5) * 1.5)
  end
end

local function drawSpin3D(state, props, w, h, font, chars, x, y, spacing, textW)
  local t = state.time
  local cx = x + textW * 0.5
  local cy = h * 0.5
  local radius = min(h * 0.31, 104)
  local rings = 24
  local tilt = sin(t * 0.6) * 0.22
  local rotX = t * 1.35
  local layers = {}

  love.graphics.setColor(0.03, 0.03, 0.05, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 24 do
    local yy = cy + (i - 12) * 8 + sin(t * 0.8 + i * 0.4) * 1.5
    love.graphics.setColor(0.2, 0.24, 0.34, 0.03)
    love.graphics.rectangle("fill", 0, yy, w, 1)
  end

  for i = 1, rings do
    local a = rotX + (i / rings) * pi * 2
    local depth = cos(a + tilt)
    local localY = sin(a) * radius
    layers[#layers + 1] = {
      depth = depth,
      y = cy + localY * 0.78,
      hue = (0.54 + (i / rings) * 0.18 + t * 0.05) % 1,
      a = a,
    }
  end

  table.sort(layers, function(a, b) return a.depth < b.depth end)

  for _, layer in ipairs(layers) do
    local depthNorm = (layer.depth + 1) * 0.5
    local perspective = 0.3 + depthNorm * 1.18
    local sy = 0.2 + depthNorm * 1.08
    local xShift = sin(layer.a * 0.65 + tilt) * 28 * (1 - depthNorm * 0.55)
    local alpha = 0.05 + depthNorm * 0.92
    local r, g, b = Util.hslToRgb(layer.hue, 0.9, 0.68)

    drawChars(font, chars, x + xShift, layer.y - font:getHeight() * sy * 0.5, spacing, function(_, ch, ccx, ccy)
      love.graphics.setColor(r, g, b, alpha * 0.84)
      love.graphics.print(ch, ccx, ccy, 0, perspective, sy)
      love.graphics.setColor(r, g, b, alpha * 0.25)
      love.graphics.print(ch, ccx + 1, ccy + 1, 0, perspective, sy)
    end)
  end

  love.graphics.setColor(1, 1, 1, 0.16)
  drawChars(font, chars, x, cy - font:getHeight() * 0.5, spacing)

  love.graphics.setColor(0.45, 0.75, 1.0, 0.14)
  love.graphics.ellipse("line", cx, cy, radius * 0.95, radius * 0.35)
  love.graphics.setColor(0.45, 0.75, 1.0, 0.08)
  love.graphics.ellipse("line", cx, cy, radius * 0.95, radius * 0.65)
end

local function drawWavyText(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local amp = 5 + state.pulse * 9 + state.hover * 7

  love.graphics.setColor(0.02, 0.04, 0.09, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 10 do
    local yy = h * 0.2 + i * (h * 0.06) + sin(t * (1 + i * 0.13) + i) * 5
    love.graphics.setColor(0.24, 0.35, 0.52, 0.06)
    love.graphics.rectangle("fill", 0, yy, w, 1)
  end

  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local phase = t * 3.8 + i * 0.65
    local yOff = sin(phase) * amp
    local xOff = cos(phase * 0.7) * (0.6 + state.pulse * 1.1)
    local hue = (0.52 + i / max(1, #chars) * 0.22 + t * 0.1) % 1
    local r, g, b = Util.hslToRgb(hue, 0.9, 0.64)

    love.graphics.setColor(r, g, b, 0.2)
    love.graphics.print(ch, cx + xOff * 1.5, cy + yOff + 2.2)
    love.graphics.setColor(r, g, b, 0.34)
    love.graphics.print(ch, cx - xOff * 0.7, cy + yOff + 1.0)
    love.graphics.setColor(r, g, b, 0.98)
    love.graphics.print(ch, cx + xOff, cy + yOff)
  end)

  drawParticles(state, 0.35 + state.hover * 0.45)
end

local function drawTypewriter(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local fullW = charsWidth(font, chars, spacing)
  local visible = takeChars(chars, state.typeProgress)
  local visibleW = charsWidth(font, visible, spacing)

  love.graphics.setColor(0.08, 0.07, 0.06, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for sy = 10, h, 6 do
    love.graphics.setColor(0.2, 0.18, 0.14, 0.08)
    love.graphics.rectangle("fill", 0, sy, w, 1)
  end

  local jitter = (state.revealPulse or 0) * 1.8
  love.graphics.setColor(0.25, 0.21, 0.16, 0.4)
  drawChars(font, chars, x, y, spacing)

  love.graphics.setColor(0.18, 0.12, 0.08, 0.35)
  drawChars(font, visible, x + jitter, y + 1, spacing)
  love.graphics.setColor(0.95, 0.92, 0.86, 0.98)
  drawChars(font, visible, x, y, spacing)

  if floor(t * 2) % 2 == 0 then
    local cursorX = x + visibleW + 2
    love.graphics.setColor(0.96, 0.94, 0.9, 0.96)
    love.graphics.rectangle("fill", cursorX, y + 3, max(2, floor(font:getHeight() * 0.08)), font:getHeight() - 6)
  end

  local carriageY = y - 14
  local carriageX = x + visibleW - 8
  love.graphics.setColor(0.15, 0.13, 0.11, 0.8)
  love.graphics.rectangle("fill", carriageX, carriageY, 16, 6, 2, 2)

  if visibleW < fullW then
    love.graphics.setColor(0.36, 0.3, 0.22, 0.35)
    love.graphics.rectangle("fill", x + visibleW, y + font:getHeight() + 3, fullW - visibleW, 1)
  end

  drawParticles(state, 0.25 + (state.revealPulse or 0) * 0.7)
end

local function drawTypewriterLoop(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local visible = takeChars(chars, state.typeProgress)
  local visibleW = charsWidth(font, visible, spacing)
  local erasePhase = state.typeErase and 1 or 0

  love.graphics.setColor(0.02, 0.03, 0.04, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for sy = 0, h, 4 do
    love.graphics.setColor(0.16, 0.2, 0.26, 0.06)
    love.graphics.rectangle("fill", 0, sy, w, 1)
  end

  love.graphics.setColor(0.22, 0.24, 0.3, 0.22)
  drawChars(font, chars, x, y, spacing)

  drawChars(font, visible, x, y, spacing, function(i, ch, cx, cy)
    local hue = (0.56 + i / max(1, #chars) * 0.08 + t * 0.04) % 1
    local r, g, b = Util.hslToRgb(hue, 0.55, 0.78)
    love.graphics.setColor(r, g, b, 0.95)
    love.graphics.print(ch, cx, cy)
  end)

  local caretW = max(2, floor(font:getHeight() * 0.08))
  local cursorX = x + visibleW + 2
  if floor(t * 2.8) % 2 == 0 then
    love.graphics.setColor(0.85, 0.92, 1.0, 0.92)
    love.graphics.rectangle("fill", cursorX, y + 2, caretW, font:getHeight() - 4)
  end

  if erasePhase > 0 then
    love.graphics.setColor(0.85, 0.16, 0.22, 0.24)
    love.graphics.rectangle("fill", cursorX - 8, y - 2, 10, font:getHeight() + 4)
  end

  drawParticles(state, 0.24 + (state.revealPulse or 0) * 0.4)
end

local function drawGradientTyping(state, props, w, h, font, chars, x, y, spacing)
  local t = state.time
  local fullW = charsWidth(font, chars, spacing)
  local visible = takeChars(chars, state.typeProgress)
  local visibleW = charsWidth(font, visible, spacing)
  local progress = fullW > 0 and (visibleW / fullW) or 0

  love.graphics.setColor(0.02, 0.02, 0.05, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 10 do
    local bx = ((i * 90 + t * 180) % (w + 150)) - 75
    local hue = (0.62 + i * 0.04 + t * 0.08) % 1
    local r, g, b = Util.hslToRgb(hue, 0.86, 0.56)
    love.graphics.setColor(r, g, b, 0.08)
    love.graphics.polygon("fill", bx, 0, bx + 70, 0, bx + 30, h, bx - 42, h)
  end

  love.graphics.setColor(0.22, 0.22, 0.3, 0.28)
  drawChars(font, chars, x, y, spacing)

  drawChars(font, visible, x, y, spacing, function(i, ch, cx, cy)
    local sweep = sin(t * 4 + i * 0.6) * 0.06
    local hue = (i / max(1, #chars) * 0.82 + t * 0.12 + sweep) % 1
    local r, g, b = Util.hslToRgb(hue, 0.92, 0.62)
    love.graphics.setColor(r, g, b, 0.25)
    love.graphics.print(ch, cx, cy + 2)
    love.graphics.setColor(r, g, b, 0.42)
    love.graphics.print(ch, cx + 1, cy + 1)
    love.graphics.setColor(r, g, b, 0.98)
    love.graphics.print(ch, cx, cy + sin(t * 5 + i * 0.3) * 0.4)
  end)

  if floor(t * 2.2) % 2 == 0 then
    love.graphics.setColor(1, 1, 1, 0.9)
    love.graphics.rectangle("fill", x + visibleW + 2, y + 2, 2, font:getHeight() - 4)
  end

  local barW = fullW * progress
  love.graphics.setColor(0.85, 0.95, 1.0, 0.2)
  love.graphics.rectangle("fill", x, y + font:getHeight() + 3, barW, 2)
  love.graphics.setColor(1, 1, 1, 0.22 + (state.revealPulse or 0) * 0.3)
  love.graphics.rectangle("fill", x + visibleW - 2, y - 3, 3, font:getHeight() + 6)

  drawParticles(state, 0.38 + (state.revealPulse or 0) * 0.7)
end

local function drawEditorIllustration(state, props, w, h)
  local t = state.time
  local panelPad = 12
  local panelW = w - panelPad * 2
  local panelH = h - panelPad * 2
  local panelX = panelPad
  local panelY = panelPad
  local gutterW = 34

  love.graphics.setColor(0.04, 0.05, 0.08, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  love.graphics.setColor(0.08, 0.1, 0.14, 1)
  love.graphics.rectangle("fill", panelX, panelY, panelW, panelH, 10, 10)
  love.graphics.setColor(0.12, 0.14, 0.2, 1)
  love.graphics.rectangle("fill", panelX, panelY, panelW, 26, 10, 10)
  love.graphics.setColor(0.08, 0.09, 0.13, 1)
  love.graphics.rectangle("fill", panelX, panelY + 26, gutterW, panelH - 26)
  love.graphics.setColor(0.1, 0.12, 0.18, 1)
  love.graphics.rectangle("fill", panelX + panelW - 110, panelY + 26, 110, panelH - 26)

  local codeFont = getFont(max(10, floor(h * 0.115)))
  love.graphics.setFont(codeFont)

  local lineH = codeFont:getHeight() + 5
  local baseY = panelY + 34
  local txtX = panelX + gutterW + 10

  local typed = takeChars(toChars(tostring(props.text or "LUA TYPE FX")), state.typeProgress)
  local typedText = charsToString(typed)

  local lines = {
    "const headline =",
    "\"" .. typedText .. "\";",
    "render(<TextEffect",
    "  type=\"gradient-typing\" />)",
  }

  for i, line in ipairs(lines) do
    local yy = baseY + (i - 1) * lineH
    if i == 2 then
      love.graphics.setColor(0.2, 0.24, 0.34, 0.4)
      love.graphics.rectangle("fill", panelX + gutterW + 6, yy - 1, panelW - gutterW - 122, lineH, 4, 4)
    end
    love.graphics.setColor(0.45, 0.5, 0.62, 0.86)
    love.graphics.print(tostring(i), panelX + 9, yy)

    if i == 2 then
      love.graphics.setColor(0.94, 0.58, 0.78, 0.98)
    elseif i == 1 then
      love.graphics.setColor(0.62, 0.84, 1.0, 0.96)
    else
      love.graphics.setColor(0.78, 0.84, 0.95, 0.96)
    end
    love.graphics.print(line, txtX, yy)
  end

  for i = 1, 3 do
    local bx = panelX + panelW - 100
    local by = baseY + (i - 1) * (lineH + 6)
    love.graphics.setColor(0.14, 0.18, 0.26, 0.9)
    love.graphics.rectangle("fill", bx, by, 84, lineH, 4, 4)
    love.graphics.setColor(0.62, 0.84, 1.0, 0.5)
    love.graphics.rectangle("fill", bx + 8, by + 5, 48 + sin(t * 2 + i) * 18, 2)
  end

  if floor(t * 2) % 2 == 0 then
    local cursorX = txtX + codeFont:getWidth(lines[2]) + 1
    local cursorY = baseY + lineH
    love.graphics.setColor(0.96, 0.96, 1, 0.95)
    love.graphics.rectangle("fill", cursorX, cursorY + 2, 2, codeFont:getHeight() - 3)
  end

  love.graphics.setColor(0.5, 0.56, 0.74, 0.44)
  love.graphics.rectangle("line", panelX, panelY, panelW, panelH, 10, 10)
  drawParticles(state, 0.18 + (state.revealPulse or 0) * 0.2)
end

local function drawHoverTransition(state, props, w, h, font, chars, x, y, spacing, textW)
  local t = state.time
  local reveal = max(state.hover, 0.08 + 0.06 * sin(t * 1.4))
  local sweep = (t * 140) % (textW + 80)

  love.graphics.setColor(0.03, 0.03, 0.07, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  for i = 1, 8 do
    local yy = y - 22 + i * 8
    love.graphics.setColor(0.2, 0.26, 0.38, 0.04 + reveal * 0.05)
    love.graphics.rectangle("fill", x - 20, yy, textW + 40, 1)
  end

  love.graphics.setColor(0.56, 0.6, 0.7, 0.55)
  drawChars(font, chars, x, y, spacing)

  local clipW = textW * reveal
  love.graphics.setScissor(max(0, x), max(0, y - 3), max(0, clipW), font:getHeight() + 8)
  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local hue = (0.58 + i / max(1, #chars) * 0.2 + t * 0.12) % 1
    local r, g, b = Util.hslToRgb(hue, 0.9, 0.67)
    love.graphics.setColor(r, g, b, 0.95)
    love.graphics.print(ch, cx, cy)
  end)
  love.graphics.setScissor()

  love.graphics.setScissor(max(0, x + sweep - 30), max(0, y - 3), 36, font:getHeight() + 8)
  drawChars(font, chars, x, y, spacing, function(i, ch, cx, cy)
    local hue = (0.1 + i / max(1, #chars) * 0.16 + t * 0.2) % 1
    local r, g, b = Util.hslToRgb(hue, 0.95, 0.72)
    love.graphics.setColor(r, g, b, 0.88)
    love.graphics.print(ch, cx, cy)
  end)
  love.graphics.setScissor()

  love.graphics.setColor(0.62, 0.82, 1.0, 0.18 + reveal * 0.42)
  love.graphics.rectangle("fill", x, y + font:getHeight() + 2, clipW, 2)
  drawParticles(state, 0.16 + reveal * 0.45)
end

function TextEffect.draw(state, w, h)
  local props = state.props or {}
  local variant = variantAlias(tostring(props.effectType or props.type or "gradient-wave"))
  local text = tostring(props.text or "LUA TYPE FX")
  local baseFontSize = Util.prop(props, "fontSize", max(18, floor(h * 0.34)))
  local align = tostring(props.align or "center")
  local spacing = Util.prop(props, "letterSpacing", 1)
  local pad = 12

  local fontSize = baseFontSize
  if variant == "editor-illustration" then
    fontSize = max(14, floor(h * 0.1))
  end

  local font = getFont(fontSize)
  love.graphics.setFont(font)

  local chars = toChars(text)
  local textW = charsWidth(font, chars, spacing)
  local x = alignedX(align, w, textW, pad) + (state.drift or 0)
  local y = (h - font:getHeight()) / 2

  if variant == "terminal" then
    drawTerminal(state, props, w, h, font, chars, x, y, spacing, textW)
  elseif variant == "gradient-wave" then
    drawGradientWave(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "neon" then
    drawNeon(state, props, w, h, font, chars, x, y, spacing, textW)
  elseif variant == "glitch" then
    drawGlitch(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "burst-hover" then
    drawBurstHover(state, props, w, h, font, chars, x, y, spacing, textW)
  elseif variant == "dancing-shadow" then
    drawDancingShadow(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "melting" then
    drawMelting(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "text-mask" then
    drawTextMask(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "spin-3d" then
    drawSpin3D(state, props, w, h, font, chars, x, y, spacing, textW)
  elseif variant == "wavy-text" then
    drawWavyText(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "typewriter" then
    drawTypewriter(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "typewriter-text" then
    drawTypewriterLoop(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "gradient-typing" then
    drawGradientTyping(state, props, w, h, font, chars, x, y, spacing)
  elseif variant == "editor-illustration" then
    drawEditorIllustration(state, props, w, h)
  elseif variant == "hover-transition" then
    drawHoverTransition(state, props, w, h, font, chars, x, y, spacing, textW)
  else
    drawGradientWave(state, props, w, h, font, chars, x, y, spacing)
  end
end

Effects.register("TextEffect", TextEffect)

return TextEffect
