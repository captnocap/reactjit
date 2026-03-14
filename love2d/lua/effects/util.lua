--[[
  effects/util.lua — Shared utilities for generative effects

  Color conversion, palette mapping, and math helpers used across all effects.
]]

local Util = {}

--- Convert HSL (0-1 range) to Love2D RGBA (0-1 range).
--- @param h number  Hue 0-1
--- @param s number  Saturation 0-1
--- @param l number  Lightness 0-1
--- @param a number|nil  Alpha 0-1 (default 1)
--- @return number, number, number, number
function Util.hslToRgb(h, s, l, a)
  a = a or 1
  if s == 0 then return l, l, l, a end

  h = h % 1
  local function hue2rgb(p, q, t)
    if t < 0 then t = t + 1 end
    if t > 1 then t = t - 1 end
    if t < 1/6 then return p + (q - p) * 6 * t end
    if t < 1/2 then return q end
    if t < 2/3 then return p + (q - p) * (2/3 - t) * 6 end
    return p
  end

  local q = l < 0.5 and l * (1 + s) or l + s - l * s
  local p = 2 * l - q
  return hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3), a
end

--- Audio-to-color mapping: derives a color from pitch, tempo, and amplitude.
--- Ported from audio-canvas palette.js pitchTempoToColor.
---
--- @param pitch number  0-1 (spectral centroid / frequency content)
--- @param tempo number  0-1 (normalized tempo / speed)
--- @param amplitude number  0-1 (loudness / intensity)
--- @return number, number, number, number  r, g, b, a (Love2D 0-1 range)
function Util.pitchTempoToColor(pitch, tempo, amplitude)
  -- Hue: pitch maps low→warm, high→cool; tempo shifts
  local hue = pitch * 0.5 + tempo * 0.3
  -- Tempo-based hue shift: slow = warm shift, fast = cool shift
  local hueShift = (tempo - 0.5) * 0.11  -- ±20° mapped to 0-1
  hue = (hue + hueShift + 0.5) % 1

  -- Saturation: tempo-driven vibrancy (40-100%)
  local sat = 0.4 + tempo * 0.6

  -- Lightness: amplitude-driven brightness (20-70%)
  local lit = 0.2 + amplitude * 0.5

  return Util.hslToRgb(hue, sat, lit)
end

--- Generate a color from time-based defaults (no audio).
--- Uses oscillating values to create smooth color evolution.
--- @param time number  Elapsed time in seconds
--- @param speed number  Animation speed multiplier (default 1)
--- @return number, number, number, number  r, g, b, a
function Util.timeColor(time, speed)
  speed = speed or 1
  local t = time * speed
  local pitch = (math.sin(t * 0.3) + 1) * 0.5
  local tempo = (math.sin(t * 0.17 + 1.5) + 1) * 0.5
  local amplitude = (math.sin(t * 0.7 + 3.0) + 1) * 0.35 + 0.3
  return Util.pitchTempoToColor(pitch, tempo, amplitude)
end

--- Clamp a value to [min, max].
function Util.clamp(x, min, max)
  if x < min then return min end
  if x > max then return max end
  return x
end

--- Linear interpolation.
function Util.lerp(a, b, t)
  return a + (b - a) * t
end

--- Smooth step (ease in/out).
function Util.smoothstep(edge0, edge1, x)
  local t = Util.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
end

--- Distance between two points.
function Util.dist(x1, y1, x2, y2)
  local dx, dy = x2 - x1, y2 - y1
  return math.sqrt(dx * dx + dy * dy)
end

--- Resolve an effect prop with a fallback default.
--- If the prop exists and is a number, use it. Otherwise use the default.
function Util.prop(props, key, default)
  local v = props[key]
  if type(v) == "number" then return v end
  return default
end

--- Resolve a boolean effect prop.
function Util.boolProp(props, key, default)
  local v = props[key]
  if type(v) == "boolean" then return v end
  return default
end

return Util
