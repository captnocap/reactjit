--[[
  sdl2_painter.lua -- SDL2/OpenGL painter (framework version)
  Mirrors the lua/painter.lua interface so target_sdl2.lua can drop it in.
  See experiments/sdl2-painter/painter.lua for the origin.
]]

local GL    = require("lua.sdl2_gl")
local Font  = require("lua.sdl2_font")
local Color = require("lua.color")
local ZIndex = require("lua.zindex")

local W, H = 1280, 720

local Painter = {}

-- Theme reference (set via Painter.setTheme())
local currentTheme = nil

--- Update the active theme reference. Called by init.lua on theme switch.
function Painter.setTheme(theme)
  currentTheme = theme
end

-- ============================================================================
-- Color
-- ============================================================================

local cr, cg, cb, ca = 1, 1, 1, 1

--- Parse a color using the shared Color module, falling back to white.
local function parseColor(c)
  local r, g, b, a = Color.parse(c)
  if r then return r, g, b, a end
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
-- Quad batcher: accumulates solid-color quads and flushes in one draw call.
-- Any operation that changes GL state must call flushQuads() first.
-- ============================================================================

local quadBuf = {}   -- flat array: x,y, x,y, x,y, x,y, r,g,b,a  (12 floats per quad)
local quadCount = 0

local function flushQuads()
  if quadCount == 0 then return end
  GL.glBegin(GL.QUADS)
  local idx = 1
  for _ = 1, quadCount do
    local qr, qg, qb, qa = quadBuf[idx+8], quadBuf[idx+9], quadBuf[idx+10], quadBuf[idx+11]
    GL.glColor4f(qr, qg, qb, qa)
    GL.glVertex2f(quadBuf[idx],   quadBuf[idx+1])
    GL.glVertex2f(quadBuf[idx+2], quadBuf[idx+3])
    GL.glVertex2f(quadBuf[idx+4], quadBuf[idx+5])
    GL.glVertex2f(quadBuf[idx+6], quadBuf[idx+7])
    idx = idx + 12
  end
  GL.glEnd()
  quadCount = 0
end

-- ============================================================================
-- Geometry
-- ============================================================================

local function filledRect(x,y,w,h)
  local idx = quadCount * 12 + 1
  quadBuf[idx]    = x;     quadBuf[idx+1]  = y
  quadBuf[idx+2]  = x+w;   quadBuf[idx+3]  = y
  quadBuf[idx+4]  = x+w;   quadBuf[idx+5]  = y+h
  quadBuf[idx+6]  = x;     quadBuf[idx+7]  = y+h
  quadBuf[idx+8]  = cr;    quadBuf[idx+9]  = cg
  quadBuf[idx+10] = cb;    quadBuf[idx+11] = ca
  quadCount = quadCount + 1
end

local function strokedRect(x,y,w,h,lw)
  flushQuads()
  GL.glLineWidth(lw or 1)
  GL.glBegin(GL.LINE_LOOP)
    GL.glVertex2f(x,y); GL.glVertex2f(x+w,y)
    GL.glVertex2f(x+w,y+h); GL.glVertex2f(x,y+h)
  GL.glEnd()
  GL.glLineWidth(1)
end

