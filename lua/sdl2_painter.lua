--[[
  sdl2_painter.lua -- SDL2/OpenGL painter (framework version)
  Mirrors the lua/painter.lua interface so target_sdl2.lua can drop it in.
  See experiments/sdl2-painter/painter.lua for the origin.
]]

local GL   = require("lua.sdl2_gl")
local Font = require("lua.sdl2_font")

local W, H = 1280, 720

local Painter = {}

-- ============================================================================
-- Color
-- ============================================================================

local cr, cg, cb, ca = 1, 1, 1, 1

local NAMED = {
  white={1,1,1,1}, black={0,0,0,1}, red={1,0,0,1}, green={0,1,0,1},
  blue={0,0,1,1}, gray={.5,.5,.5,1}, transparent={0,0,0,0},
}

local function hexb(s,i) return tonumber(s:sub(i,i+1),16)/255 end

local function parseColor(c)
  if not c then return 1,1,1,1 end
  if type(c)=="table" then return c[1] or 1, c[2] or 1, c[3] or 1, c[4] or 1 end
  if type(c)=="string" then
    if c:sub(1,1)=="#" then
      local s=c:sub(2)
      if #s==3 then
        return tonumber(s:sub(1,1),16)/15, tonumber(s:sub(2,2),16)/15,
               tonumber(s:sub(3,3),16)/15, 1
      elseif #s==6 then return hexb(s,1),hexb(s,3),hexb(s,5),1
      elseif #s==8 then return hexb(s,1),hexb(s,3),hexb(s,5),hexb(s,7)
      end
    end
    local n=NAMED[c:lower()]; if n then return n[1],n[2],n[3],n[4] end
  end
  return 1,1,1,1
end

function Painter.setColor(color)
  cr,cg,cb,ca = parseColor(color)
  GL.glColor4f(cr,cg,cb,ca)
end

function Painter.applyOpacity(op)
  if op>=1 then return end
  ca = ca*op
  GL.glColor4f(cr,cg,cb,ca)
end

-- ============================================================================
-- Geometry
-- ============================================================================

local function filledRect(x,y,w,h)
  GL.glBegin(GL.TRIANGLE_STRIP)
    GL.glVertex2f(x,y); GL.glVertex2f(x+w,y)
    GL.glVertex2f(x,y+h); GL.glVertex2f(x+w,y+h)
  GL.glEnd()
end

local function strokedRect(x,y,w,h,lw)
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
  local v=roundedPoly(x,y,w,h,r)
  GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(x+w/2, y+h/2)
    for i=1,#v,2 do GL.glVertex2f(v[i],v[i+1]) end
    GL.glVertex2f(v[1],v[2])
  GL.glEnd()
end

local function strokedRoundedRect(x,y,w,h,r,lw)
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
  GL.glStencilFunc(GL.GREATER, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.KEEP)
end

local function clearStencilTest()
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
  local r,g,b,a = parseColor(color); a=a*op
  local tw = Font.measureWidth(text, size)
  local dx = x
  if     align=="center" then dx = x+(w-tw)/2
  elseif align=="right"  then dx = x+w-tw
  end
  Font.draw(text, dx, y, size, r, g, b, a)
end

