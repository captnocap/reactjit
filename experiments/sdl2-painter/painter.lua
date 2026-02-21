--[[
  painter.lua -- SDL2/OpenGL painter (mirrors lua/painter.lua interface)

  Walks the same node tree that the ReactJIT reconciler produces and
  issues OpenGL draw calls instead of love.graphics calls. This is the
  proof-of-concept for dropping Love2D as a dependency.

  Supported node types: View/box, Text/__TEXT__
  Supported style props: backgroundColor, borderRadius, borderWidth,
    borderColor, opacity, color, fontSize, overflow (scissor + stencil),
    backgroundGradient, shadowColor/Blur/OffsetX/OffsetY, transform
    (translate/rotate/scale), scrollState.
]]

local GL   = require("gl")
local Font = require("font")

local W, H = 1280, 720  -- set by init()

local Painter = {}

-- ============================================================================
-- Color parsing
-- ============================================================================

-- Current draw color (r, g, b, a) — mirrors love.graphics.getColor()
local cr, cg, cb, ca = 1, 1, 1, 1

local function hexByte(s, i) return tonumber(s:sub(i, i+1), 16) / 255 end

local NAMED = {
  white   = {1,1,1,1}, black = {0,0,0,1}, red   = {1,0,0,1},
  green   = {0,1,0,1}, blue  = {0,0,1,1}, gray  = {.5,.5,.5,1},
  transparent = {0,0,0,0},
}

local function parseColor(c)
  if not c then return 1, 1, 1, 1 end
  if type(c) == "table" then
    return (c[1] or 1), (c[2] or 1), (c[3] or 1), (c[4] or 1)
  end
  if type(c) == "string" then
    if c:sub(1,1) == "#" then
      local s = c:sub(2)
      if #s == 3 then
        local r = tonumber(s:sub(1,1), 16) / 15
        local g = tonumber(s:sub(2,2), 16) / 15
        local b = tonumber(s:sub(3,3), 16) / 15
        return r, g, b, 1
      elseif #s == 6 then
        return hexByte(s,1), hexByte(s,3), hexByte(s,5), 1
      elseif #s == 8 then
        return hexByte(s,1), hexByte(s,3), hexByte(s,5), hexByte(s,7)
      end
    end
    local named = NAMED[c:lower()]
    if named then return named[1], named[2], named[3], named[4] end
  end
  return 1, 1, 1, 1
end

function Painter.setColor(color)
  cr, cg, cb, ca = parseColor(color)
  GL.glColor4f(cr, cg, cb, ca)
end

function Painter.applyOpacity(op)
  if op >= 1 then return end
  ca = ca * op
  GL.glColor4f(cr, cg, cb, ca)
end

-- ============================================================================
-- Geometry helpers
-- ============================================================================

local function filledRect(x, y, w, h)
  GL.glBegin(GL.TRIANGLE_STRIP)
    GL.glVertex2f(x,     y)
    GL.glVertex2f(x + w, y)
    GL.glVertex2f(x,     y + h)
    GL.glVertex2f(x + w, y + h)
  GL.glEnd()
end

local function strokedRect(x, y, w, h, lw)
  GL.glLineWidth(lw or 1)
  GL.glBegin(GL.LINE_LOOP)
    GL.glVertex2f(x,     y)
    GL.glVertex2f(x + w, y)
    GL.glVertex2f(x + w, y + h)
    GL.glVertex2f(x,     y + h)
  GL.glEnd()
  GL.glLineWidth(1)
end

