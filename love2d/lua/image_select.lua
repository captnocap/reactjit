--[[
  image_select.lua -- Image selection algorithms (flood fill, Sobel edge detection)

  Pure functions over FFI uint8_t* RGBA8 pixel buffers. No GL, no side effects.
  All pixel access is via direct pointer arithmetic — no per-pixel function calls.

  Memory layout: flat RGBA8 array, 4 bytes per pixel.
    index = (y * width + x) * 4
    pixels[index + 0] = R
    pixels[index + 1] = G
    pixels[index + 2] = B
    pixels[index + 3] = A

  Mask layout: flat uint8_t array, 1 byte per pixel.
    mask[y * width + x] = 0 (not selected) or 1 (selected)
]]
local ffi = require("ffi")

local ImageSelect = {}

-- ============================================================================
-- Pre-allocated buffers (reused across calls to avoid GC pressure)
-- ============================================================================

local _mask = nil       -- uint8_t[w*h], reused if dimensions match
local _maskW = 0
local _maskH = 0

local _edges = nil      -- uint8_t[w*h], Sobel edge mask
local _edgesW = 0
local _edgesH = 0

-- Iterative flood fill stack (int32_t pairs: x, y)
local _stack = nil
local _stackCap = 0

local function ensureMask(w, h)
  local n = w * h
  if _mask == nil or _maskW ~= w or _maskH ~= h then
    _mask = ffi.new("uint8_t[?]", n)
    _maskW = w
    _maskH = h
  end
  ffi.fill(_mask, n, 0)
  return _mask
end

local function ensureEdges(w, h)
  local n = w * h
  if _edges == nil or _edgesW ~= w or _edgesH ~= h then
    _edges = ffi.new("uint8_t[?]", n)
    _edgesW = w
    _edgesH = h
  end
  ffi.fill(_edges, n, 0)
  return _edges
end

local function ensureStack(cap)
  if _stack == nil or _stackCap < cap then
    _stackCap = cap
    _stack = ffi.new("int32_t[?]", cap * 2)  -- pairs of (x, y)
  end
end

-- ============================================================================
-- Color distance
-- ============================================================================

--- Squared RGB distance between two pixels at byte offsets i1 and i2.
--- Ignores alpha channel.
--- @param pixels ffi.cdata  uint8_t* RGBA buffer
--- @param i1 number  Byte offset of pixel 1 (= (y*w+x)*4)
--- @param i2 number  Byte offset of pixel 2
--- @return number  Squared distance (0–195075 for 8-bit RGB)
function ImageSelect.colorDistanceSq(pixels, i1, i2)
  local dr = pixels[i1]     - pixels[i2]
  local dg = pixels[i1 + 1] - pixels[i2 + 1]
  local db = pixels[i1 + 2] - pixels[i2 + 2]
  return dr * dr + dg * dg + db * db
end

-- ============================================================================
-- Sobel edge detection
-- ============================================================================

--- Compute a binary edge mask using Sobel operator.
--- @param pixels ffi.cdata  uint8_t* RGBA buffer
--- @param w number  Image width
--- @param h number  Image height
--- @param threshold number  Edge magnitude threshold (0–255 range, squared internally)
--- @return ffi.cdata  uint8_t[w*h] edge mask (1 = edge, 0 = not)
function ImageSelect.sobelEdges(pixels, w, h, threshold)
  local edges = ensureEdges(w, h)
  local threshSq = threshold * threshold

  -- Convert to grayscale luminance for edge detection
  -- Skip border pixels (1px margin) — Sobel needs 3x3 neighborhood
  for y = 1, h - 2 do
    for x = 1, w - 2 do
      -- Compute grayscale for 3x3 neighborhood
      -- Inline the 9 pixel lookups for speed
      local function lum(px, py)
        local idx = (py * w + px) * 4
        -- Fast approximate luminance: (R + R + G + G + G + B) / 6
        return (pixels[idx] * 2 + pixels[idx + 1] * 3 + pixels[idx + 2]) / 6
      end

      local tl = lum(x-1, y-1)
      local tc = lum(x,   y-1)
      local tr = lum(x+1, y-1)
      local ml = lum(x-1, y)
      local mr = lum(x+1, y)
      local bl = lum(x-1, y+1)
      local bc = lum(x,   y+1)
      local br = lum(x+1, y+1)

      -- Sobel Gx: [-1 0 1; -2 0 2; -1 0 1]
      local gx = -tl + tr - 2*ml + 2*mr - bl + br

      -- Sobel Gy: [1 2 1; 0 0 0; -1 -2 -1]
      local gy = tl + 2*tc + tr - bl - 2*bc - br

      -- Magnitude squared (skip sqrt)
      local mag = gx * gx + gy * gy

      if mag > threshSq then
        edges[y * w + x] = 1
      end
    end
  end

  return edges