local function wrapText(text, size, maxWidth)
  local lines = {}
  local paragraphs = {}
  for raw in text:gmatch("[^\n]+") do paragraphs[#paragraphs+1] = raw end
  if #paragraphs==0 then paragraphs[1]=text end
  for _, raw in ipairs(paragraphs) do
    local words={}
    for w in raw:gmatch("%S+") do words[#words+1]=w end
    local line=""
    for _, word in ipairs(words) do
      local cand = line=="" and word or (line.." "..word)
      if Font.measureWidth(cand,size)<=maxWidth then
        line=cand
      else
        if line~="" then lines[#lines+1]=line end
        line=word
      end
    end
    if line~="" then lines[#lines+1]=line end
  end
  if #lines==0 then lines[1]="" end
  return lines
end

-- ============================================================================
-- Node painter
-- ============================================================================

-- Lazy-loaded capabilities module for checking rendersInOwnSurface
local CapabilitiesModule = nil

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

  local r    = s.borderRadius or 0
  local isScroll   = s.overflow=="scroll"
  local needsClip  = s.overflow=="hidden" or isScroll
  local useStencil = needsClip and r>0
  local useScissor = needsClip and r==0
  local prevSD = stencilDepth

  if useStencil then
    local sv = stencilDepth+1
    writeStencil(sv, function() filledRoundedRect(c.x,c.y,c.w,c.h,r) end)
    setStencilTest(stencilDepth)
    stencilDepth = sv
  elseif useScissor then
    pushScissor(c.x,c.y,c.w,c.h)
  end

  -- View / box
  if not isHidden and (node.type=="View" or node.type=="box") then
    if s.shadowColor and (s.shadowBlur or 0)>0 then
      drawBoxShadow(c.x,c.y,c.w,c.h, r, s.shadowColor,
                    s.shadowOffsetX or 0, s.shadowOffsetY or 0, s.shadowBlur, eff)
    end
    if s.backgroundGradient then
      local gr=s.backgroundGradient
      drawGradient(c.x,c.y,c.w,c.h, gr.direction or "vertical",
                   gr.colors[1], gr.colors[2], eff)
    elseif s.backgroundColor and s.backgroundColor~="transparent" then
      Painter.setColor(s.backgroundColor)
      Painter.applyOpacity(eff)
      filledRoundedRect(c.x,c.y,c.w,c.h, r)
    end
    local bw = s.borderWidth or 0
    if bw>0 then
      Painter.setColor(s.borderColor or {0.5,0.5,0.5,1})
      Painter.applyOpacity(eff)
      strokedRoundedRect(c.x,c.y,c.w,c.h, r, bw)
    end

  -- Visual capabilities with a custom draw callback (e.g. Boids)
  elseif not isHidden and CapabilitiesModule and CapabilitiesModule.isCapability(node.type) then
    local cap  = CapabilitiesModule.getDefinition(node.type)
    local inst = cap and CapabilitiesModule.getInstance(node.id)
    if cap and cap.draw and inst then
      cap.draw(node.id, inst.state, inst.props, c, eff)
    end

  -- Text / __TEXT__
  elseif not isHidden and (node.type=="Text" or node.type=="__TEXT__") then
    local ps = (node.type=="__TEXT__" and node.parent and node.parent.style) or {}
    local fontSize = s.fontSize or ps.fontSize or 14
    local color    = s.color    or ps.color    or {1,1,1,1}
    local align    = s.textAlign or ps.textAlign or "left"
    local text     = node.text or (node.props and node.props.children) or ""
    if type(text)=="table" then text=table.concat(text) end
    text=tostring(text)
    if c.w>0 then
      local lines = wrapText(text, fontSize, c.w)
      local lh    = Font.lineHeight(fontSize)
      for i, line in ipairs(lines) do
        drawText(line, c.x, c.y+(i-1)*lh, c.w, align, fontSize, color, eff)
      end
    else
      drawText(text, c.x, c.y, 99999, align, fontSize, color, eff)
    end
  end

  -- Children
  local scrollX, scrollY = 0, 0
  if isScroll and node.scrollState then
    scrollX = node.scrollState.scrollX or 0
    scrollY = node.scrollState.scrollY or 0
  end
  if isScroll and (scrollX~=0 or scrollY~=0) then
    GL.glPushMatrix()
    GL.glTranslatef(-scrollX, -scrollY, 0)
  end

  -- ZIndex-aware sort (reuse zindex module if available, else plain order)
  local children = node.children or {}
  local ok, ZIndex = pcall(require, "lua.zindex")
  local paintOrder = ok and ZIndex.getSortedChildren(children) or children

  for _, child in ipairs(paintOrder) do
    Painter.paintNode(child, eff, stencilDepth)
  end

  if isScroll and (scrollX~=0 or scrollY~=0) then
    GL.glPopMatrix()
  end

  if useStencil then
    if prevSD>0 then setStencilTest(prevSD-1)
    else clearStencilTest() end
  elseif useScissor then
    popScissor()
  end

  if didTx then GL.glPopMatrix() end
end

function Painter.paint(node)
  if not node then return end
  Painter.paintNode(node)
  GL.glColor4f(1,1,1,1)
end

function Painter.init(config)
  W = (config and config.width)  or 1280
  H = (config and config.height) or 720
end

-- Update screen dimensions (called on resize)
function Painter.setDimensions(w, h)
  W = w; H = h
end

return Painter
