--[[
  svg.lua — SVG parser and renderer for Love2D.

  Parses SVG files into pre-computed geometry, renders with love.graphics.
  Supports: path (all commands including arcs), rect, circle, ellipse,
  polygon, polyline, line, g (groups with transforms). Fills via
  love.math.triangulate for concave polygons.

  Usage:
    local svg = require("lua.svg")
    local doc = svg.parse(svgString)
    -- or: local doc = svg.load("path/to/file.svg")
    svg.draw(doc, x, y, scale)
    svg.draw(doc, x, y, scale, {
      ["button-a"] = {0.2, 0.4, 0.9, 1.0},  -- override fill by element id
    })
    local w, h = svg.getSize(doc, scale)
]]

local SVG = {}

local Color = require("lua.color")

local math_abs = math.abs
local math_sqrt = math.sqrt
local math_cos = math.cos
local math_sin = math.sin
local math_atan2 = math.atan2
local math_pi = math.pi
local math_min = math.min
local math_max = math.max

-- ============================================================================
-- Minimal XML Parser
-- ============================================================================

local SKIP_TAGS = {
  text = true, style = true, defs = true, ["use"] = true,
  clipPath = true, mask = true, filter = true, linearGradient = true,
  radialGradient = true, pattern = true, symbol = true, script = true,
}

local function parseAttrs(attrStr)
  local attrs = {}
  for k, v in attrStr:gmatch('([%w_%-:]+)%s*=%s*"([^"]*)"') do
    attrs[k] = v
  end
  -- Also handle single-quoted attributes
  for k, v in attrStr:gmatch("([%w_%-:]+)%s*=%s*'([^']*)'") do
    attrs[k] = v
  end
  return attrs
end