end

-- ============================================================================
-- Flood fill
-- ============================================================================

--- Flood fill from a seed point, producing a binary selection mask.
--- Uses iterative stack (no recursion). 4-connected neighbors.
--- @param pixels ffi.cdata  uint8_t* RGBA buffer
--- @param w number  Image width
--- @param h number  Image height
--- @param x0 number  Seed X coordinate
--- @param y0 number  Seed Y coordinate
--- @param tolerance number  Color distance threshold (0–255)
--- @param edgeMask ffi.cdata|nil  Optional Sobel edge mask (blocks flood at edges)
--- @return ffi.cdata, number  mask (uint8_t[w*h]), selected pixel count
function ImageSelect.floodFill(pixels, w, h, x0, y0, tolerance, edgeMask)
  local mask = ensureMask(w, h)

  -- Bounds check seed
  x0 = math.floor(x0)
  y0 = math.floor(y0)
  if x0 < 0 or x0 >= w or y0 < 0 or y0 >= h then
    return mask, 0
  end

  local tolSq = tolerance * tolerance
  local seedIdx = (y0 * w + x0) * 4
  local count = 0

  -- Stack-based iterative flood fill
  ensureStack(w * h)
  local stackTop = 0

  -- Push seed
  _stack[0] = x0
  _stack[1] = y0
  stackTop = 1
  mask[y0 * w + x0] = 1

  while stackTop > 0 do
    -- Pop
    stackTop = stackTop - 1
    local cx = _stack[stackTop * 2]
    local cy = _stack[stackTop * 2 + 1]
    count = count + 1

    -- Check 4 neighbors
    local nx, ny, ni, nmi
    for dir = 0, 3 do
      if dir == 0 then     nx = cx + 1; ny = cy
      elseif dir == 1 then nx = cx - 1; ny = cy
      elseif dir == 2 then nx = cx;     ny = cy + 1
      else                 nx = cx;     ny = cy - 1
      end

      -- Bounds check
      if nx >= 0 and nx < w and ny >= 0 and ny < h then
        nmi = ny * w + nx
        -- Not already visited
        if mask[nmi] == 0 then
          -- Not an edge (if edge mask provided)
          if not edgeMask or edgeMask[nmi] == 0 then
            -- Color distance check
            ni = nmi * 4
            local dr = pixels[ni]     - pixels[seedIdx]
            local dg = pixels[ni + 1] - pixels[seedIdx + 1]
            local db = pixels[ni + 2] - pixels[seedIdx + 2]
            local distSq = dr * dr + dg * dg + db * db

            if distSq <= tolSq then
              mask[nmi] = 1
              -- Push neighbor
              _stack[stackTop * 2] = nx
              _stack[stackTop * 2 + 1] = ny
              stackTop = stackTop + 1
            end
          end
        end
      end
    end
  end

  return mask, count
end

-- ============================================================================
-- Mask utilities
-- ============================================================================

--- Count selected pixels in a mask.
--- @param mask ffi.cdata  uint8_t[w*h]
--- @param w number
--- @param h number
--- @return number
function ImageSelect.maskPixelCount(mask, w, h)
  local count = 0
  local n = w * h
  for i = 0, n - 1 do
    if mask[i] ~= 0 then count = count + 1 end
  end
  return count
end

--- Create an RGBA texture from a mask + color.
--- Selected pixels get the mask color; unselected pixels are fully transparent.
--- @param mask ffi.cdata  uint8_t[w*h]
--- @param w number
--- @param h number
--- @param r number  Mask color red (0–1)
--- @param g number  Mask color green (0–1)
--- @param b number  Mask color blue (0–1)
--- @param a number  Mask color alpha (0–1)
--- @return ffi.cdata  uint8_t[w*h*4] RGBA texture data
function ImageSelect.maskToRGBA(mask, w, h, r, g, b, a)
  local n = w * h
  local rgba = ffi.new("uint8_t[?]", n * 4)
  local cr = math.floor(r * 255)
  local cg = math.floor(g * 255)
  local cb = math.floor(b * 255)
  local ca = math.floor(a * 255)

  for i = 0, n - 1 do
    local j = i * 4
    if mask[i] ~= 0 then
      rgba[j]     = cr
      rgba[j + 1] = cg
      rgba[j + 2] = cb
      rgba[j + 3] = ca
    else
      rgba[j]     = 0
      rgba[j + 1] = 0
      rgba[j + 2] = 0
      rgba[j + 3] = 0
    end
  end

  return rgba
end

return ImageSelect