local function roundedPoly(x,y,w,h,r)
  local maxR = math.min(w,h)/2
  r = math.min(r, maxR)
  if r<=0 then return {x,y, x+w,y, x+w,y+h, x,y+h} end
  local segs=10
  local v={}
  local function arc(cx,cy,a0,a1)
    for i=0,segs do
      local a=a0+(a1-a0)*i/segs
      v[#v+1]=cx+math.cos(a)*r; v[#v+1]=cy+math.sin(a)*r
    end
  end
  local pi=math.pi
  arc(x+r,    y+r,    pi,    pi*1.5)
  arc(x+w-r,  y+r,    pi*1.5,pi*2)
  arc(x+w-r,  y+h-r,  0,     pi*0.5)
  arc(x+r,    y+h-r,  pi*0.5,pi)
  return v
end

local function filledRoundedRect(x,y,w,h,r)
  if r<=0 then filledRect(x,y,w,h); return end
  flushQuads()
  local v=roundedPoly(x,y,w,h,r)
  GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(x+w/2, y+h/2)
    for i=1,#v,2 do GL.glVertex2f(v[i],v[i+1]) end
    GL.glVertex2f(v[1],v[2])
  GL.glEnd()
end

local function strokedRoundedRect(x,y,w,h,r,lw)
  flushQuads()
  GL.glLineWidth(lw or 1)
  if r<=0 then strokedRect(x,y,w,h,lw); GL.glLineWidth(1); return end
  local v=roundedPoly(x,y,w,h,r)
  GL.glBegin(GL.LINE_LOOP)
    for i=1,#v,2 do GL.glVertex2f(v[i],v[i+1]) end
  GL.glEnd()
  GL.glLineWidth(1)
end

-- ============================================================================
-- Gradient
-- ============================================================================

local function drawGradient(x,y,w,h,dir,c1,c2,op)
  flushQuads()
  local r1,g1,b1,a1=parseColor(c1); a1=a1*op
  local r2,g2,b2,a2=parseColor(c2); a2=a2*op
  if dir=="horizontal" then
    GL.glBegin(GL.TRIANGLE_STRIP)
      GL.glColor4f(r1,g1,b1,a1); GL.glVertex2f(x,y)
      GL.glColor4f(r2,g2,b2,a2); GL.glVertex2f(x+w,y)
      GL.glColor4f(r1,g1,b1,a1); GL.glVertex2f(x,y+h)
      GL.glColor4f(r2,g2,b2,a2); GL.glVertex2f(x+w,y+h)
    GL.glEnd()
  else
    GL.glBegin(GL.TRIANGLE_STRIP)
      GL.glColor4f(r1,g1,b1,a1); GL.glVertex2f(x,y)
      GL.glColor4f(r1,g1,b1,a1); GL.glVertex2f(x+w,y)
      GL.glColor4f(r2,g2,b2,a2); GL.glVertex2f(x,y+h)
      GL.glColor4f(r2,g2,b2,a2); GL.glVertex2f(x+w,y+h)
    GL.glEnd()
  end
end

-- ============================================================================
-- Box shadow
-- ============================================================================

local function drawBoxShadow(x,y,w,h,r,sc,ox,oy,blur,op)
  if not sc or blur<=0 then return end
  local sr,sg,sb,sa=parseColor(sc)
  local steps=math.min(math.ceil(blur),10)
  for i=steps,1,-1 do
    local e=i
    GL.glColor4f(sr,sg,sb, (sa*op/steps)*(steps-i+1))
    filledRoundedRect(x+ox-e, y+oy-e, w+e*2, h+e*2, r+e)
  end
end

-- ============================================================================
-- Scissor (GL y-flip)
-- ============================================================================

local scissorStack = {}

local function pushScissor(x,y,w,h)
  flushQuads()
  if #scissorStack>0 then
    local p=scissorStack[#scissorStack]
    local nx=math.max(p.x,x); local ny=math.max(p.y,y)
    local nx2=math.min(p.x+p.w,x+w); local ny2=math.min(p.y+p.h,y+h)
    x,y=nx,ny; w=math.max(0,nx2-nx); h=math.max(0,ny2-ny)
  end
  table.insert(scissorStack, {x=x,y=y,w=w,h=h})
  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(x, H-(y+h), math.max(0,w), math.max(0,h))
end

local function popScissor()
  flushQuads()
  table.remove(scissorStack)
  if #scissorStack>0 then
    local p=scissorStack[#scissorStack]
    GL.glScissor(p.x, H-(p.y+p.h), math.max(0,p.w), math.max(0,p.h))
  else
    GL.glDisable(GL.SCISSOR_TEST)
  end
end

-- ============================================================================
-- Stencil
-- ============================================================================

local function writeStencil(value, drawFn)
  flushQuads()
  GL.glEnable(GL.STENCIL_TEST)
  GL.glStencilFunc(GL.ALWAYS, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.REPLACE)
  GL.glColorMask(GL.FALSE,GL.FALSE,GL.FALSE,GL.FALSE)
  GL.glDepthMask(GL.FALSE)
  drawFn()
  GL.glColorMask(GL.TRUE,GL.TRUE,GL.TRUE,GL.TRUE)
  GL.glDepthMask(GL.TRUE)
end

local function setStencilTest(value)
  flushQuads()
  GL.glStencilFunc(GL.GREATER, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.KEEP)
end

local function clearStencilTest()
  flushQuads()
  GL.glDisable(GL.STENCIL_TEST)
end

-- ============================================================================
-- Transform
-- ============================================================================

local function applyTransform(t, c)
  if not t then return false end
  if not (t.translateX or t.translateY or t.rotate or t.scaleX or t.scaleY) then
    return false
  end
  flushQuads()
  GL.glPushMatrix()
  local ox = c.x + (t.originX or 0.5)*c.w
  local oy = c.y + (t.originY or 0.5)*c.h
  GL.glTranslatef(ox, oy, 0)
  if t.rotate   then GL.glRotatef(t.rotate, 0, 0, 1) end
  if t.scaleX or t.scaleY then
    GL.glScalef(t.scaleX or 1, t.scaleY or 1, 1)
  end
  GL.glTranslatef(-ox, -oy, 0)
  if t.translateX or t.translateY then
    GL.glTranslatef(t.translateX or 0, t.translateY or 0, 0)
  end
  return true
end

-- ============================================================================
-- Text
-- ============================================================================

local function drawText(text, x, y, w, align, size, color, op)
  flushQuads()
  local r,g,b,a = parseColor(color); a=a*op
  local tw = Font.measureWidth(text, size)
  local dx = x
  if     align=="center" then dx = x+(w-tw)/2
  elseif align=="right"  then dx = x+w-tw
  end
  Font.draw(text, dx, y, size, r, g, b, a)
end

local function wrapText(text, size, maxWidth)
  return Font.wrapText(text, size, maxWidth)
end

local ELLIPSIS = "..."

--- Truncate a single line so that text + "..." fits within maxWidth.
--- Uses binary search for efficiency.
local function truncateWithEllipsis(text, fontSize, maxWidth)
  local textW = Font.measureWidth(text, fontSize)
  if textW <= maxWidth then return text end

  local ellipsisW = Font.measureWidth(ELLIPSIS, fontSize)
  local available = maxWidth - ellipsisW
  if available <= 0 then return ELLIPSIS end

  -- Binary search for longest prefix that fits
  local lo, hi = 0, #text
  while lo < hi do
    local mid = math.floor((lo + hi + 1) / 2)
    local prefix = text:sub(1, mid)
    if Font.measureWidth(prefix, fontSize) <= available then
      lo = mid
    else
      hi = mid - 1
    end
  end

  if lo == 0 then return ELLIPSIS end
  return text:sub(1, lo) .. ELLIPSIS
end

-- ============================================================================
-- Arc sector / polygon helpers (for PieChart, RadarChart, etc.)
-- ============================================================================

--- Draw a filled pie/donut slice using OpenGL.
--- @param c     table  Computed rect {x, y, w, h}
--- @param arc   table  { startAngle, endAngle, innerRadius? }
local function drawArcSector(c, arc)
  flushQuads()
  local cx = c.x + c.w * 0.5
  local cy = c.y + c.h * 0.5
  local r  = math.min(c.w, c.h) * 0.5
  local ir = arc.innerRadius or 0
  local a0 = arc.startAngle
  local a1 = arc.endAngle

  -- Enough steps for a smooth curve
  local span  = math.abs(a1 - a0)
  local steps = math.max(8, math.floor(span * r * 0.5))

  if ir > 0 then
    -- Annular sector: outer arc forward, inner arc backward as triangle strip
    GL.glBegin(GL.TRIANGLE_STRIP)
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      local cosA = math.cos(a)
      local sinA = math.sin(a)
      GL.glVertex2f(cx + cosA * r,  cy + sinA * r)
      GL.glVertex2f(cx + cosA * ir, cy + sinA * ir)
    end
    GL.glEnd()
  else
    -- Solid slice: fan from center
    GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(cx, cy)
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      GL.glVertex2f(cx + math.cos(a) * r, cy + math.sin(a) * r)
    end
    GL.glEnd()
  end
end

--- Draw a filled polygon from a flat [x0,y0,x1,y1,...] list relative to box origin.
--- @param c    table   Computed rect {x, y, w, h}
--- @param pts  table   Flat array of coordinates
local function drawPolygon(c, pts)
  if #pts < 6 then return end
  flushQuads()
  GL.glBegin(GL.TRIANGLE_FAN)
  -- Use centroid as fan center for convex polygons
  local sumX, sumY = 0, 0
  local n = #pts / 2
  for i = 1, #pts, 2 do
    sumX = sumX + pts[i]
    sumY = sumY + pts[i+1]
  end
  GL.glVertex2f(c.x + sumX / n, c.y + sumY / n)
  for i = 1, #pts, 2 do
    GL.glVertex2f(c.x + pts[i], c.y + pts[i+1])
  end
  -- Close the fan
  GL.glVertex2f(c.x + pts[1], c.y + pts[2])
  GL.glEnd()
end

-- ============================================================================
-- Per-corner border radius helpers
-- ============================================================================

--- Resolve per-corner border radii from style properties.
--- Returns tl, tr, bl, br (top-left, top-right, bottom-left, bottom-right).
local function resolveCornerRadii(s)
  local uniform = s.borderRadius or 0
  local tl = s.borderTopLeftRadius or uniform
  local tr = s.borderTopRightRadius or uniform
  local bl = s.borderBottomLeftRadius or uniform
  local br = s.borderBottomRightRadius or uniform
  return tl, tr, bl, br
end

--- Check if a node has non-uniform per-corner border radii.
local function hasPerCornerRadius(s)
  return s.borderTopLeftRadius or s.borderTopRightRadius
      or s.borderBottomLeftRadius or s.borderBottomRightRadius
end

--- Build vertices for a rounded rectangle with per-corner radii.
--- Returns a flat array of {x1,y1, x2,y2, ...} vertices.
local function perCornerPoly(x, y, w, h, tl, tr, bl, br)
  local maxR = math.min(w, h) / 2
  tl = math.min(tl, maxR)
  tr = math.min(tr, maxR)
  bl = math.min(bl, maxR)
  br = math.min(br, maxR)

  local segs = 8
  local v = {}
  local pi = math.pi

  local function addArc(cx, cy, r, startA, endA)
    if r <= 0 then
      v[#v+1] = cx; v[#v+1] = cy
      return
    end
    for i = 0, segs do
      local a = startA + (endA - startA) * (i / segs)
      v[#v+1] = cx + math.cos(a) * r
      v[#v+1] = cy + math.sin(a) * r
    end
  end

  -- Top-left corner (arc from pi to 3pi/2)
  addArc(x + tl, y + tl, tl, pi, pi * 1.5)
  -- Top-right corner (arc from 3pi/2 to 2pi)
  addArc(x + w - tr, y + tr, tr, pi * 1.5, pi * 2)
  -- Bottom-right corner (arc from 0 to pi/2)
  addArc(x + w - br, y + h - br, br, 0, pi * 0.5)
  -- Bottom-left corner (arc from pi/2 to pi)
  addArc(x + bl, y + h - bl, bl, pi * 0.5, pi)

  return v
end

--- Draw a filled rectangle with per-corner border radii using GL TRIANGLE_FAN.
local function filledPerCornerRect(x, y, w, h, tl, tr, bl, br)
  -- All zeros: plain rect
  if tl <= 0 and tr <= 0 and bl <= 0 and br <= 0 then
    filledRect(x, y, w, h)
    return
  end
  flushQuads()
  local v = perCornerPoly(x, y, w, h, tl, tr, bl, br)
  GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(x + w/2, y + h/2)
    for i = 1, #v, 2 do GL.glVertex2f(v[i], v[i+1]) end
    GL.glVertex2f(v[1], v[2])
  GL.glEnd()
end

--- Draw a stroked rectangle with per-corner border radii using GL LINE_LOOP.
local function strokedPerCornerRect(x, y, w, h, tl, tr, bl, br, lw)
  flushQuads()
  GL.glLineWidth(lw or 1)
  if tl <= 0 and tr <= 0 and bl <= 0 and br <= 0 then
    strokedRect(x, y, w, h, lw)
    GL.glLineWidth(1)
    return
  end
  local v = perCornerPoly(x, y, w, h, tl, tr, bl, br)
  GL.glBegin(GL.LINE_LOOP)
    for i = 1, #v, 2 do GL.glVertex2f(v[i], v[i+1]) end
  GL.glEnd()
  GL.glLineWidth(1)
end

-- ============================================================================
-- Node painter
-- ============================================================================

-- Lazy-loaded modules
local CapabilitiesModule = nil
local TextInputModule = nil
local TextEditorModule = nil
local CodeBlockModule = nil
local SliderModule = nil
local FaderModule = nil
local KnobModule = nil
local SwitchModule = nil
local CheckboxModule = nil
local RadioModule = nil
local SelectModule = nil
local VideoPlayerModule = nil

-- Video module reference (set via Painter.init())
local VideosModule = nil
local ImagesModule = nil
local EffectsModule = nil

function Painter.paintNode(node, inheritedOpacity, stencilDepth)
  if not node or not node.computed then return end
  inheritedOpacity = inheritedOpacity or 1
  stencilDepth     = stencilDepth or 0

  -- Skip non-visual capability nodes and nodes that render in their own surface
  -- (e.g. Window). The _isWindowRoot flag exempts Window nodes when they ARE
  -- the root of their own window's paint pass.
  if not CapabilitiesModule then
    local ok, mod = pcall(require, "lua.capabilities")
    if ok then CapabilitiesModule = mod end
  end
  if CapabilitiesModule then
    if CapabilitiesModule.isNonVisual(node.type)
       and not CapabilitiesModule.rendersInOwnSurface(node.type) then
      return
    end
    if CapabilitiesModule.rendersInOwnSurface(node.type)
       and not node._isWindowRoot then
      return
    end
  end

  local c = node.computed
  local s = node.style or {}

  if s.display=="none" then return end
  local isHidden = s.visibility=="hidden"

  local eff = (s.opacity or 1) * inheritedOpacity
  if eff<=0 then return end

  local didTx = applyTransform(s.transform, c)

  -- Resolve border radii (per-corner or uniform)
  local tl, tr, bl, br = resolveCornerRadii(s)
  local borderRadius = s.borderRadius or 0
  local hasRoundedCorners = tl > 0 or tr > 0 or bl > 0 or br > 0
  local isPerCorner = hasPerCornerRadius(s)
  local isScroll   = s.overflow=="scroll"
  local needsClip  = s.overflow=="hidden" or isScroll
  local useStencil = needsClip and hasRoundedCorners
  local useScissor = needsClip and not hasRoundedCorners
  local prevSD = stencilDepth

  if useStencil then
    if c.w < 1 or c.h < 1 then
      io.write("[painter] STENCIL skip 0-size id=" .. tostring(node.id) .. " " .. c.w .. "x" .. c.h .. "\n"); io.flush()
    end
    local sv = stencilDepth+1
    writeStencil(sv, function()
      if isPerCorner then
        filledPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
      end
    end)
    setStencilTest(stencilDepth)
    stencilDepth = sv
  elseif useScissor then
    pushScissor(c.x,c.y,c.w,c.h)
  end

  -- View / box
  if not isHidden and (node.type=="View" or node.type=="box") then
    if s.shadowColor and (s.shadowBlur or 0)>0 then
      drawBoxShadow(c.x,c.y,c.w,c.h, borderRadius, s.shadowColor,
                    s.shadowOffsetX or 0, s.shadowOffsetY or 0, s.shadowBlur, eff)
    end
    if s.backgroundGradient then
      local gr=s.backgroundGradient
      drawGradient(c.x,c.y,c.w,c.h, gr.direction or "vertical",
                   gr.colors[1], gr.colors[2], eff)
    elseif s.backgroundColor and s.backgroundColor~="transparent" then
      Painter.setColor(s.backgroundColor)
      Painter.applyOpacity(eff)
      -- Arc shape (PieChart), polygon (RadarChart), or rounded rect
      if s.arcShape then
        drawArcSector(c, s.arcShape)
      elseif s.polygonPoints and #s.polygonPoints >= 6 then
        drawPolygon(c, s.polygonPoints)
      elseif isPerCorner then
        filledPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        filledRoundedRect(c.x,c.y,c.w,c.h, borderRadius)
      end
    end

    -- Border stroke
    local bwT = s.borderTopWidth or s.borderWidth or 0
    local bwR = s.borderRightWidth or s.borderWidth or 0
    local bwB = s.borderBottomWidth or s.borderWidth or 0
    local bwL = s.borderLeftWidth or s.borderWidth or 0
    local hasUniformBorder = s.borderWidth and s.borderWidth > 0
        and not s.borderTopWidth and not s.borderRightWidth
        and not s.borderBottomWidth and not s.borderLeftWidth
    local hasPerSideBorder = (bwT > 0 or bwR > 0 or bwB > 0 or bwL > 0) and not hasUniformBorder

    if hasUniformBorder then
      -- Fast path: uniform border via stroked rect
      Painter.setColor(s.borderColor or {0.5,0.5,0.5,1})
      Painter.applyOpacity(eff)
      if isPerCorner then
        strokedPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br, s.borderWidth)
      else
        strokedRoundedRect(c.x, c.y, c.w, c.h, borderRadius, s.borderWidth)
      end
    elseif hasPerSideBorder then
      -- Per-side borders: draw individual lines with per-side colors
      flushQuads()
      local defaultColor = s.borderColor or {0.5,0.5,0.5,1}
      if bwT > 0 then
        Painter.setColor(s.borderTopColor or defaultColor)
        Painter.applyOpacity(eff)
        GL.glLineWidth(bwT)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, c.y + bwT/2)
          GL.glVertex2f(c.x + c.w, c.y + bwT/2)
        GL.glEnd()
      end
      if bwB > 0 then
        Painter.setColor(s.borderBottomColor or defaultColor)
        Painter.applyOpacity(eff)
        GL.glLineWidth(bwB)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, c.y + c.h - bwB/2)
          GL.glVertex2f(c.x + c.w, c.y + c.h - bwB/2)
        GL.glEnd()
      end
      if bwL > 0 then
        Painter.setColor(s.borderLeftColor or defaultColor)
        Painter.applyOpacity(eff)
        GL.glLineWidth(bwL)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x + bwL/2, c.y)
          GL.glVertex2f(c.x + bwL/2, c.y + c.h)
        GL.glEnd()
      end
      if bwR > 0 then
        Painter.setColor(s.borderRightColor or defaultColor)
        Painter.applyOpacity(eff)
        GL.glLineWidth(bwR)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x + c.w - bwR/2, c.y)
          GL.glVertex2f(c.x + c.w - bwR/2, c.y + c.h)
        GL.glEnd()
      end
      GL.glLineWidth(1)
    end

  -- Text / __TEXT__
  elseif not isHidden and (node.type=="Text" or node.type=="__TEXT__") then
    local ps = (node.type=="__TEXT__" and node.parent and node.parent.style) or {}
    local fontSize = s.fontSize or ps.fontSize or 14

    -- Resolve text color with theme fallback
    local textColor = s.color
    if not textColor and node.type == "__TEXT__" and node.parent then
      textColor = (node.parent.style or {}).color
    end
    local defaultTextColor = (currentTheme and currentTheme.colors and currentTheme.colors.text) or {1,1,1,1}
    local color = textColor or defaultTextColor

    local align = s.textAlign or ps.textAlign or "left"
    local text  = node.text or (node.props and node.props.children) or ""
    if type(text)=="table" then text=table.concat(text) end
    text = tostring(text)

    -- Resolve numberOfLines / textOverflow (with inheritance for __TEXT__)
    local numberOfLines = (node.props and node.props.numberOfLines)
    if not numberOfLines and node.type == "__TEXT__" and node.parent then
      numberOfLines = (node.parent.props or {}).numberOfLines
    end
    local textOverflow = s.textOverflow
    if not textOverflow and node.type == "__TEXT__" and node.parent then
      textOverflow = (node.parent.style or {}).textOverflow
    end

    -- Resolve textDecorationLine (with inheritance for __TEXT__)
    local textDecorationLine = s.textDecorationLine
    if not textDecorationLine and node.type == "__TEXT__" and node.parent then
      textDecorationLine = (node.parent.style or {}).textDecorationLine
    end

    -- Text shadow: draw offset copy before main text
    local shadowColor = s.textShadowColor
    if not shadowColor and node.type == "__TEXT__" and node.parent then
      shadowColor = (node.parent.style or {}).textShadowColor
    end
    if shadowColor then
      local sox = s.textShadowOffsetX or 0
      local soy = s.textShadowOffsetY or 0
      if sox == 0 and node.type == "__TEXT__" and node.parent then
        sox = (node.parent.style or {}).textShadowOffsetX or 0
      end
      if soy == 0 and node.type == "__TEXT__" and node.parent then
        soy = (node.parent.style or {}).textShadowOffsetY or 0
      end
      if c.w > 0 then
        local lines = wrapText(text, fontSize, c.w)
        if numberOfLines and numberOfLines > 0 and #lines > numberOfLines then
          local trunc = {}
          for i = 1, numberOfLines do trunc[i] = lines[i] end
          if textOverflow == "ellipsis" then
            trunc[numberOfLines] = truncateWithEllipsis(trunc[numberOfLines], fontSize, c.w)
          end
          lines = trunc
        end
        local lh = Font.lineHeight(fontSize)
        for i, line in ipairs(lines) do
          drawText(line, c.x + sox, c.y + (i-1)*lh + soy, c.w, align, fontSize, shadowColor, eff)
        end
      else
        drawText(text, c.x + sox, c.y + soy, 99999, align, fontSize, shadowColor, eff)
      end
    end

    -- Main text draw
    if c.w > 0 then
      local lines = wrapText(text, fontSize, c.w)

      -- Apply numberOfLines truncation
      if numberOfLines and numberOfLines > 0 and #lines > numberOfLines then
        local truncated = {}
        for i = 1, numberOfLines do
          truncated[i] = lines[i]
        end
        -- Apply ellipsis to last visible line
        if textOverflow == "ellipsis" then
          truncated[numberOfLines] = truncateWithEllipsis(truncated[numberOfLines], fontSize, c.w)
        end
        lines = truncated
      end

      local lh = Font.lineHeight(fontSize)
      for i, line in ipairs(lines) do
        drawText(line, c.x, c.y + (i-1)*lh, c.w, align, fontSize, color, eff)
      end
    else
      drawText(text, c.x, c.y, 99999, align, fontSize, color, eff)
    end

    -- Text decorations (underline, line-through)
    if textDecorationLine and textDecorationLine ~= "none" then
      flushQuads()
      Painter.setColor(color)
      Painter.applyOpacity(eff)
      local lh = Font.lineHeight(fontSize)
      if textDecorationLine == "underline" then
        local ascender = Font.ascender(fontSize)
        local descent = lh - ascender
        local baselineY = c.y + ascender + descent * 0.3
        GL.glLineWidth(1)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, baselineY)
          GL.glVertex2f(c.x + c.w, baselineY)
        GL.glEnd()
      elseif textDecorationLine == "line-through" then
        local midY = c.y + lh * 0.45
        GL.glLineWidth(1)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, midY)
          GL.glVertex2f(c.x + c.w, midY)
        GL.glEnd()
      end
    end

  -- Lua-owned interactive widgets: delegate rendering to their modules
  elseif not isHidden and node.type == "TextInput" then
    if not TextInputModule then
      local ok, mod = pcall(require, "lua.textinput")
      if ok then TextInputModule = mod
      else io.write("[painter] TextInput load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if TextInputModule then TextInputModule.draw(node, eff) end

  elseif not isHidden and node.type == "TextEditor" then
    if not TextEditorModule then
      local ok, mod = pcall(require, "lua.texteditor")
      if ok then TextEditorModule = mod
      else io.write("[painter] TextEditor load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if TextEditorModule then TextEditorModule.draw(node, eff) end

  elseif not isHidden and node.type == "CodeBlock" then
    if not CodeBlockModule then
      local ok, mod = pcall(require, "lua.codeblock")
      if ok then CodeBlockModule = mod
      else io.write("[painter] CodeBlock load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if CodeBlockModule and CodeBlockModule.render then
      if c and c.w > 0 and c.h > 0 then
        CodeBlockModule.render(node, c, eff)
      end
    end

  elseif not isHidden and node.type == "Slider" then
    if not SliderModule then
      local ok, mod = pcall(require, "lua.slider")
      if ok then SliderModule = mod
      else io.write("[painter] Slider load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SliderModule then SliderModule.draw(node, eff) end

  elseif not isHidden and node.type == "Fader" then
    if not FaderModule then
      local ok, mod = pcall(require, "lua.fader")
      if ok then FaderModule = mod
      else io.write("[painter] Fader load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if FaderModule then FaderModule.draw(node, eff) end

  elseif not isHidden and node.type == "Knob" then
    if not KnobModule then
      local ok, mod = pcall(require, "lua.knob")
      if ok then KnobModule = mod
      else io.write("[painter] Knob load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if KnobModule then KnobModule.draw(node, eff) end

  elseif not isHidden and node.type == "Switch" then
    if not SwitchModule then
      local ok, mod = pcall(require, "lua.switch")
      if ok then SwitchModule = mod
      else io.write("[painter] Switch load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SwitchModule then SwitchModule.draw(node, eff) end

  elseif not isHidden and node.type == "Checkbox" then
    if not CheckboxModule then
      local ok, mod = pcall(require, "lua.checkbox")
      if ok then CheckboxModule = mod
      else io.write("[painter] Checkbox load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if CheckboxModule then CheckboxModule.draw(node, eff) end

  elseif not isHidden and node.type == "Radio" then
    if not RadioModule then
      local ok, mod = pcall(require, "lua.radio")
      if ok then RadioModule = mod
      else io.write("[painter] Radio load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if RadioModule then RadioModule.draw(node, eff) end

  elseif not isHidden and node.type == "Select" then
    if not SelectModule then
      local ok, mod = pcall(require, "lua.select")
      if ok then SelectModule = mod
      else io.write("[painter] Select load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SelectModule then SelectModule.draw(node, eff) end

  elseif not isHidden and node.type == "Video" and VideosModule then
    local src = node.props and node.props.src
    if src then
      local status = VideosModule.getStatus(src)
      if status == "ready" then
        local vidEntry = VideosModule.get(src)
        if vidEntry then
          -- Control playback via mpv property API
          VideosModule.setPaused(src, node.props.paused)
          VideosModule.setMuted(src, node.props.muted)
          VideosModule.setVolume(src, node.props.volume or 1)
          VideosModule.setLoop(src, node.props.loop)

          -- Calculate scaling (objectFit)
          local objectFit = s.objectFit or "fill"
          local vidW, vidH = vidEntry.w, vidEntry.h
          local drawX, drawY, drawW, drawH

          if objectFit == "contain" then
            local scale = math.min(c.w / vidW, c.h / vidH)
            drawW = vidW * scale
            drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "cover" then
            local scale = math.max(c.w / vidW, c.h / vidH)
            drawW = vidW * scale
            drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "none" then
            drawW = vidW
            drawH = vidH
            drawX = c.x + (c.w - vidW) / 2
            drawY = c.y + (c.h - vidH) / 2
          else -- "fill"
            drawX = c.x
            drawY = c.y
            drawW = c.w
            drawH = c.h
          end

          -- Draw video frame as textured quad
          flushQuads()
          if ImagesModule and ImagesModule.drawTexture then
            ImagesModule.drawTexture(vidEntry.texId, drawX, drawY, drawW, drawH, eff)
          end
        end
      else
        -- Loading / error / no video: dark placeholder
        Painter.setColor({0.10, 0.11, 0.14, 1})
        Painter.applyOpacity(eff)
        filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
        -- Play triangle icon
        local iconSize = math.min(c.w, c.h) * 0.15
        if iconSize > 6 then
          flushQuads()
          local cx = c.x + c.w / 2
          local cy = c.y + c.h / 2
          GL.glColor4f(0.30, 0.33, 0.40, 0.5 * eff)
          GL.glBegin(GL.TRIANGLE_FAN)
            GL.glVertex2f(cx - iconSize * 0.4, cy - iconSize * 0.5)
            GL.glVertex2f(cx + iconSize * 0.5, cy)
            GL.glVertex2f(cx - iconSize * 0.4, cy + iconSize * 0.5)
          GL.glEnd()
        end
      end
    end

  elseif not isHidden and node.type == "VideoPlayer" then
    if not VideoPlayerModule then
      local ok, mod = pcall(require, "lua.sdl2_videoplayer")
      if ok then VideoPlayerModule = mod
      else io.write("[painter] VideoPlayer load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if VideoPlayerModule then
      local vpState = node._vp
      if not (vpState and vpState.isFullscreen) then
        VideoPlayerModule.draw(node, eff)
      end
    end

  -- Generative effect viewport: draw the pre-rendered Canvas from effects.lua
  elseif not isHidden and EffectsModule and EffectsModule.isEffect(node.type) then
    local canvas = EffectsModule.get(node.id)
    if canvas then
      flushQuads()
      -- Canvas is a love.Canvas (sdl2_canvas FBO). Draw it scaled to the node bounds.
      love.graphics.setColor(1, 1, 1, eff)
      local cw, ch = canvas:getDimensions()
      love.graphics.draw(canvas, c.x, c.y, 0, c.w / cw, c.h / ch)
    end
  end

  -- Generic capability draw dispatch — any visual capability with a draw()
  -- function gets called here. No hardcoded capability names in the painter.
  if not isHidden and CapabilitiesModule then
    local def = CapabilitiesModule.getDefinition(node.type)
    if def and def.draw then
      flushQuads()
      local inst = CapabilitiesModule.getInstance(tostring(node.id))
      if inst then
        def.draw(tostring(node.id), inst.state, inst.props or {}, c, eff)
      end
    end
  end

  -- Background effect canvas (renders behind children, from child effect with background=true)
  if EffectsModule then
    local bgCanvas = EffectsModule.getBackground(node.id)
    if bgCanvas then
      flushQuads()
      love.graphics.setColor(1, 1, 1, eff)
      local cw, ch = bgCanvas:getDimensions()
      love.graphics.draw(bgCanvas, c.x, c.y, 0, c.w / cw, c.h / ch)
    end
  end

  -- Children
  local scrollX, scrollY = 0, 0
  if isScroll and node.scrollState then
    scrollX = node.scrollState.scrollX or 0
    scrollY = node.scrollState.scrollY or 0
  end
  if isScroll and (scrollX~=0 or scrollY~=0) then
    flushQuads()
    GL.glPushMatrix()
    GL.glTranslatef(-scrollX, -scrollY, 0)
  end

  -- ZIndex-aware sort
  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)

  for _, child in ipairs(paintOrder) do
    Painter.paintNode(child, eff, stencilDepth)
  end

  if isScroll and (scrollX~=0 or scrollY~=0) then
    flushQuads()
    GL.glPopMatrix()
  end

  if useStencil then
    if prevSD>0 then setStencilTest(prevSD-1)
    else clearStencilTest() end
  elseif useScissor then
    popScissor()
  end

  if didTx then flushQuads(); GL.glPopMatrix() end
end

function Painter.paint(node)
  if not node then return end
  Painter.paintNode(node)
  flushQuads()
  GL.glColor4f(1,1,1,1)
end

function Painter.init(config)
  W = (config and config.width)  or 1280
  H = (config and config.height) or 720
  VideosModule = config and config.videos
  ImagesModule = config and config.images
  EffectsModule = config and config.effects
end

--- Set effects module reference (called after effects.loadAll()).
function Painter.setEffects(mod)
  EffectsModule = mod
end

-- Update screen dimensions (called on resize)
function Painter.setDimensions(w, h)
  W = w; H = h
end

return Painter
