--[[
  stroke_dash.lua — SVG-style stroke dash animations for Love2D

  Implements strokeDasharray and strokeDashoffset on any closed or open path.
  Converts rounded rectangle perimeters (and arbitrary polylines) into dashed
  line segments that love.graphics.line() can draw.

  Architecture:
    1. Build a polyline from the shape perimeter (rect, rounded rect, polygon)
    2. Compute cumulative distances along the polyline
    3. Walk the polyline with the dash pattern, emitting drawable segments
    4. Painter calls love.graphics.line() on each segment

  The dash pattern repeats infinitely. strokeDashoffset shifts where the
  pattern starts — animating it creates marching ants, draw-on reveals,
  spinners, etc. Both properties are animatable via style.transition and
  style.animation (visual-only, no relayout).
]]

local StrokeDash = {}

local PI = math.pi
local cos, sin, sqrt = math.cos, math.sin, math.sqrt
local floor, min, max = math.floor, math.min, math.max

-- Arc resolution: segments per quarter circle
local ARC_SEG = 12

-- ============================================================================
-- Path builders
-- ============================================================================

--- Build a closed polyline tracing a rounded rectangle perimeter.
--- Handles per-corner radii. Returns flat point array, cumulative distances,
--- total length, and point count.
--- @param x number Left
--- @param y number Top
--- @param w number Width
--- @param h number Height
--- @param tl number Top-left radius
--- @param tr number Top-right radius
--- @param br number Bottom-right radius
--- @param bl number Bottom-left radius
--- @return table pts Flat array {x1,y1,x2,y2,...}
--- @return table cumDist Cumulative distance at each point
--- @return number totalLen Total perimeter length
--- @return number n Number of points
function StrokeDash.rectPerimeter(x, y, w, h, tl, tr, br, bl)
  tl = tl or 0; tr = tr or 0; br = br or 0; bl = bl or 0
  local maxR = min(w, h) / 2
  tl = min(tl, maxR); tr = min(tr, maxR)
  br = min(br, maxR); bl = min(bl, maxR)

  local pts = {}
  local function add(px, py)
    pts[#pts + 1] = px
    pts[#pts + 1] = py
  end

  local function addArc(cx, cy, r, a1, a2)
    if r < 0.5 then
      add(cx, cy)
      return
    end
    for i = 0, ARC_SEG do
      local a = a1 + (a2 - a1) * i / ARC_SEG
      add(cx + r * cos(a), cy + r * sin(a))
    end
  end

  -- Trace perimeter clockwise starting from top-left corner
  -- Top-left corner arc (pi → 3pi/2)
  addArc(x + tl, y + tl, tl, PI, PI * 1.5)
  -- Top edge endpoint
  add(x + w - tr, y)
  -- Top-right corner arc (3pi/2 → 2pi)
  addArc(x + w - tr, y + tr, tr, PI * 1.5, PI * 2)
  -- Right edge endpoint
  add(x + w, y + h - br)
  -- Bottom-right corner arc (0 → pi/2)
  addArc(x + w - br, y + h - br, br, 0, PI * 0.5)
  -- Bottom edge endpoint
  add(x + bl, y + h)
  -- Bottom-left corner arc (pi/2 → pi)
  addArc(x + bl, y + h - bl, bl, PI * 0.5, PI)
  -- Left edge endpoint
  add(x, y + tl)

  -- Close the path back to start
  if #pts >= 4 then
    add(pts[1], pts[2])
  end

  -- Compute cumulative distances
  local n = #pts / 2
  local cumDist = {}
  cumDist[1] = 0
  local totalLen = 0
  for i = 2, n do
    local dx = pts[i * 2 - 1] - pts[(i - 1) * 2 - 1]
    local dy = pts[i * 2] - pts[(i - 1) * 2]
    totalLen = totalLen + sqrt(dx * dx + dy * dy)
    cumDist[i] = totalLen
  end

  return pts, cumDist, totalLen, n
end

--- Build a polyline from a flat coordinate array (for strokePaths).
--- @param coords table Flat array {x1,y1,x2,y2,...} already in screen space
--- @return table cumDist
--- @return number totalLen
--- @return number n
function StrokeDash.polylineMetrics(coords)
  local n = #coords / 2
  local cumDist = {}
  cumDist[1] = 0
  local totalLen = 0
  for i = 2, n do
    local dx = coords[i * 2 - 1] - coords[(i - 1) * 2 - 1]
    local dy = coords[i * 2] - coords[(i - 1) * 2]
    totalLen = totalLen + sqrt(dx * dx + dy * dy)
    cumDist[i] = totalLen
  end
  return cumDist, totalLen, n
end

-- ============================================================================
-- Point interpolation
-- ============================================================================

--- Find the (x, y) position at distance `d` along a polyline.
--- @param pts table Flat point array
--- @param cumDist table Cumulative distances
--- @param n number Point count
--- @param d number Distance along the path
--- @return number x
--- @return number y
local function pointAtDist(pts, cumDist, n, d)
  if d <= 0 then return pts[1], pts[2] end
  if d >= cumDist[n] then return pts[n * 2 - 1], pts[n * 2] end

  -- Binary search for the containing segment
  local lo, hi = 1, n
  while lo < hi - 1 do
    local mid = floor((lo + hi) / 2)
    if cumDist[mid] <= d then lo = mid else hi = mid end
  end

  local segLen = cumDist[hi] - cumDist[lo]
  if segLen < 1e-6 then return pts[lo * 2 - 1], pts[lo * 2] end
  local t = (d - cumDist[lo]) / segLen
  local x = pts[lo * 2 - 1] + t * (pts[hi * 2 - 1] - pts[lo * 2 - 1])
  local y = pts[lo * 2] + t * (pts[hi * 2] - pts[lo * 2])
  return x, y
end

-- ============================================================================
-- Dash generation
-- ============================================================================

--- Generate dashed line segments along a polyline.
---
--- @param pts table Flat point array {x1,y1,x2,y2,...}
--- @param cumDist table Cumulative distance at each point
--- @param totalLen number Total path length
--- @param n number Point count
--- @param dasharray table {dash, gap, dash, gap, ...}
--- @param dashoffset number Pattern offset (animatable)
--- @return table Array of flat coordinate arrays for love.graphics.line()
function StrokeDash.generateDashes(pts, cumDist, totalLen, n, dasharray, dashoffset)
  if n < 2 or totalLen < 1 then return {} end

  local patternLen = 0
  for _, v in ipairs(dasharray) do patternLen = patternLen + v end
  if patternLen < 1 then return {} end

  -- Normalize offset into [0, patternLen)
  local offset = (dashoffset or 0) % patternLen
  if offset < 0 then offset = offset + patternLen end

  -- Advance through the dash pattern by `offset` amount
  local patIdx = 1
  local isDash = true
  local remaining = dasharray[1]

  local toSkip = offset
  while toSkip > 1e-6 do
    if toSkip >= remaining then
      toSkip = toSkip - remaining
      patIdx = patIdx % #dasharray + 1
      remaining = dasharray[patIdx]
      isDash = not isDash
    else
      remaining = remaining - toSkip
      toSkip = 0
    end
  end

  -- Walk along the path, emitting dash segments
  local result = {}
  local pos = 0

  while pos < totalLen - 0.1 do
    local segLen = min(remaining, totalLen - pos)

    if isDash and segLen > 0.3 then
      -- Build a polyline for this dash by collecting:
      -- 1. Interpolated start point
      -- 2. Any original path points between start and end (preserves curves)
      -- 3. Interpolated end point
      local coords = {}
      local sx, sy = pointAtDist(pts, cumDist, n, pos)
      coords[1] = sx; coords[2] = sy

      local endDist = pos + segLen
      for i = 2, n - 1 do
        local d = cumDist[i]
        if d > pos + 0.1 and d < endDist - 0.1 then
          coords[#coords + 1] = pts[i * 2 - 1]
          coords[#coords + 1] = pts[i * 2]
        end
      end

      local ex, ey = pointAtDist(pts, cumDist, n, endDist)
      coords[#coords + 1] = ex; coords[#coords + 1] = ey

      if #coords >= 4 then
        result[#result + 1] = coords
      end
    end

    pos = pos + segLen
    remaining = remaining - segLen

    if remaining < 0.1 then
      patIdx = patIdx % #dasharray + 1
      remaining = dasharray[patIdx]
      isDash = not isDash
    end
  end

  return result
end

return StrokeDash
