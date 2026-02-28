--[[
  effects/sunburst.lua — Claude sunburst breathing effect

  Organic radial sunburst with independently breathing rays,
  inspired by the Claude logo. Each ray pulses in length with
  staggered phase offsets creating a flowing, meditative rhythm.

  Supports activity-driven animation for use as Claude's "brain":
  the `activity` prop (0-1) scales breath amplitude, glow, rotation,
  and speed. The `mode` prop selects a color preset that transitions
  smoothly. `transparent` lets backdrop effects show through.

  React usage:
    <Sunburst />
    <Sunburst speed={0.5} />
    <Sunburst background />
    <Sunburst reactive />
    <Sunburst hue={0.6} />
    <Sunburst activity={0.8} mode="thinking" transparent />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, cos, pi = math.sin, math.cos, math.pi
local min, max = math.min, math.max
local lerp = Util.lerp

local Sunburst = {}

-- 12 rays with hand-tuned organic irregularity.
-- da:  angle offset from even 30-degree spacing (radians)
-- len: relative length multiplier
-- w:   relative width multiplier
-- bv:  bevel offset for the asymmetric chisel-tip cut
-- ph:  breathing phase offset (staggered around the circle)
local RAYS = {
  { da =  0.03, len = 1.00, w = 1.00, bv =  0.30, ph = 0.00 },
  { da = -0.05, len = 0.84, w = 0.90, bv = -0.25, ph = 0.52 },
  { da =  0.04, len = 0.94, w = 1.06, bv =  0.35, ph = 1.05 },
  { da = -0.02, len = 0.88, w = 0.94, bv = -0.30, ph = 1.57 },
  { da =  0.06, len = 1.04, w = 1.00, bv =  0.20, ph = 2.09 },
  { da = -0.04, len = 0.78, w = 0.86, bv = -0.40, ph = 2.62 },
  { da =  0.02, len = 0.96, w = 1.03, bv =  0.28, ph = 3.14 },
  { da = -0.06, len = 0.86, w = 1.08, bv = -0.22, ph = 3.67 },
  { da =  0.05, len = 1.06, w = 0.96, bv =  0.38, ph = 4.19 },
  { da = -0.03, len = 0.82, w = 0.92, bv = -0.32, ph = 4.71 },
  { da =  0.07, len = 0.92, w = 1.00, bv =  0.24, ph = 5.24 },
  { da = -0.01, len = 0.87, w = 0.97, bv = -0.36, ph = 5.76 },
}

local NUM_RAYS = #RAYS
local BASE_STEP = (2 * pi) / NUM_RAYS

-- ── Mode color presets ────────────────────────────────────────────────
-- Each mode defines target hue, saturation, lightness for smooth lerp.

local MODE_COLORS = {
  idle       = { hue = 0.042, sat = 0.45, lit = 0.42 },
  thinking   = { hue = 0.760, sat = 0.72, lit = 0.58 },
  streaming  = { hue = 0.042, sat = 0.75, lit = 0.62 },
  permission = { hue = 0.080, sat = 0.80, lit = 0.55 },
  active     = { hue = 0.042, sat = 0.78, lit = 0.65 },
}
local DEFAULT_COLORS = { hue = 0.042, sat = 0.64, lit = 0.59 }

-- ── Lifecycle ────────────────────────────────────────────────────────

function Sunburst.create(w, h, props)
  return {
    time = 0,
    isBackground = false,
    isTransparent = false,
    reactiveIntensity = 0,
    breathScale = 1,
    -- Current smoothed color (lerps toward target each frame)
    hue = 0.042,
    sat = 0.64,
    lit = 0.59,
    -- Activity (lerps toward target)
    activity = 0,
  }
end

function Sunburst.update(state, dt, props, w, h, mouse)
  local speed    = Util.prop(props, "speed", 1.0)
  local reactive = Util.boolProp(props, "reactive", false)
  local activity = Util.prop(props, "activity", -1) -- -1 = not set
  local modeStr  = props.mode

  state.isBackground  = Util.boolProp(props, "background", false)
  state.isTransparent = Util.boolProp(props, "transparent", false)

  -- Resolve target color from mode or explicit hue/sat/lit props
  local targetHue, targetSat, targetLit
  if modeStr and MODE_COLORS[modeStr] then
    local mc = MODE_COLORS[modeStr]
    targetHue = mc.hue
    targetSat = mc.sat
    targetLit = mc.lit
  else
    targetHue = Util.prop(props, "hue", DEFAULT_COLORS.hue)
    targetSat = Util.prop(props, "saturation", DEFAULT_COLORS.sat)
    targetLit = Util.prop(props, "lightness", DEFAULT_COLORS.lit)
  end

  -- Smooth lerp color toward target (fast enough to feel responsive, slow
  -- enough to be visually fluid — ~200ms to settle)
  local cLerp = min(1, dt * 5.0)
  state.hue = lerp(state.hue, targetHue, cLerp)
  state.sat = lerp(state.sat, targetSat, cLerp)
  state.lit = lerp(state.lit, targetLit, cLerp)

  -- Activity lerp (smooth ramp up/down)
  local targetActivity = (activity >= 0) and activity or 0.5
  local aLerp = min(1, dt * 4.0)
  state.activity = lerp(state.activity, targetActivity, aLerp)

  -- Activity-scaled time accumulation: idle crawls, active races
  local activitySpeed = 0.3 + state.activity * 1.7  -- range 0.3x to 2.0x
  state.time = state.time + dt * speed * activitySpeed

  -- Reactive mode: mouse drives breath intensity
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.5 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 2.5, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.0, 0)
    end
    state.breathScale = 1.0 + (mouse.speed or 0) * 0.001 * state.reactiveIntensity
  else
    state.breathScale = 1.0
  end
end

function Sunburst.draw(state, w, h)
  local cx, cy = w / 2, h / 2
  local scale = min(w, h)
  local t = state.time
  local a = state.activity  -- 0-1 current activity level

  -- Background
  if state.isBackground or state.isTransparent then
    love.graphics.clear(0, 0, 0, 0)
  else
    love.graphics.clear(0.07, 0.07, 0.09, 1)
  end

  -- Proportions relative to container
  local maxR   = scale * 0.40
  local innerR = maxR * 0.16
  local baseHW = maxR * 0.042
  local tipHW  = maxR * 0.078
  local tipExt = maxR * 0.028

  -- Activity-scaled parameters
  local breathAmt = state.breathScale * (0.4 + a * 1.2)   -- idle: subtle, active: dramatic
  local rotSpeed  = 0.01 + a * 0.12                        -- idle: barely rotating, active: noticeable
  local glowAlpha = 0.04 + a * 0.20                        -- glow intensity scales with activity
  local glowScale = 0.85 + a * 0.35                        -- glow radius scales with activity

  local rot = t * rotSpeed

  -- Soft ambient glow behind the shape
  local gr, gg, gb = Util.hslToRgb(state.hue, state.sat * 0.5, state.lit * 0.3)
  love.graphics.setColor(gr, gg, gb, glowAlpha)
  love.graphics.circle("fill", cx, cy, maxR * glowScale)
  love.graphics.setColor(gr, gg, gb, glowAlpha * 0.5)
  love.graphics.circle("fill", cx, cy, maxR * (glowScale + 0.2))

  -- Draw each ray as a convex pentagon:
  --   base-left → tip-left → bevel-apex → tip-right → base-right
  for i, ray in ipairs(RAYS) do
    local angle = (i - 1) * BASE_STEP + ray.da + rot
    local ca, sa = cos(angle), sin(angle)
    local px, py = -sa, ca  -- perpendicular direction

    -- Multi-frequency breathing, amplitude scaled by activity
    local b1 = sin(t * 0.8 + ray.ph) * 0.12
    local b2 = sin(t * 2.3 + ray.ph * 1.7) * 0.04
    local breath = (b1 + b2) * breathAmt

    local outerR = max(innerR + 2, maxR * ray.len * (1 + breath))

    -- Subtle width pulsation
    local wPulse = 1 + sin(t * 0.6 + ray.ph + 1.0) * (0.02 + a * 0.06)
    local bw = baseHW * ray.w * wPulse
    local tw = tipHW * ray.w * wPulse

    -- Bevel offset (asymmetric chisel-tip)
    local bvOff = tipExt * ray.bv

    -- Per-ray color warmth shift (stronger at higher activity)
    local warmShift = 0.008 + a * 0.015
    local warmth = sin(t * 0.5 + ray.ph * 0.8) * warmShift
    local r, g, b = Util.hslToRgb(
      state.hue + warmth,
      state.sat + warmth * 0.5,
      state.lit + warmth * 0.3
    )
    love.graphics.setColor(r, g, b, 1)

    -- Base and tip center points
    local bx = cx + ca * innerR
    local by = cy + sa * innerR
    local tx = cx + ca * outerR
    local ty = cy + sa * outerR

    love.graphics.polygon("fill", {
      bx + px * bw, by + py * bw,                                -- base left
      tx + px * tw, ty + py * tw,                                -- tip left
      cx + ca * (outerR + tipExt) + px * bvOff,                  -- apex x
      cy + sa * (outerR + tipExt) + py * bvOff,                  -- apex y
      tx - px * tw, ty - py * tw,                                -- tip right
      bx - px * bw, by - py * bw,                                -- base right
    })
  end

  -- Center disc to unify the ray bases
  local cr, cg, cb = Util.hslToRgb(state.hue, state.sat, state.lit)
  love.graphics.setColor(cr, cg, cb, 1)
  love.graphics.circle("fill", cx, cy, innerR * 1.15)
end

Effects.register("Sunburst", Sunburst)

return Sunburst