local function parseXML(str)
  local nodes = {}
  local stack = { { children = nodes } }
  local pos = 1

  while pos <= #str do
    -- Skip whitespace and text content
    local _, nextTag = str:find("<", pos)
    if not nextTag then break end
    pos = nextTag

    -- Skip comments
    if str:sub(pos, pos + 3) == "<!--" then
      local _, commentEnd = str:find("-->", pos + 4, true)
      pos = (commentEnd or #str) + 1
    -- Skip processing instructions and doctype
    elseif str:sub(pos, pos + 1) == "<?" or str:sub(pos, pos + 1) == "<!" then
      local _, declEnd = str:find(">", pos + 2)
      pos = (declEnd or #str) + 1
    -- Closing tag
    elseif str:sub(pos, pos + 1) == "</" then
      local _, closeEnd = str:find(">", pos + 2)
      if #stack > 1 then
        table.remove(stack)
      end
      pos = (closeEnd or #str) + 1
    -- Opening tag
    else
      local tagMatch = str:match("^<([%w_%-:]+)(.-)(/?)>", pos)
      if tagMatch then
        local tag = tagMatch
        local rest = str:match("^<[%w_%-:]+(.-)(/?)>", pos)
        local selfClose = str:match("^<[%w_%-:]+.-(/?)>", pos)
        local fullMatch = str:match("^(<[%w_%-:]+.-/?>)", pos)
        if not fullMatch then
          local _, tagEnd = str:find(">", pos)
          pos = (tagEnd or #str) + 1
        else
          -- Re-parse properly
          local t, attrStr, sc = str:match("^<([%w_%-:]+)(.-)(/?)>", pos)
          local attrs = parseAttrs(attrStr or "")
          local isSelfClosing = (sc == "/") or (attrStr and attrStr:sub(-1) == "/")

          if isSelfClosing then
            -- Clean trailing / from last attr value if needed
            if not SKIP_TAGS[t] then
              local node = { tag = t, attrs = attrs, children = {} }
              local parent = stack[#stack]
              parent.children[#parent.children + 1] = node
            end
          else
            if SKIP_TAGS[t] then
              -- Skip entire element including children
              local closePattern = "</" .. t .. "%s*>"
              local _, skipEnd = str:find(closePattern, pos)
              pos = (skipEnd or #str) + 1
              goto continue
            else
              local node = { tag = t, attrs = attrs, children = {} }
              local parent = stack[#stack]
              parent.children[#parent.children + 1] = node
              stack[#stack + 1] = node
            end
          end

          local _, tagEnd = str:find(">", pos)
          pos = (tagEnd or #str) + 1
        end
      else
        pos = pos + 1
      end
    end
    ::continue::
  end

  return nodes
end

-- ============================================================================
-- Color Parsing (delegates to lua/color.lua)
-- ============================================================================

local function parseColor(val)
  if not val or val == "none" or val == "" then return nil end
  local r, g, b, a = Color.parse(val)
  if r then return { r, g, b, a } end
  return nil
end

-- ============================================================================
-- Transform Parsing
-- ============================================================================

local IDENTITY = { 1, 0, 0, 1, 0, 0 }

local function matMul(a, b)
  return {
    a[1]*b[1] + a[3]*b[2],        a[2]*b[1] + a[4]*b[2],
    a[1]*b[3] + a[3]*b[4],        a[2]*b[3] + a[4]*b[4],
    a[1]*b[5] + a[3]*b[6] + a[5], a[2]*b[5] + a[4]*b[6] + a[6],
  }
end

local function transformPoint(m, x, y)
  return m[1]*x + m[3]*y + m[5], m[2]*x + m[4]*y + m[6]
end

local function parseTransform(str)
  if not str or str == "" then return IDENTITY end

  local mat = { 1, 0, 0, 1, 0, 0 }

  -- Extract each transform function
  for func, args in str:gmatch("(%w+)%s*%(([^)]*)%)") do
    local nums = {}
    for n in args:gmatch("[+-]?%d*%.?%d+") do
      nums[#nums + 1] = tonumber(n)
    end

    local t
    if func == "translate" then
      local tx = nums[1] or 0
      local ty = nums[2] or 0
      t = { 1, 0, 0, 1, tx, ty }
    elseif func == "scale" then
      local sx = nums[1] or 1
      local sy = nums[2] or sx
      t = { sx, 0, 0, sy, 0, 0 }
    elseif func == "rotate" then
      local deg = nums[1] or 0
      local cx = nums[2] or 0
      local cy = nums[3] or 0
      local rad = deg * math_pi / 180
      local c, s = math_cos(rad), math_sin(rad)
      if cx ~= 0 or cy ~= 0 then
        -- rotate around (cx, cy)
        t = { c, s, -s, c, cx - c*cx + s*cy, cy - s*cx - c*cy }
      else
        t = { c, s, -s, c, 0, 0 }
      end
    elseif func == "matrix" then
      t = { nums[1] or 1, nums[2] or 0, nums[3] or 0, nums[4] or 1, nums[5] or 0, nums[6] or 0 }
    elseif func == "skewX" then
      local rad = (nums[1] or 0) * math_pi / 180
      t = { 1, 0, math.tan(rad), 1, 0, 0 }
    elseif func == "skewY" then
      local rad = (nums[1] or 0) * math_pi / 180
      t = { 1, math.tan(rad), 0, 1, 0, 0 }
    end

    if t then
      mat = matMul(mat, t)
    end
  end

  return mat
end

-- ============================================================================
-- SVG Path Parser
-- ============================================================================

-- Tokenize a path 'd' attribute into commands and numbers
local function tokenizePath(d)
  local tokens = {}
  local pos = 1
  local len = #d

  while pos <= len do
    -- Skip whitespace and commas
    local ws = d:match("^[%s,]+", pos)
    if ws then pos = pos + #ws end
    if pos > len then break end

    local ch = d:byte(pos)

    -- Command letter
    if (ch >= 65 and ch <= 90) or (ch >= 97 and ch <= 122) then
      tokens[#tokens + 1] = d:sub(pos, pos)
      pos = pos + 1
    else
      -- Number (possibly with sign, decimal, exponent)
      local num = d:match("^[+-]?%d*%.?%d+[eE][+-]?%d+", pos)
        or d:match("^[+-]?%d*%.?%d+", pos)
        or d:match("^[+-]?%.%d+", pos)
      if num then
        tokens[#tokens + 1] = tonumber(num)
        pos = pos + #num
      else
        pos = pos + 1  -- skip unrecognized
      end
    end
  end

  return tokens
end

-- Flatten cubic bezier to polyline segments
local function flattenCubic(pts, x0, y0, x1, y1, x2, y2, x3, y3, tol)
  -- Check flatness: distance of control points from line p0→p3
  local dx = x3 - x0
  local dy = y3 - y0
  local d2 = math_abs((x1 - x3) * dy - (y1 - y3) * dx)
  local d3 = math_abs((x2 - x3) * dy - (y2 - y3) * dx)

  local denom = dx * dx + dy * dy
  if denom < 0.001 then denom = 0.001 end

  if (d2 + d3) * (d2 + d3) <= tol * tol * denom then
    pts[#pts + 1] = x3
    pts[#pts + 1] = y3
    return
  end

  -- Subdivide at midpoint (de Casteljau)
  local x01 = (x0 + x1) * 0.5
  local y01 = (y0 + y1) * 0.5
  local x12 = (x1 + x2) * 0.5
  local y12 = (y1 + y2) * 0.5
  local x23 = (x2 + x3) * 0.5
  local y23 = (y2 + y3) * 0.5
  local x012 = (x01 + x12) * 0.5
  local y012 = (y01 + y12) * 0.5
  local x123 = (x12 + x23) * 0.5
  local y123 = (y12 + y23) * 0.5
  local x0123 = (x012 + x123) * 0.5
  local y0123 = (y012 + y123) * 0.5

  flattenCubic(pts, x0, y0, x01, y01, x012, y012, x0123, y0123, tol)
  flattenCubic(pts, x0123, y0123, x123, y123, x23, y23, x3, y3, tol)
end

-- Flatten quadratic bezier by elevating to cubic
local function flattenQuadratic(pts, x0, y0, x1, y1, x2, y2, tol)
  -- Elevate to cubic: CP1 = P0 + 2/3*(P1-P0), CP2 = P2 + 2/3*(P1-P2)
  local cx1 = x0 + (2/3) * (x1 - x0)
  local cy1 = y0 + (2/3) * (y1 - y0)
  local cx2 = x2 + (2/3) * (x1 - x2)
  local cy2 = y2 + (2/3) * (y1 - y2)
  flattenCubic(pts, x0, y0, cx1, cy1, cx2, cy2, x2, y2, tol)
end

-- Convert SVG arc endpoint parameterization to center parameterization
-- then approximate with cubic beziers. Based on SVG spec F.6.5/F.6.6
local function arcToBeziers(x1, y1, rx, ry, xRotDeg, largeArc, sweep, x2, y2)
  if (x1 == x2 and y1 == y2) then return {} end
  if rx == 0 or ry == 0 then return {{ x1, y1, x2, y2, x2, y2 }} end

  rx = math_abs(rx)
  ry = math_abs(ry)
  local phi = xRotDeg * math_pi / 180
  local cosPhi = math_cos(phi)
  local sinPhi = math_sin(phi)

  -- Step 1: Compute (x1', y1')
  local dx2 = (x1 - x2) / 2
  local dy2 = (y1 - y2) / 2
  local x1p = cosPhi * dx2 + sinPhi * dy2
  local y1p = -sinPhi * dx2 + cosPhi * dy2

  -- Step 2: Compute (cx', cy')
  local x1p2 = x1p * x1p
  local y1p2 = y1p * y1p
  local rx2 = rx * rx
  local ry2 = ry * ry

  -- Correct radii if too small
  local lambda = x1p2 / rx2 + y1p2 / ry2
  if lambda > 1 then
    local sqrtL = math_sqrt(lambda)
    rx = rx * sqrtL
    ry = ry * sqrtL
    rx2 = rx * rx
    ry2 = ry * ry
  end

  local num = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2
  local den = rx2 * y1p2 + ry2 * x1p2
  if den < 1e-10 then den = 1e-10 end
  local sq = math_max(0, num / den)
  sq = math_sqrt(sq)
  if largeArc == sweep then sq = -sq end

  local cxp = sq * rx * y1p / ry
  local cyp = -sq * ry * x1p / rx

  -- Step 3: Compute (cx, cy)
  local cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2
  local cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2

  -- Step 4: Compute angles
  local function angle(ux, uy, vx, vy)
    local dot = ux * vx + uy * vy
    local len = math_sqrt((ux*ux + uy*uy) * (vx*vx + vy*vy))
    if len < 1e-10 then return 0 end
    local c = dot / len
    c = math_max(-1, math_min(1, c))
    local a = math.acos(c)
    if ux * vy - uy * vx < 0 then a = -a end
    return a
  end

  local theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  local dtheta = angle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry
  )

  if sweep == 0 and dtheta > 0 then dtheta = dtheta - 2 * math_pi end
  if sweep == 1 and dtheta < 0 then dtheta = dtheta + 2 * math_pi end

  -- Split into segments of <= 90 degrees, approximate each with cubic bezier
  local nSegs = math.ceil(math_abs(dtheta) / (math_pi / 2))
  if nSegs < 1 then nSegs = 1 end
  local segAngle = dtheta / nSegs

  local beziers = {}
  local alpha = 4 * math.tan(segAngle / 4) / 3

  for i = 0, nSegs - 1 do
    local a1 = theta1 + i * segAngle
    local a2 = theta1 + (i + 1) * segAngle

    local cos1 = math_cos(a1)
    local sin1 = math_sin(a1)
    local cos2 = math_cos(a2)
    local sin2 = math_sin(a2)

    -- Points on unit circle, then scale by rx/ry, rotate, translate
    local function ep(cosA, sinA)
      local px = rx * cosA
      local py = ry * sinA
      return cosPhi * px - sinPhi * py + cx,
             sinPhi * px + cosPhi * py + cy
    end

    local function cp1(cosA, sinA)
      local px = rx * (cosA - alpha * sinA)
      local py = ry * (sinA + alpha * cosA)
      return cosPhi * px - sinPhi * py + cx,
             sinPhi * px + cosPhi * py + cy
    end

    local function cp2(cosA, sinA)
      local px = rx * (cosA + alpha * sinA)
      local py = ry * (sinA - alpha * cosA)
      return cosPhi * px - sinPhi * py + cx,
             sinPhi * px + cosPhi * py + cy
    end

    local c1x, c1y = cp1(cos1, sin1)
    local c2x, c2y = cp2(cos2, sin2)
    local ex, ey = ep(cos2, sin2)

    beziers[#beziers + 1] = { c1x, c1y, c2x, c2y, ex, ey }
  end

  return beziers
end

-- Parse a path 'd' attribute into subpaths (arrays of flat vertex coords)
local function parsePath(d, tol)
  tol = tol or 0.5
  local tokens = tokenizePath(d)
  local subpaths = {}
  local closedFlags = {}
  local pts = {}  -- current subpath: {x1, y1, x2, y2, ...}
  local cx, cy = 0, 0  -- current point
  local sx, sy = 0, 0  -- subpath start
  local lastCmd = ""
  local lastCPx, lastCPy = 0, 0  -- last control point for S/T
  local idx = 1

  local function num()
    local v = tokens[idx]
    if type(v) == "number" then
      idx = idx + 1
      return v
    end
    return nil
  end

  local function finishSubpath(closed)
    if #pts >= 4 then
      subpaths[#subpaths + 1] = pts
      closedFlags[#closedFlags + 1] = closed
    end
    pts = {}
  end

  while idx <= #tokens do
    local tok = tokens[idx]

    if type(tok) == "string" then
      lastCmd = tok
      idx = idx + 1
    else
      -- Implicit command: repeated coordinates continue the last command
      -- M becomes L after first pair, m becomes l
      if lastCmd == "M" then lastCmd = "L"
      elseif lastCmd == "m" then lastCmd = "l"
      end
    end

    local cmd = lastCmd

    if cmd == "M" then
      finishSubpath(false)
      cx = num() or 0
      cy = num() or 0
      sx, sy = cx, cy
      pts[1] = cx
      pts[2] = cy
      lastCmd = "L"  -- subsequent pairs are lineTo

    elseif cmd == "m" then
      finishSubpath(false)
      cx = cx + (num() or 0)
      cy = cy + (num() or 0)
      sx, sy = cx, cy
      pts[1] = cx
      pts[2] = cy
      lastCmd = "l"

    elseif cmd == "L" then
      cx = num() or cx
      cy = num() or cy
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "l" then
      cx = cx + (num() or 0)
      cy = cy + (num() or 0)
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "H" then
      cx = num() or cx
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "h" then
      cx = cx + (num() or 0)
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "V" then
      cy = num() or cy
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "v" then
      cy = cy + (num() or 0)
      pts[#pts + 1] = cx
      pts[#pts + 1] = cy

    elseif cmd == "C" then
      local x1 = num() or 0
      local y1 = num() or 0
      local x2 = num() or 0
      local y2 = num() or 0
      local x3 = num() or 0
      local y3 = num() or 0
      flattenCubic(pts, cx, cy, x1, y1, x2, y2, x3, y3, tol)
      lastCPx, lastCPy = x2, y2
      cx, cy = x3, y3

    elseif cmd == "c" then
      local x1 = cx + (num() or 0)
      local y1 = cy + (num() or 0)
      local x2 = cx + (num() or 0)
      local y2 = cy + (num() or 0)
      local x3 = cx + (num() or 0)
      local y3 = cy + (num() or 0)
      flattenCubic(pts, cx, cy, x1, y1, x2, y2, x3, y3, tol)
      lastCPx, lastCPy = x2, y2
      cx, cy = x3, y3

    elseif cmd == "S" then
      -- Smooth cubic: reflect last CP
      local rx = 2 * cx - lastCPx
      local ry = 2 * cy - lastCPy
      local x2 = num() or 0
      local y2 = num() or 0
      local x3 = num() or 0
      local y3 = num() or 0
      flattenCubic(pts, cx, cy, rx, ry, x2, y2, x3, y3, tol)
      lastCPx, lastCPy = x2, y2
      cx, cy = x3, y3

    elseif cmd == "s" then
      local rx = 2 * cx - lastCPx
      local ry = 2 * cy - lastCPy
      local x2 = cx + (num() or 0)
      local y2 = cy + (num() or 0)
      local x3 = cx + (num() or 0)
      local y3 = cy + (num() or 0)
      flattenCubic(pts, cx, cy, rx, ry, x2, y2, x3, y3, tol)
      lastCPx, lastCPy = x2, y2
      cx, cy = x3, y3

    elseif cmd == "Q" then
      local x1 = num() or 0
      local y1 = num() or 0
      local x2 = num() or 0
      local y2 = num() or 0
      flattenQuadratic(pts, cx, cy, x1, y1, x2, y2, tol)
      lastCPx, lastCPy = x1, y1
      cx, cy = x2, y2

    elseif cmd == "q" then
      local x1 = cx + (num() or 0)
      local y1 = cy + (num() or 0)
      local x2 = cx + (num() or 0)
      local y2 = cy + (num() or 0)
      flattenQuadratic(pts, cx, cy, x1, y1, x2, y2, tol)
      lastCPx, lastCPy = x1, y1
      cx, cy = x2, y2

    elseif cmd == "T" then
      local rx = 2 * cx - lastCPx
      local ry = 2 * cy - lastCPy
      local x2 = num() or 0
      local y2 = num() or 0
      flattenQuadratic(pts, cx, cy, rx, ry, x2, y2, tol)
      lastCPx, lastCPy = rx, ry
      cx, cy = x2, y2

    elseif cmd == "t" then
      local rx = 2 * cx - lastCPx
      local ry = 2 * cy - lastCPy
      local x2 = cx + (num() or 0)
      local y2 = cy + (num() or 0)
      flattenQuadratic(pts, cx, cy, rx, ry, x2, y2, tol)
      lastCPx, lastCPy = rx, ry
      cx, cy = x2, y2

    elseif cmd == "A" or cmd == "a" then
      local arx = num() or 0
      local ary = num() or 0
      local xRot = num() or 0
      local largeArc = (num() or 0) ~= 0 and 1 or 0
      local sweepFlag = (num() or 0) ~= 0 and 1 or 0
      local ex, ey
      if cmd == "A" then
        ex = num() or 0
        ey = num() or 0
      else
        ex = cx + (num() or 0)
        ey = cy + (num() or 0)
      end

      local beziers = arcToBeziers(cx, cy, arx, ary, xRot, largeArc, sweepFlag, ex, ey)
      for _, b in ipairs(beziers) do
        flattenCubic(pts, cx, cy, b[1], b[2], b[3], b[4], b[5], b[6], tol)
        cx, cy = b[5], b[6]
      end

    elseif cmd == "Z" or cmd == "z" then
      if #pts >= 2 then
        -- Close path back to start
        local lastX = pts[#pts - 1]
        local lastY = pts[#pts]
        if lastX ~= sx or lastY ~= sy then
          pts[#pts + 1] = sx
          pts[#pts + 1] = sy
        end
      end
      finishSubpath(true)
      cx, cy = sx, sy

    else
      -- Unknown command, skip
      idx = idx + 1
    end

    -- Reset lastCP for commands that don't set it
    if cmd ~= "C" and cmd ~= "c" and cmd ~= "S" and cmd ~= "s"
      and cmd ~= "Q" and cmd ~= "q" and cmd ~= "T" and cmd ~= "t" then
      lastCPx, lastCPy = cx, cy
    end
  end

  -- Finish any remaining open subpath
  finishSubpath(false)

  return subpaths, closedFlags
end

-- ============================================================================
-- SVG Element Compiler
-- ============================================================================

local function numAttr(attrs, name, default)
  return tonumber(attrs[name]) or default or 0
end

local function styleFromAttrs(attrs)
  local fill = attrs.fill
  local stroke = attrs.stroke

  -- Handle inline style attribute (basic: just split on ; and parse key:value)
  if attrs.style then
    for prop, val in attrs.style:gmatch("([%w%-]+)%s*:%s*([^;]+)") do
      prop = prop:match("^%s*(.-)%s*$")
      val = val:match("^%s*(.-)%s*$")
      if prop == "fill" then fill = val
      elseif prop == "stroke" then stroke = val
      elseif prop == "stroke-width" then attrs["stroke-width"] = val
      elseif prop == "opacity" then attrs.opacity = val
      elseif prop == "fill-opacity" then attrs["fill-opacity"] = val
      elseif prop == "stroke-opacity" then attrs["stroke-opacity"] = val
      end
    end
  end

  -- Default fill is black if not specified (SVG default)
  if fill == nil and stroke == nil then
    fill = "#000000"
  end

  return {
    fill = parseColor(fill),
    stroke = parseColor(stroke),
    strokeWidth = tonumber(attrs["stroke-width"]) or 1,
    opacity = tonumber(attrs.opacity) or 1,
    fillOpacity = tonumber(attrs["fill-opacity"]) or 1,
    strokeOpacity = tonumber(attrs["stroke-opacity"]) or 1,
  }
end

-- Apply transform matrix to all vertices in flat array
local function transformVertices(verts, mat)
  if mat == IDENTITY then return verts end
  local out = {}
  for i = 1, #verts, 2 do
    local x, y = transformPoint(mat, verts[i], verts[i + 1])
    out[#out + 1] = x
    out[#out + 1] = y
  end
  return out
end

-- Pre-triangulate closed subpaths for fill rendering
local function preTriangulate(subpath)
  if #subpath < 6 then return nil end
  local ok, triangles = pcall(love.math.triangulate, subpath)
  if ok and #triangles > 0 then return triangles end
  return nil
end

local function compileElement(node, parentMat, elements, tol)
  local tag = node.tag
  local attrs = node.attrs or {}
  local mat = parentMat

  -- Apply local transform
  if attrs.transform then
    mat = matMul(parentMat, parseTransform(attrs.transform))
  end

  -- Group: recurse into children
  if tag == "g" or tag == "svg" then
    for _, child in ipairs(node.children or {}) do
      compileElement(child, mat, elements, tol)
    end
    return
  end

  local style = styleFromAttrs(attrs)
  local id = attrs.id or nil

  local subpaths, closedFlags

  if tag == "path" then
    subpaths, closedFlags = parsePath(attrs.d or "", tol)

  elseif tag == "rect" then
    local x = numAttr(attrs, "x")
    local y = numAttr(attrs, "y")
    local w = numAttr(attrs, "width")
    local h = numAttr(attrs, "height")
    local rx = numAttr(attrs, "rx")
    local ry = numAttr(attrs, "ry")
    if rx == 0 and ry > 0 then rx = ry end
    if ry == 0 and rx > 0 then ry = rx end

    if rx > 0 and ry > 0 then
      -- Rounded rect as path
      rx = math_min(rx, w / 2)
      ry = math_min(ry, h / 2)
      local d = string.format(
        "M%f,%fh%fa%f,%f,0,0,1,%f,%fv%fa%f,%f,0,0,1,%f,%fh%fa%f,%f,0,0,1,%f,%fv%fa%f,%f,0,0,1,%f,%fZ",
        x + rx, y,
        w - 2*rx,
        rx, ry, rx, ry,
        h - 2*ry,
        rx, ry, -rx, ry,
        -(w - 2*rx),
        rx, ry, -rx, -ry,
        -(h - 2*ry),
        rx, ry, rx, -ry
      )
      subpaths, closedFlags = parsePath(d, tol)
    else
      subpaths = {{ x, y, x+w, y, x+w, y+h, x, y+h, x, y }}
      closedFlags = { true }
    end

  elseif tag == "circle" then
    local ccx = numAttr(attrs, "cx")
    local ccy = numAttr(attrs, "cy")
    local r = numAttr(attrs, "r")
    -- Approximate circle with 4 cubic bezier arcs
    local kappa = 0.5522847498  -- 4*(sqrt(2)-1)/3
    local kr = r * kappa
    local d = string.format(
      "M%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fZ",
      ccx, ccy - r,
      ccx + kr, ccy - r, ccx + r, ccy - kr, ccx + r, ccy,
      ccx + r, ccy + kr, ccx + kr, ccy + r, ccx, ccy + r,
      ccx - kr, ccy + r, ccx - r, ccy + kr, ccx - r, ccy,
      ccx - r, ccy - kr, ccx - kr, ccy - r, ccx, ccy - r
    )
    subpaths, closedFlags = parsePath(d, tol)

  elseif tag == "ellipse" then
    local ccx = numAttr(attrs, "cx")
    local ccy = numAttr(attrs, "cy")
    local erx = numAttr(attrs, "rx")
    local ery = numAttr(attrs, "ry")
    local kx = erx * 0.5522847498
    local ky = ery * 0.5522847498
    local d = string.format(
      "M%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fC%f,%f,%f,%f,%f,%fZ",
      ccx, ccy - ery,
      ccx + kx, ccy - ery, ccx + erx, ccy - ky, ccx + erx, ccy,
      ccx + erx, ccy + ky, ccx + kx, ccy + ery, ccx, ccy + ery,
      ccx - kx, ccy + ery, ccx - erx, ccy + ky, ccx - erx, ccy,
      ccx - erx, ccy - ky, ccx - kx, ccy - ery, ccx, ccy - ery
    )
    subpaths, closedFlags = parsePath(d, tol)

  elseif tag == "polygon" or tag == "polyline" then
    local pointsStr = attrs.points or ""
    local coords = {}
    for n in pointsStr:gmatch("[+-]?%d*%.?%d+") do
      coords[#coords + 1] = tonumber(n)
    end
    if tag == "polygon" and #coords >= 4 then
      -- Close it
      coords[#coords + 1] = coords[1]
      coords[#coords + 1] = coords[2]
    end
    subpaths = { coords }
    closedFlags = { tag == "polygon" }

  elseif tag == "line" then
    local lx1 = numAttr(attrs, "x1")
    local ly1 = numAttr(attrs, "y1")
    local lx2 = numAttr(attrs, "x2")
    local ly2 = numAttr(attrs, "y2")
    subpaths = {{ lx1, ly1, lx2, ly2 }}
    closedFlags = { false }

  else
    return  -- unsupported element
  end

  if not subpaths or #subpaths == 0 then return end

  -- Transform all vertices
  local transformedSubs = {}
  for i, sp in ipairs(subpaths) do
    transformedSubs[i] = transformVertices(sp, mat)
  end

  -- Pre-triangulate for fill
  local triangulations = {}
  for i, sp in ipairs(transformedSubs) do
    if closedFlags[i] then
      triangulations[i] = preTriangulate(sp)
    end
  end

  elements[#elements + 1] = {
    id = id,
    subpaths = transformedSubs,
    closed = closedFlags,
    triangles = triangulations,
    fill = style.fill,
    stroke = style.stroke,
    strokeWidth = style.strokeWidth,
    opacity = style.opacity,
    fillOpacity = style.fillOpacity,
    strokeOpacity = style.strokeOpacity,
  }
end

-- ============================================================================
-- Document Compiler
-- ============================================================================

local function compileDocument(xmlNodes, tol)
  -- Find the <svg> root
  local svgRoot
  for _, node in ipairs(xmlNodes) do
    if node.tag == "svg" then
      svgRoot = node
      break
    end
  end

  if not svgRoot then
    -- Maybe the nodes are direct children (no wrapper)
    svgRoot = { tag = "svg", attrs = {}, children = xmlNodes }
  end

  local attrs = svgRoot.attrs or {}
  local width = tonumber((attrs.width or ""):match("([%d%.]+)")) or 100
  local height = tonumber((attrs.height or ""):match("([%d%.]+)")) or 100

  -- Parse viewBox
  local vbX, vbY, vbW, vbH
  if attrs.viewBox then
    local parts = {}
    for n in attrs.viewBox:gmatch("[+-]?%d*%.?%d+") do
      parts[#parts + 1] = tonumber(n)
    end
    if #parts >= 4 then
      vbX, vbY, vbW, vbH = parts[1], parts[2], parts[3], parts[4]
    end
  end

  -- Compute viewBox transform
  local viewBoxTransform
  if vbW and vbH and vbW > 0 and vbH > 0 then
    viewBoxTransform = {
      tx = -vbX,
      ty = -vbY,
      sx = width / vbW,
      sy = height / vbH,
    }
    -- If no explicit width/height, use viewBox dimensions
    if not attrs.width then width = vbW end
    if not attrs.height then height = vbH end
  end

  -- Compile all elements
  local elements = {}
  local baseMat = IDENTITY

  -- Apply viewBox transform during compilation for pre-baked coordinates
  if viewBoxTransform then
    baseMat = {
      viewBoxTransform.sx, 0,
      0, viewBoxTransform.sy,
      -vbX * viewBoxTransform.sx, -vbY * viewBoxTransform.sy,
    }
  end

  -- Apply svg-level transform
  if attrs.transform then
    baseMat = matMul(baseMat, parseTransform(attrs.transform))
  end

  for _, child in ipairs(svgRoot.children or {}) do
    compileElement(child, baseMat, elements, tol or 0.5)
  end

  return {
    width = width,
    height = height,
    viewBox = viewBoxTransform and { vbX, vbY, vbW, vbH } or nil,
    elements = elements,
  }
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Parse an SVG string into a pre-computed document.
--- @param str string  SVG file contents
--- @param tol number?  Bezier flatness tolerance (default 0.5)
--- @return table  document object
function SVG.parse(str, tol)
  local xmlNodes = parseXML(str)
  return compileDocument(xmlNodes, tol)
end

--- Load an SVG file via love.filesystem and parse it.
--- @param path string  File path (relative to love.filesystem root)
--- @return table|nil  document object, or nil if file not found
function SVG.load(path, tol)
  local content = love.filesystem.read(path)
  if not content then
    -- Try absolute path via io
    local f = io.open(path, "r")
    if f then
      content = f:read("*a")
      f:close()
    end
  end
  if not content then return nil end
  return SVG.parse(content, tol)
end

--- Draw a parsed SVG document.
--- @param doc table  Parsed document from svg.parse() or svg.load()
--- @param x number  Draw position X
--- @param y number  Draw position Y
--- @param scale number?  Scale factor (default 1)
--- @param overrides table?  Color overrides by element id: { ["id"] = {r,g,b,a} }
function SVG.draw(doc, x, y, scale, overrides)
  if not doc then return end
  scale = scale or 1

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(scale, scale)

  for _, elem in ipairs(doc.elements) do
    local fill = elem.fill
    local stroke = elem.stroke
    local strokeWidth = elem.strokeWidth

    -- Color override by id
    if overrides and elem.id then
      local ov = overrides[elem.id]
      if ov then
        if type(ov) == "table" and ov.fill then
          fill = ov.fill
          stroke = ov.stroke or stroke
          strokeWidth = ov.strokeWidth or strokeWidth
        else
          fill = ov  -- simple color table
        end
      end
    end

    -- Fill closed subpaths
    if fill then
      local a = (fill[4] or 1) * elem.opacity * elem.fillOpacity
      love.graphics.setColor(fill[1], fill[2], fill[3], a)

      for i, sp in ipairs(elem.subpaths) do
        if elem.closed[i] and #sp >= 6 then
          local tris = elem.triangles[i]
          if tris then
            for _, tri in ipairs(tris) do
              love.graphics.polygon("fill", tri)
            end
          else
            -- Try direct polygon (works for convex)
            local ok = pcall(love.graphics.polygon, "fill", sp)
            if not ok then
              -- Try triangulating on the fly
              local tok, t = pcall(love.math.triangulate, sp)
              if tok then
                for _, tri in ipairs(t) do
                  love.graphics.polygon("fill", tri)
                end
              end
            end
          end
        end
      end
    end

    -- Stroke all subpaths
    if stroke then
      local a = (stroke[4] or 1) * elem.opacity * elem.strokeOpacity
      love.graphics.setColor(stroke[1], stroke[2], stroke[3], a)
      love.graphics.setLineWidth(strokeWidth * scale)
      love.graphics.setLineJoin("bevel")

      for _, sp in ipairs(elem.subpaths) do
        if #sp >= 4 then
          love.graphics.line(sp)
        end
      end
    end
  end

  love.graphics.pop()
end

--- Draw a single element from a parsed SVG document.
--- Useful for per-element animation where each element needs individual transforms.
--- @param elem table  Element from doc.elements[]
--- @param x number  Draw position X
--- @param y number  Draw position Y
--- @param scale number?  Scale factor (default 1)
--- @param fillOverride table?  Override fill color {r,g,b,a}
--- @param strokeOverride table?  Override stroke color {r,g,b,a}
--- @param opacityOverride number?  Override opacity
function SVG.drawElement(elem, x, y, scale, fillOverride, strokeOverride, opacityOverride)
  if not elem then return end
  scale = scale or 1

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(scale, scale)

  local fill = fillOverride or elem.fill
  local stroke = strokeOverride or elem.stroke
  local elemOpacity = opacityOverride or elem.opacity

  -- Fill closed subpaths
  if fill then
    local a = (fill[4] or 1) * elemOpacity * elem.fillOpacity
    love.graphics.setColor(fill[1], fill[2], fill[3], a)

    for i, sp in ipairs(elem.subpaths) do
      if elem.closed[i] and #sp >= 6 then
        local tris = elem.triangles[i]
        if tris then
          for _, tri in ipairs(tris) do
            love.graphics.polygon("fill", tri)
          end
        else
          local ok = pcall(love.graphics.polygon, "fill", sp)
          if not ok then
            local tok, t = pcall(love.math.triangulate, sp)
            if tok then
              for _, tri in ipairs(t) do
                love.graphics.polygon("fill", tri)
              end
            end
          end
        end
      end
    end
  end

  -- Stroke all subpaths
  if stroke then
    local a = (stroke[4] or 1) * elemOpacity * elem.strokeOpacity
    love.graphics.setColor(stroke[1], stroke[2], stroke[3], a)
    love.graphics.setLineWidth(elem.strokeWidth * scale)
    love.graphics.setLineJoin("bevel")

    for _, sp in ipairs(elem.subpaths) do
      if #sp >= 4 then
        love.graphics.line(sp)
      end
    end
  end

  love.graphics.pop()
end

--- Get the intrinsic size of a parsed SVG document.
--- @param doc table  Parsed document
--- @param scale number?  Scale factor (default 1)
--- @return number, number  width, height
function SVG.getSize(doc, scale)
  if not doc then return 0, 0 end
  scale = scale or 1
  return doc.width * scale, doc.height * scale
end

--- Get all element IDs in a parsed document (useful for discovering overrideable parts).
--- @param doc table  Parsed document
--- @return table  Array of id strings
function SVG.getIds(doc)
  if not doc then return {} end
  local ids = {}
  for _, elem in ipairs(doc.elements) do
    if elem.id then
      ids[#ids + 1] = elem.id
    end
  end
  return ids
end

return SVG
