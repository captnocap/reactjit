--[[
  svg_animate.lua — Pure math for SVG animation primitives.

  Provides polyline sampling, slicing, resampling, vertex interpolation,
  and color lerping. No state management — state lives in the capability.

  Used by: lua/capabilities/svg_animation.lua
  Reuses:  StrokeDash.polylineMetrics() for arc-length computation
           Animate.easing for easing function lookup
]]

local SVGAnim = {}

local StrokeDash = require("lua.stroke_dash")
local Animate = require("lua.animate")

local sqrt = math.sqrt
local floor = math.floor
local min = math.min
local max = math.max
local atan2 = math.atan2
local abs = math.abs

-- ============================================================================
-- Arc-length computation
-- ============================================================================

--- Compute cumulative distances along a flat polyline.
--- Delegates to StrokeDash.polylineMetrics().
--- @param coords table  Flat array {x1,y1,x2,y2,...}
--- @return table cumDist  Cumulative distance at each vertex
--- @return number totalLen  Total arc length
--- @return number n  Number of vertices
function SVGAnim.polylineCumDist(coords)
  return StrokeDash.polylineMetrics(coords)
end

-- ============================================================================
-- Point sampling along polyline
-- ============================================================================

--- Find the (x, y) at normalized t in [0,1] along a polyline.
--- @param coords table  Flat point array
--- @param cumDist table  Cumulative distances
--- @param n number  Point count
--- @param t number  Normalized parameter [0,1]
--- @return number x
--- @return number y
function SVGAnim.sampleAt(coords, cumDist, n, t)
  if n < 1 then return 0, 0 end
  if t <= 0 then return coords[1], coords[2] end
  if t >= 1 then return coords[n * 2 - 1], coords[n * 2] end

  local d = t * cumDist[n]

  -- Binary search for containing segment
  local lo, hi = 1, n
  while lo < hi - 1 do
    local mid = floor((lo + hi) / 2)
    if cumDist[mid] <= d then lo = mid else hi = mid end
  end

  local segLen = cumDist[hi] - cumDist[lo]
  if segLen < 1e-6 then return coords[lo * 2 - 1], coords[lo * 2] end
  local frac = (d - cumDist[lo]) / segLen
  local x = coords[lo * 2 - 1] + frac * (coords[hi * 2 - 1] - coords[lo * 2 - 1])
  local y = coords[lo * 2] + frac * (coords[hi * 2] - coords[lo * 2])
  return x, y
end

--- Compute tangent angle (radians) at normalized t along a polyline.
--- @param coords table  Flat point array
--- @param cumDist table  Cumulative distances
--- @param n number  Point count
--- @param t number  Normalized parameter [0,1]
--- @return number angle  Radians
function SVGAnim.tangentAt(coords, cumDist, n, t)
  if n < 2 then return 0 end

  local d = t * cumDist[n]

  -- Find segment
  local lo, hi = 1, n
  while lo < hi - 1 do
    local mid = floor((lo + hi) / 2)
    if cumDist[mid] <= d then lo = mid else hi = mid end
  end

  local dx = coords[hi * 2 - 1] - coords[lo * 2 - 1]
  local dy = coords[hi * 2] - coords[lo * 2]
  return atan2(dy, dx)
end

-- ============================================================================
-- Polyline slicing (for stroke reveal)
-- ============================================================================

