--[[
  math_utils.lua — Shared math utilities for ReactJIT

  Provides RPC handlers for compute-heavy math operations that benefit
  from LuaJIT's trace compiler. Lightweight ops (vector add, dot product)
  stay in TypeScript — crossing the bridge for 3 additions is slower than
  just doing them in JS.

  RPC handlers:
    math:noise2d    — 2D Perlin noise (single point)
    math:noise3d    — 3D Perlin noise (single point)
    math:noisefield — Generate WxH grid of 2D noise values
    math:fft        — FFT on real-valued array (Cooley-Tukey radix-2)
    math:ifft       — Inverse FFT
    math:bezier     — Evaluate cubic bezier curve at N points
    math:batch      — Batch array of {op, args} pairs
]]

local M = {}

-- ============================================================================
-- Perlin Noise (classic gradient noise)
-- ============================================================================

-- Permutation table (Ken Perlin's original)
local perm = {
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
  200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
  207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
  81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  254,157,115,66,180,156,126,1,20,69,173,92,52,28,56,233,
  127,236,243,215,128,205,184,176,195,204,138,222,121,114,67,29,
}

-- Double the permutation table to avoid modulo lookups
local p = {}
for i = 0, 255 do p[i] = perm[i + 1] end
for i = 256, 511 do p[i] = p[i - 256] end

-- Gradient vectors for 2D (unit circle, 8 directions)
local function grad2d(hash, x, y)
  local h = hash % 8
  if h == 0 then return  x + y end
  if h == 1 then return -x + y end
  if h == 2 then return  x - y end
  if h == 3 then return -x - y end
  if h == 4 then return  x     end
  if h == 5 then return -x     end
  if h == 6 then return      y end
  return -y
end

-- Gradient vectors for 3D (12 directions)
local function grad3d(hash, x, y, z)
  local h = hash % 12
  if h == 0  then return  x + y     end
  if h == 1  then return -x + y     end
  if h == 2  then return  x - y     end
  if h == 3  then return -x - y     end
  if h == 4  then return  x     + z end
  if h == 5  then return -x     + z end
  if h == 6  then return  x     - z end
  if h == 7  then return -x     - z end
  if h == 8  then return      y + z end
  if h == 9  then return     -y + z end
  if h == 10 then return      y - z end
  return -y - z
end

-- Fade curve (quintic, C2 continuous): 6t^5 - 15t^4 + 10t^3
local function fade(t)
  return t * t * t * (t * (t * 6 - 15) + 10)
end

local floor = math.floor

--- 2D Perlin noise, returns value in [-1, 1]
function M.noise2d(x, y, seed)
  seed = seed or 0
  x = x + seed * 31.7
  y = y + seed * 17.3

  local xi = floor(x) % 256
  local yi = floor(y) % 256
  local xf = x - floor(x)
  local yf = y - floor(y)

  local u = fade(xf)
  local v = fade(yf)

  local aa = p[p[xi] + yi]
  local ab = p[p[xi] + yi + 1]
  local ba = p[p[xi + 1] + yi]
  local bb = p[p[xi + 1] + yi + 1]

  local x1 = grad2d(aa, xf, yf) + (grad2d(ba, xf - 1, yf) - grad2d(aa, xf, yf)) * u
  local x2 = grad2d(ab, xf, yf - 1) + (grad2d(bb, xf - 1, yf - 1) - grad2d(ab, xf, yf - 1)) * u

  return x1 + (x2 - x1) * v
end

--- 3D Perlin noise, returns value in [-1, 1]
function M.noise3d(x, y, z, seed)
  seed = seed or 0
  x = x + seed * 31.7
  y = y + seed * 17.3
  z = z + seed * 23.1

  local xi = floor(x) % 256
  local yi = floor(y) % 256
  local zi = floor(z) % 256
  local xf = x - floor(x)
  local yf = y - floor(y)
  local zf = z - floor(z)

  local u = fade(xf)
  local v = fade(yf)
  local w = fade(zf)

  local aaa = p[p[p[xi] + yi] + zi]
  local aba = p[p[p[xi] + yi + 1] + zi]
  local aab = p[p[p[xi] + yi] + zi + 1]
  local abb = p[p[p[xi] + yi + 1] + zi + 1]
  local baa = p[p[p[xi + 1] + yi] + zi]
  local bba = p[p[p[xi + 1] + yi + 1] + zi]
  local bab = p[p[p[xi + 1] + yi] + zi + 1]
  local bbb = p[p[p[xi + 1] + yi + 1] + zi + 1]

  local x1 = grad3d(aaa, xf, yf, zf) + (grad3d(baa, xf-1, yf, zf) - grad3d(aaa, xf, yf, zf)) * u
  local x2 = grad3d(aba, xf, yf-1, zf) + (grad3d(bba, xf-1, yf-1, zf) - grad3d(aba, xf, yf-1, zf)) * u
  local y1 = x1 + (x2 - x1) * v

  x1 = grad3d(aab, xf, yf, zf-1) + (grad3d(bab, xf-1, yf, zf-1) - grad3d(aab, xf, yf, zf-1)) * u
  x2 = grad3d(abb, xf, yf-1, zf-1) + (grad3d(bbb, xf-1, yf-1, zf-1) - grad3d(abb, xf, yf-1, zf-1)) * u
  local y2 = x1 + (x2 - x1) * v

  return y1 + (y2 - y1) * w
end

--- Fractional Brownian Motion (multi-octave noise)
function M.fbm2d(x, y, octaves, seed, lacunarity, persistence)
  octaves = octaves or 4
  seed = seed or 0
  lacunarity = lacunarity or 2.0
  persistence = persistence or 0.5

  local total = 0
  local amplitude = 1
  local frequency = 1
  local maxValue = 0

  for _ = 1, octaves do
    total = total + M.noise2d(x * frequency, y * frequency, seed) * amplitude
    maxValue = maxValue + amplitude
    amplitude = amplitude * persistence
    frequency = frequency * lacunarity
  end

  return total / maxValue
end

function M.fbm3d(x, y, z, octaves, seed, lacunarity, persistence)
  octaves = octaves or 4
  seed = seed or 0
  lacunarity = lacunarity or 2.0
  persistence = persistence or 0.5

  local total = 0
  local amplitude = 1
  local frequency = 1
  local maxValue = 0

  for _ = 1, octaves do
    total = total + M.noise3d(x * frequency, y * frequency, z * frequency, seed) * amplitude
    maxValue = maxValue + amplitude
    amplitude = amplitude * persistence
    frequency = frequency * lacunarity
  end

  return total / maxValue
end

-- ============================================================================
-- FFT (Cooley-Tukey radix-2 DIT)
-- ============================================================================

local sin, cos, pi = math.sin, math.cos, math.pi
local sqrt = math.sqrt

--- Compute FFT of real-valued input. Returns magnitude spectrum.
--- Input is zero-padded to next power of 2.
function M.fft(samples)
  local n = #samples
  -- Pad to next power of 2
  local size = 1
  while size < n do size = size * 2 end

  -- Initialize complex arrays (interleaved: re, im, re, im, ...)
  local re = {}
  local im = {}
  for i = 1, size do
    re[i] = samples[i] or 0
    im[i] = 0
  end

  -- Bit-reversal permutation
  local j = 1
  for i = 1, size do
    if i < j then
      re[i], re[j] = re[j], re[i]
      im[i], im[j] = im[j], im[i]
    end
    local m = size / 2
    while m >= 1 and j > m do
      j = j - m
      m = m / 2
    end
    j = j + m
  end

  -- Butterfly passes
  local step = 1
  while step < size do
    local halfStep = step
    step = step * 2
    local angle = -pi / halfStep
    local wRe = cos(angle)
    local wIm = sin(angle)

    for k = 1, size, step do
      local tRe = 1
      local tIm = 0
      for m = 0, halfStep - 1 do
        local idx1 = k + m
        local idx2 = idx1 + halfStep
        local uRe = re[idx2] * tRe - im[idx2] * tIm
        local uIm = re[idx2] * tIm + im[idx2] * tRe
        re[idx2] = re[idx1] - uRe
        im[idx2] = im[idx1] - uIm
        re[idx1] = re[idx1] + uRe
        im[idx1] = im[idx1] + uIm
        local newTRe = tRe * wRe - tIm * wIm
        tIm = tRe * wIm + tIm * wRe
        tRe = newTRe
      end
    end
  end

  -- Return magnitude spectrum (first half only — symmetric for real input)
  local mag = {}
  local halfSize = size / 2
  for i = 1, halfSize do
    mag[i] = sqrt(re[i] * re[i] + im[i] * im[i]) / size
  end

  return mag
end

--- Inverse FFT — takes real and imaginary parts, returns real values
function M.ifft(realParts, imagParts)
  local n = #realParts

  -- Conjugate input
  local re = {}
  local im = {}
  for i = 1, n do
    re[i] = realParts[i]
    im[i] = -(imagParts[i] or 0)
  end

  -- Bit-reversal permutation
  local j = 1
  for i = 1, n do
    if i < j then
      re[i], re[j] = re[j], re[i]
      im[i], im[j] = im[j], im[i]
    end
    local m = n / 2
    while m >= 1 and j > m do
      j = j - m
      m = m / 2
    end
    j = j + m
  end

  -- Butterfly passes
  local step = 1
  while step < n do
    local halfStep = step
    step = step * 2
    local angle = -pi / halfStep
    local wRe = cos(angle)
    local wIm = sin(angle)

    for k = 1, n, step do
      local tRe = 1
      local tIm = 0
      for m = 0, halfStep - 1 do
        local idx1 = k + m
        local idx2 = idx1 + halfStep
        local uRe = re[idx2] * tRe - im[idx2] * tIm
        local uIm = re[idx2] * tIm + im[idx2] * tRe
        re[idx2] = re[idx1] - uRe
        im[idx2] = im[idx1] - uIm
        re[idx1] = re[idx1] + uRe
        im[idx1] = im[idx1] + uIm
        local newTRe = tRe * wRe - tIm * wIm
        tIm = tRe * wIm + tIm * wRe
        tRe = newTRe
      end
    end
  end

  -- Normalize
  local result = {}
  for i = 1, n do
    result[i] = re[i] / n
  end
  return result
end

-- ============================================================================
-- Bezier Curve Evaluation
-- ============================================================================

--- Evaluate a cubic bezier curve at N uniformly spaced points.
--- points: array of {x, y} control points (any length — uses De Casteljau's)
--- segments: number of output points
function M.bezier(points, segments)
  local n = #points
  if n < 2 then return points end
  segments = segments or 32

  local result = {}
  for i = 0, segments do
    local t = i / segments
    -- De Casteljau's algorithm
    local work = {}
    for j = 1, n do
      work[j] = { points[j][1], points[j][2] }
    end
    for level = n - 1, 1, -1 do
      for j = 1, level do
        work[j][1] = work[j][1] + (work[j + 1][1] - work[j][1]) * t
        work[j][2] = work[j][2] + (work[j + 1][2] - work[j][2]) * t
      end
    end
    result[#result + 1] = { work[1][1], work[1][2] }
  end

  return result
end

-- ============================================================================
-- RPC Handler registry
-- ============================================================================

local handlers = {}

handlers["math:noise2d"] = function(args)
  local octaves = args.octaves
  if octaves and octaves > 1 then
    return M.fbm2d(args.x or 0, args.y or 0, octaves, args.seed, args.lacunarity, args.persistence)
  end
  return M.noise2d(args.x or 0, args.y or 0, args.seed)
end

handlers["math:noise3d"] = function(args)
  local octaves = args.octaves
  if octaves and octaves > 1 then
    return M.fbm3d(args.x or 0, args.y or 0, args.z or 0, octaves, args.seed, args.lacunarity, args.persistence)
  end
  return M.noise3d(args.x or 0, args.y or 0, args.z or 0, args.seed)
end

handlers["math:noisefield"] = function(args)
  local w = args.width or 16
  local h = args.height or 16
  local ox = args.offsetX or 0
  local oy = args.offsetY or 0
  local sc = args.scale or 1
  local seed = args.seed or 0
  local octaves = args.octaves or 4
  local lac = args.lacunarity or 2.0
  local per = args.persistence or 0.5

  local field = {}
  local idx = 1
  for row = 0, h - 1 do
    for col = 0, w - 1 do
      local x = (col + ox) * sc
      local y = (row + oy) * sc
      field[idx] = M.fbm2d(x, y, octaves, seed, lac, per)
      idx = idx + 1
    end
  end
  return field
end

handlers["math:fft"] = function(args)
  return M.fft(args.samples or {})
end

handlers["math:ifft"] = function(args)
  return M.ifft(args.real or {}, args.imag or {})
end

handlers["math:bezier"] = function(args)
  local points = args.points or {}
  local segments = args.segments or 32
  -- Convert from JS array format [{x,y}...] or [[x,y]...] to Lua
  local luaPoints = {}
  for i = 1, #points do
    local pt = points[i]
    if pt[1] then
      luaPoints[i] = { pt[1], pt[2] }
    else
      luaPoints[i] = { pt.x or pt[1] or 0, pt.y or pt[2] or 0 }
    end
  end
  return M.bezier(luaPoints, segments)
end

handlers["math:batch"] = function(args)
  local ops = args.ops or {}
  local results = {}
  for i = 1, #ops do
    local entry = ops[i]
    local op = entry.op
    local opArgs = entry.args or {}
    local handler = handlers[op]
    if handler then
      results[i] = handler(opArgs)
    else
      results[i] = nil
    end
  end
  return results
end

function M.getHandlers()
  return handlers
end

return M