-- Generate polygon vertices for a rounded rectangle (all corners uniform).
local function roundedPoly(x, y, w, h, r)
  local maxR = math.min(w, h) / 2
  r = math.min(r, maxR)
  if r <= 0 then
    return { x, y,  x+w, y,  x+w, y+h,  x, y+h }
  end
  local segs = 10
  local verts = {}
  local function arc(cx, cy, startA, endA)
    for i = 0, segs do
      local a = startA + (endA - startA) * i / segs
      verts[#verts+1] = cx + math.cos(a) * r
      verts[#verts+1] = cy + math.sin(a) * r
    end
  end
  local pi = math.pi
  arc(x + r,     y + r,     pi,       pi*1.5)   -- top-left
  arc(x + w - r, y + r,     pi*1.5,   pi*2)     -- top-right
  arc(x + w - r, y + h - r, 0,        pi*0.5)   -- bottom-right
  arc(x + r,     y + h - r, pi*0.5,   pi)       -- bottom-left
  return verts
end

local function filledRoundedRect(x, y, w, h, r)
  if r <= 0 then
    filledRect(x, y, w, h)
    return
  end
  local v = roundedPoly(x, y, w, h, r)
  GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(x + w/2, y + h/2)  -- center
    for i = 1, #v, 2 do
      GL.glVertex2f(v[i], v[i+1])
    end
    GL.glVertex2f(v[1], v[2])  -- close
  GL.glEnd()
end

local function strokedRoundedRect(x, y, w, h, r, lw)
  GL.glLineWidth(lw or 1)
  if r <= 0 then
    strokedRect(x, y, w, h, lw)
    GL.glLineWidth(1)
    return
  end
  local v = roundedPoly(x, y, w, h, r)
  GL.glBegin(GL.LINE_LOOP)
    for i = 1, #v, 2 do GL.glVertex2f(v[i], v[i+1]) end
  GL.glEnd()
  GL.glLineWidth(1)
end

-- ============================================================================
-- Gradient
-- ============================================================================

local function drawGradient(x, y, w, h, direction, color1, color2, opacity)
  local r1, g1, b1, a1 = parseColor(color1); a1 = a1 * opacity
  local r2, g2, b2, a2 = parseColor(color2); a2 = a2 * opacity

  if direction == "horizontal" then
    GL.glBegin(GL.TRIANGLE_STRIP)
      GL.glColor4f(r1, g1, b1, a1); GL.glVertex2f(x,     y)
      GL.glColor4f(r2, g2, b2, a2); GL.glVertex2f(x + w, y)
      GL.glColor4f(r1, g1, b1, a1); GL.glVertex2f(x,     y + h)
      GL.glColor4f(r2, g2, b2, a2); GL.glVertex2f(x + w, y + h)
    GL.glEnd()
  else -- vertical (default)
    GL.glBegin(GL.TRIANGLE_STRIP)
      GL.glColor4f(r1, g1, b1, a1); GL.glVertex2f(x,     y)
      GL.glColor4f(r1, g1, b1, a1); GL.glVertex2f(x + w, y)
      GL.glColor4f(r2, g2, b2, a2); GL.glVertex2f(x,     y + h)
      GL.glColor4f(r2, g2, b2, a2); GL.glVertex2f(x + w, y + h)
    GL.glEnd()
  end
end

-- ============================================================================
-- Box shadow
-- ============================================================================

local function drawBoxShadow(x, y, w, h, r, shadowColor, ox, oy, blur, opacity)
  if not shadowColor or blur <= 0 then return end
  local sr, sg, sb, sa = parseColor(shadowColor)
  local steps = math.min(math.ceil(blur), 10)
  for i = steps, 1, -1 do
    local expand = i
    local alpha  = (sa * opacity / steps) * (steps - i + 1)
    GL.glColor4f(sr, sg, sb, alpha)
    filledRoundedRect(x + ox - expand, y + oy - expand,
                      w + expand*2, h + expand*2, r + expand)
  end
end

-- ============================================================================
-- Scissor (OpenGL y-flip: y=0 is bottom of window)
-- ============================================================================

-- scissorStack holds { x, y, w, h } in screen coords (already y-flipped)
local scissorStack = {}

local function pushScissor(x, y, w, h)
  -- Convert from top-left coords to GL bottom-left coords
  local sy = H - (y + h)
  local sw, sh = math.max(0, w), math.max(0, h)

  -- Intersect with current scissor if one is active
  if #scissorStack > 0 then
    local prev = scissorStack[#scissorStack]
    local nx = math.max(prev.x, x)
    local ny = math.max(prev.y, y)          -- top-left coords
    local nx2 = math.min(prev.x + prev.w, x + w)
    local ny2 = math.min(prev.y + prev.h, y + h)
    w  = math.max(0, nx2 - nx)
    h  = math.max(0, ny2 - ny)
    x, y = nx, ny
    sy = H - (y + h)
    sw, sh = w, h
  end

  table.insert(scissorStack, { x = x, y = y, w = w, h = h })
  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(x, sy, sw, sh)
end

local function popScissor()
  table.remove(scissorStack)
  if #scissorStack > 0 then
    local prev = scissorStack[#scissorStack]
    local sy = H - (prev.y + prev.h)
    GL.glScissor(prev.x, sy, prev.w, prev.h)
  else
    GL.glDisable(GL.SCISSOR_TEST)
  end
end

-- ============================================================================
-- Stencil clipping
-- ============================================================================

local function writeStencil(value, drawFn)
  GL.glEnable(GL.STENCIL_TEST)
  GL.glStencilFunc(GL.ALWAYS, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.REPLACE)
  GL.glColorMask(GL.FALSE, GL.FALSE, GL.FALSE, GL.FALSE)
  GL.glDepthMask(GL.FALSE)
  drawFn()
  GL.glColorMask(GL.TRUE, GL.TRUE, GL.TRUE, GL.TRUE)
  GL.glDepthMask(GL.TRUE)
end

local function setStencilTest(value)
  -- Allow drawing only where stencil > value
  GL.glStencilFunc(GL.GREATER, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.KEEP)
end

local function clearStencilTest()
  GL.glDisable(GL.STENCIL_TEST)
end

-- ============================================================================
-- Transform stack (GL matrix stack)
-- ============================================================================

local function applyTransform(transform, c)
  if not transform then return false end
  local hasTx = transform.translateX or transform.translateY or
                transform.rotate or transform.scaleX or transform.scaleY
  if not hasTx then return false end

  GL.glPushMatrix()

  local ox = c.x + (transform.originX or 0.5) * c.w
  local oy = c.y + (transform.originY or 0.5) * c.h
  GL.glTranslatef(ox, oy, 0)
  if transform.rotate    then GL.glRotatef(transform.rotate, 0, 0, 1) end
  if transform.scaleX or transform.scaleY then
    GL.glScalef(transform.scaleX or 1, transform.scaleY or 1, 1)
  end
  GL.glTranslatef(-ox, -oy, 0)
  if transform.translateX or transform.translateY then
    GL.glTranslatef(transform.translateX or 0, transform.translateY or 0, 0)
  end

  return true
end

-- ============================================================================
-- Text rendering helpers
-- ============================================================================

local function drawText(text, x, y, w, align, size, color, opacity)
  local r, g, b, a = parseColor(color)
  a = a * opacity
  local textW = Font.measureWidth(text, size)
  local drawX = x
  if     align == "center" then drawX = x + (w - textW) / 2
  elseif align == "right"  then drawX = x + w - textW
  end
  Font.draw(text, drawX, y, size, r, g, b, a)
end

-- Wrap text into lines fitting within maxWidth.
local function wrapText(text, size, maxWidth)
  local lines = {}
  local paragraphs = {}
  for raw in text:gmatch("[^\n]+") do paragraphs[#paragraphs+1] = raw end
  if #paragraphs == 0 then paragraphs[1] = text end
  for _, raw in ipairs(paragraphs) do
    -- simple word-wrap
    local words = {}
    for w in raw:gmatch("%S+") do words[#words+1] = w end
    local line = ""
    for _, word in ipairs(words) do
      local candidate = line == "" and word or (line .. " " .. word)
      if Font.measureWidth(candidate, size) <= maxWidth then
        line = candidate
      else
        if line ~= "" then lines[#lines+1] = line end
        line = word
      end
    end
    if line ~= "" then lines[#lines+1] = line end
  end
  if #lines == 0 then lines[1] = "" end
  return lines
end

-- ============================================================================
-- Main node painter
-- ============================================================================

function Painter.paintNode(node, inheritedOpacity, stencilDepth)
  if not node or not node.computed then return end

  inheritedOpacity = inheritedOpacity or 1
  stencilDepth     = stencilDepth or 0

  local c = node.computed
  local s = node.style or {}

  if s.display == "none" then return end
  local isHidden = s.visibility == "hidden"

  local nodeOpacity      = s.opacity or 1
  local effectiveOpacity = nodeOpacity * inheritedOpacity
  if effectiveOpacity <= 0 then return end

  local didTransform = applyTransform(s.transform, c)

  local borderRadius = s.borderRadius or 0
  local isScroll     = s.overflow == "scroll"
  local needsClip    = s.overflow == "hidden" or isScroll
  local useStencil   = needsClip and borderRadius > 0
  local useScissor   = needsClip and borderRadius == 0

  local prevStencilDepth = stencilDepth

  -- Stencil clip setup
  if useStencil then
    local sv = stencilDepth + 1
    writeStencil(sv, function()
      filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
    end)
    setStencilTest(stencilDepth)
    stencilDepth = sv
  elseif useScissor then
    pushScissor(c.x, c.y, c.w, c.h)
  end

  -- ---- View / box ----
  if not isHidden and (node.type == "View" or node.type == "box") then

    -- Box shadow
    if s.shadowColor and (s.shadowBlur or 0) > 0 then
      drawBoxShadow(c.x, c.y, c.w, c.h, borderRadius,
                    s.shadowColor, s.shadowOffsetX or 0, s.shadowOffsetY or 0,
                    s.shadowBlur, effectiveOpacity)
    end

    -- Background
    if s.backgroundGradient then
      local grad = s.backgroundGradient
      drawGradient(c.x, c.y, c.w, c.h,
                   grad.direction or "vertical",
                   grad.colors[1], grad.colors[2], effectiveOpacity)
    elseif s.backgroundColor and s.backgroundColor ~= "transparent" then
      Painter.setColor(s.backgroundColor)
      Painter.applyOpacity(effectiveOpacity)
      filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
    end

    -- Border
    local bw = s.borderWidth or 0
    if bw > 0 then
      Painter.setColor(s.borderColor or {0.5, 0.5, 0.5, 1})
      Painter.applyOpacity(effectiveOpacity)
      strokedRoundedRect(c.x, c.y, c.w, c.h, borderRadius, bw)
    end

  -- ---- Text / __TEXT__ ----
  elseif not isHidden and (node.type == "Text" or node.type == "__TEXT__") then
    local ps = (node.type == "__TEXT__" and node.parent and node.parent.style) or {}
    local fontSize = s.fontSize or ps.fontSize or 14
    local color    = s.color    or ps.color    or {1, 1, 1, 1}
    local align    = s.textAlign or ps.textAlign or "left"
    local text     = node.text or (node.props and node.props.children) or ""
    if type(text) == "table" then text = table.concat(text) end
    text = tostring(text)

    -- Wrap if there's a bounded width
    if c.w > 0 then
      local lines  = wrapText(text, fontSize, c.w)
      local lh     = Font.lineHeight(fontSize)
      for i, line in ipairs(lines) do
        local ly = c.y + (i - 1) * lh
        drawText(line, c.x, ly, c.w, align, fontSize, color, effectiveOpacity)
      end
    else
      drawText(text, c.x, c.y, 99999, align, fontSize, color, effectiveOpacity)
    end
  end

  -- ---- Children ----
  local children = node.children or {}

  -- Scroll transform
  local scrollX, scrollY = 0, 0
  if isScroll and node.scrollState then
    scrollX = node.scrollState.scrollX or 0
    scrollY = node.scrollState.scrollY or 0
  end

  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    GL.glPushMatrix()
    GL.glTranslatef(-scrollX, -scrollY, 0)
  end

  for _, child in ipairs(children) do
    Painter.paintNode(child, effectiveOpacity, stencilDepth)
  end

  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    GL.glPopMatrix()
  end

  -- Restore clipping
  if useStencil then
    if prevStencilDepth > 0 then
      setStencilTest(prevStencilDepth - 1)
    else
      clearStencilTest()
    end
  elseif useScissor then
    popScissor()
  end

  if didTransform then
    GL.glPopMatrix()
  end
end

function Painter.paint(node)
  if not node then return end
  Painter.paintNode(node)
  GL.glColor4f(1, 1, 1, 1)
end

-- Called by main.lua to inject screen dimensions
function Painter.init(config)
  W = config.width  or 1280
  H = config.height or 720
end

return Painter