--- Return vertices from start up to t * totalLen.
--- The last vertex is interpolated to land exactly at the target distance.
--- @param coords table  Flat point array
--- @param cumDist table  Cumulative distances
--- @param n number  Point count
--- @param totalLen number  Total arc length
--- @param t number  Normalized [0,1]
--- @return table  New flat coordinate array (may be shorter than original)
function SVGAnim.slicePolyline(coords, cumDist, n, totalLen, t)
  if n < 2 or t <= 0 then return {} end
  if t >= 1 then
    -- Copy all
    local out = {}
    for i = 1, n * 2 do out[i] = coords[i] end
    return out
  end

  local targetDist = t * totalLen
  local out = { coords[1], coords[2] }

  for i = 2, n do
    if cumDist[i] >= targetDist then
      -- Interpolate final point
      local segLen = cumDist[i] - cumDist[i - 1]
      if segLen < 1e-6 then
        out[#out + 1] = coords[i * 2 - 1]
        out[#out + 1] = coords[i * 2]
      else
        local frac = (targetDist - cumDist[i - 1]) / segLen
        local x = coords[(i - 1) * 2 - 1] + frac * (coords[i * 2 - 1] - coords[(i - 1) * 2 - 1])
        local y = coords[(i - 1) * 2] + frac * (coords[i * 2] - coords[(i - 1) * 2])
        out[#out + 1] = x
        out[#out + 1] = y
      end
      return out
    end

    out[#out + 1] = coords[i * 2 - 1]
    out[#out + 1] = coords[i * 2]
  end

  return out
end

-- ============================================================================
-- Polyline resampling (for morph)
-- ============================================================================

--- Resample a polyline to exactly targetN vertices using uniform arc-length spacing.
--- @param coords table  Flat point array
--- @param cumDist table  Cumulative distances
--- @param n number  Point count
--- @param totalLen number  Total arc length
--- @param targetN number  Desired vertex count
--- @return table  New flat coordinate array with targetN * 2 entries
function SVGAnim.resamplePolyline(coords, cumDist, n, totalLen, targetN)
  if targetN < 1 then return {} end
  if n < 2 or totalLen < 1e-6 then
    -- Degenerate: repeat first point
    local out = {}
    local x0 = coords[1] or 0
    local y0 = coords[2] or 0
    for i = 1, targetN do
      out[i * 2 - 1] = x0
      out[i * 2] = y0
    end
    return out
  end

  local out = {}
  for i = 1, targetN do
    local t = (i - 1) / max(1, targetN - 1)
    local x, y = SVGAnim.sampleAt(coords, cumDist, n, t)
    out[i * 2 - 1] = x
    out[i * 2] = y
  end
  return out
end

-- ============================================================================
-- Vertex interpolation (for morph)
-- ============================================================================

--- Element-wise lerp on two flat vertex arrays of the same length.
--- @param a table  Flat coords {x1,y1,...}
--- @param b table  Flat coords {x1,y1,...}
--- @param t number  Interpolation factor [0,1]
--- @return table  Interpolated flat coords
function SVGAnim.lerpVertices(a, b, t)
  local len = min(#a, #b)
  local out = {}
  local oneMinusT = 1 - t
  for i = 1, len do
    out[i] = a[i] * oneMinusT + b[i] * t
  end
  return out
end

-- ============================================================================
-- Color interpolation
-- ============================================================================

--- Lerp between two RGBA color tables.
--- @param a table  {r,g,b,a} or nil
--- @param b table  {r,g,b,a} or nil
--- @param t number  [0,1]
--- @return table  {r,g,b,a}
function SVGAnim.lerpColor(a, b, t)
  if not a and not b then return nil end
  if not a then return b end
  if not b then return a end
  local oneMinusT = 1 - t
  return {
    a[1] * oneMinusT + b[1] * t,
    a[2] * oneMinusT + b[2] * t,
    a[3] * oneMinusT + b[3] * t,
    (a[4] or 1) * oneMinusT + (b[4] or 1) * t,
  }
end

-- ============================================================================
-- Subpath matching (for morph between two SVG docs)
-- ============================================================================

--- Compute centroid of a flat vertex array.
local function centroid(coords)
  local n = #coords / 2
  if n < 1 then return 0, 0 end
  local sx, sy = 0, 0
  for i = 1, n do
    sx = sx + coords[i * 2 - 1]
    sy = sy + coords[i * 2]
  end
  return sx / n, sy / n
end

--- Create a degenerate single-point polyline at (cx, cy) with N vertices.
local function pointCloud(cx, cy, n)
  local out = {}
  for i = 1, n do
    out[i * 2 - 1] = cx
    out[i * 2] = cy
  end
  return out
end

--- Match elements from two SVG docs for morphing.
--- Pairs elements by index. If counts differ, extras collapse to partner's centroid.
--- All subpath pairs are resampled to the same vertex count.
--- @param docA table  Parsed SVG document
--- @param docB table  Parsed SVG document
--- @return table  Array of { vertsA, vertsB, closedA, closedB, fillA, fillB, strokeA, strokeB }
function SVGAnim.matchSubpaths(docA, docB)
  local elemsA = docA.elements or {}
  local elemsB = docB.elements or {}
  local count = max(#elemsA, #elemsB)
  local pairs = {}

  for i = 1, count do
    local ea = elemsA[i]
    local eb = elemsB[i]

    -- Get first subpath from each (or nil)
    local spA = ea and ea.subpaths and ea.subpaths[1]
    local spB = eb and eb.subpaths and eb.subpaths[1]

    if spA and spB then
      local nA = #spA / 2
      local nB = #spB / 2
      local targetN = max(nA, nB)

      local vA, vB = spA, spB
      if nA ~= targetN then
        local cd, tl, n = SVGAnim.polylineCumDist(spA)
        vA = SVGAnim.resamplePolyline(spA, cd, n, tl, targetN)
      end
      if nB ~= targetN then
        local cd, tl, n = SVGAnim.polylineCumDist(spB)
        vB = SVGAnim.resamplePolyline(spB, cd, n, tl, targetN)
      end

      pairs[#pairs + 1] = {
        vertsA = vA,
        vertsB = vB,
        closedA = ea.closed and ea.closed[1] or false,
        closedB = eb.closed and eb.closed[1] or false,
        fillA = ea.fill,
        fillB = eb.fill,
        strokeA = ea.stroke,
        strokeB = eb.stroke,
        strokeWidthA = ea.strokeWidth or 1,
        strokeWidthB = eb.strokeWidth or 1,
      }
    elseif spA then
      -- B is missing: collapse to A's centroid
      local nA = #spA / 2
      local cx, cy = centroid(spA)
      pairs[#pairs + 1] = {
        vertsA = spA,
        vertsB = pointCloud(cx, cy, nA),
        closedA = ea.closed and ea.closed[1] or false,
        closedB = true,
        fillA = ea.fill,
        fillB = ea.fill,
        strokeA = ea.stroke,
        strokeB = ea.stroke,
        strokeWidthA = ea.strokeWidth or 1,
        strokeWidthB = ea.strokeWidth or 1,
      }
    elseif spB then
      -- A is missing: collapse from B's centroid
      local nB = #spB / 2
      local cx, cy = centroid(spB)
      pairs[#pairs + 1] = {
        vertsA = pointCloud(cx, cy, nB),
        vertsB = spB,
        closedA = true,
        closedB = eb.closed and eb.closed[1] or false,
        fillA = eb.fill,
        fillB = eb.fill,
        strokeA = eb.stroke,
        strokeB = eb.stroke,
        strokeWidthA = eb.strokeWidth or 1,
        strokeWidthB = eb.strokeWidth or 1,
      }
    end
  end

  return pairs
end

-- ============================================================================
-- Easing resolution
-- ============================================================================

--- Resolve an easing name and apply it to a raw t value.
--- @param name string  Easing function name (e.g. "easeInOut", "bounce")
--- @param t number  Raw progress [0,1]
--- @return number  Eased progress
function SVGAnim.resolveEasing(name, t)
  local fn = Animate.easing[name] or Animate.easing.easeInOut
  if type(fn) == "function" then
    return fn(t)
  end
  return t
end

return SVGAnim
