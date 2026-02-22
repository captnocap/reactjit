--[[
  sdl2_love_shim.lua — Minimal love.* compatibility layer for SDL2

  Provides just enough of love.graphics, love.mouse, love.keyboard,
  and love.timer so that inspector.lua, devtools.lua, and console.lua
  can load and run unchanged on the SDL2 renderer.

  Call shim.init({ ... }) once after SDL2 and GL are ready.
]]

local ffi = require("ffi")
local GL  = require("lua.sdl2_gl")

local Shim = {}

-- State injected by init()
local Font       -- lua.sdl2_font module
local sdl        -- SDL2 FFI namespace
local _W, _H     = 800, 600     -- drawable dimensions
local _mx, _my   = 0, 0         -- mouse position (updated by run loop)
local _keysDown   = {}           -- currently held keys

-- Graphics state stack
local _colorR, _colorG, _colorB, _colorA = 1, 1, 1, 1
local _fontSize = 12
local _lineWidth = 1
local _stateStack = {}

-- Scissor state (for getScissor / intersectScissor)
local _scissorActive = false
local _scissorX, _scissorY, _scissorW, _scissorH = 0, 0, 0, 0

-- ============================================================================
-- love.graphics
-- ============================================================================

local graphics = {}

function graphics.newFont(size)
  local s = size or 12
  return {
    _size = s,
    getWidth = function(self, text)
      return Font.measureWidth(text, self._size)
    end,
    getHeight = function(self)
      return Font.lineHeight(self._size)
    end,
  }
end

function graphics.setFont(f)
  if f and f._size then _fontSize = f._size end
end

function graphics.setColor(r, g, b, a)
  -- Accept both (r,g,b,a) and ({r,g,b,a})
  if type(r) == "table" then
    _colorR = r[1] or 1
    _colorG = r[2] or 1
    _colorB = r[3] or 1
    _colorA = r[4] or 1
  else
    _colorR = r or 1
    _colorG = g or 1
    _colorB = b or 1
    _colorA = a or 1
  end
end

function graphics.setLineWidth(w)
  _lineWidth = w or 1
end

function graphics.rectangle(mode, x, y, w, h, rx, ry)
  rx = rx or 0
  ry = ry or rx
  GL.glDisable(GL.TEXTURE_2D)
  GL.glColor4f(_colorR, _colorG, _colorB, _colorA)

  if mode == "fill" then
    if rx > 0 then
      -- Rounded rect (approximated with segments like sdl2_painter)
      local segs = 10
      GL.glBegin(GL.TRIANGLE_FAN)
      -- Center
      GL.glVertex2f(x + w/2, y + h/2)
      -- Walk the rounded perimeter
      local function corner(cx, cy, startAngle)
        for i = 0, segs do
          local angle = startAngle + (math.pi / 2) * (i / segs)
          GL.glVertex2f(cx + rx * math.cos(angle), cy - ry * math.sin(angle))
        end
      end
      corner(x + w - rx, y + ry,      0)             -- top-right
      corner(x + rx,     y + ry,      math.pi / 2)   -- top-left
      corner(x + rx,     y + h - ry,  math.pi)       -- bottom-left
      corner(x + w - rx, y + h - ry,  3 * math.pi / 2) -- bottom-right
      -- Close
      GL.glVertex2f(x + w, y + ry)
      GL.glEnd()
    else
      GL.glBegin(GL.QUADS)
      GL.glVertex2f(x, y)
      GL.glVertex2f(x + w, y)
      GL.glVertex2f(x + w, y + h)
      GL.glVertex2f(x, y + h)
      GL.glEnd()
    end
  elseif mode == "line" then
    GL.glLineWidth(_lineWidth)
    if rx > 0 then
      local segs = 10
      GL.glBegin(GL.LINE_LOOP)
      local function corner(cx, cy, startAngle)
        for i = 0, segs do
          local angle = startAngle + (math.pi / 2) * (i / segs)
          GL.glVertex2f(cx + rx * math.cos(angle), cy - ry * math.sin(angle))
        end
      end
      corner(x + w - rx, y + ry,      0)
      corner(x + rx,     y + ry,      math.pi / 2)
      corner(x + rx,     y + h - ry,  math.pi)
      corner(x + w - rx, y + h - ry,  3 * math.pi / 2)
      GL.glEnd()
    else
      GL.glBegin(GL.LINE_LOOP)
      GL.glVertex2f(x, y)
      GL.glVertex2f(x + w, y)
      GL.glVertex2f(x + w, y + h)
      GL.glVertex2f(x, y + h)
      GL.glEnd()
    end
  end
end

function graphics.circle(mode, cx, cy, r)
  GL.glDisable(GL.TEXTURE_2D)
  GL.glColor4f(_colorR, _colorG, _colorB, _colorA)
  local segs = 20
  if mode == "fill" then
    GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(cx, cy)
    for i = 0, segs do
      local angle = (2 * math.pi) * (i / segs)
      GL.glVertex2f(cx + r * math.cos(angle), cy + r * math.sin(angle))
    end
    GL.glEnd()
  else
    GL.glLineWidth(_lineWidth)
    GL.glBegin(GL.LINE_LOOP)
    for i = 0, segs - 1 do
      local angle = (2 * math.pi) * (i / segs)
      GL.glVertex2f(cx + r * math.cos(angle), cy + r * math.sin(angle))
    end
    GL.glEnd()
  end
end

function graphics.line(x1, y1, x2, y2)
  GL.glDisable(GL.TEXTURE_2D)
  GL.glColor4f(_colorR, _colorG, _colorB, _colorA)
  GL.glLineWidth(_lineWidth)
  GL.glBegin(GL.LINES)
  GL.glVertex2f(x1, y1)
  GL.glVertex2f(x2, y2)
  GL.glEnd()
end

function graphics.print(text, x, y)
  if not text or text == "" then return end
  Font.draw(tostring(text), x, y, _fontSize, _colorR, _colorG, _colorB, _colorA)
end

function graphics.push(mode)
  table.insert(_stateStack, {
    colorR = _colorR, colorG = _colorG, colorB = _colorB, colorA = _colorA,
    fontSize = _fontSize, lineWidth = _lineWidth,
    scissorActive = _scissorActive,
    scissorX = _scissorX, scissorY = _scissorY,
    scissorW = _scissorW, scissorH = _scissorH,
  })
  GL.glPushMatrix()
end

function graphics.pop()
  local s = table.remove(_stateStack)
  if s then
    _colorR, _colorG, _colorB, _colorA = s.colorR, s.colorG, s.colorB, s.colorA
    _fontSize = s.fontSize
    _lineWidth = s.lineWidth
    if s.scissorActive then
      graphics.setScissor(s.scissorX, s.scissorY, s.scissorW, s.scissorH)
    else
      graphics.setScissor()
    end
  end
  GL.glPopMatrix()
end

function graphics.origin()
  GL.glLoadIdentity()
end

function graphics.translate(tx, ty)
  GL.glTranslatef(tx, ty, 0)
end

function graphics.setScissor(x, y, w, h)
  if x then
    _scissorActive = true
    _scissorX, _scissorY, _scissorW, _scissorH = x, y, w, h
    GL.glEnable(GL.SCISSOR_TEST)
    -- GL scissor is bottom-left origin; flip Y
    GL.glScissor(x, _H - (y + h), w, h)
  else
    _scissorActive = false
    GL.glDisable(GL.SCISSOR_TEST)
  end
end

function graphics.getScissor()
  if _scissorActive then
    return _scissorX, _scissorY, _scissorW, _scissorH
  end
  return nil
end

function graphics.intersectScissor(x, y, w, h)
  if _scissorActive then
    -- Compute intersection with existing scissor
    local ix1 = math.max(x, _scissorX)
    local iy1 = math.max(y, _scissorY)
    local ix2 = math.min(x + w, _scissorX + _scissorW)
    local iy2 = math.min(y + h, _scissorY + _scissorH)
    graphics.setScissor(ix1, iy1, math.max(0, ix2 - ix1), math.max(0, iy2 - iy1))
  else
    graphics.setScissor(x, y, w, h)
  end
end

--- Transform a point through the current graphics transform.
--- On SDL2 during the paint pass the modelview is identity (layout coords == pixels),
--- so this is a pass-through.
function graphics.transformPoint(x, y)
  return x, y
end

function graphics.getFont()
  return {
    _size = _fontSize,
    getWidth = function(self, text)
      return Font.measureWidth(text, self._size)
    end,
    getHeight = function(self)
      return Font.lineHeight(self._size)
    end,
  }
end

function graphics.getWidth()  return _W end
function graphics.getHeight() return _H end
function graphics.getDimensions() return _W, _H end

-- ============================================================================
-- love.mouse
-- ============================================================================

local mouse = {}

function mouse.getPosition() return _mx, _my end
function mouse.getX() return _mx end
function mouse.getY() return _my end
function mouse.setCursor() end  -- no-op on SDL2 (no cursor management yet)
function mouse.getSystemCursor() return nil end

-- ============================================================================
-- love.keyboard
-- ============================================================================

local keyboard = {}

function keyboard.isDown(...)
  for i = 1, select("#", ...) do
    local k = select(i, ...)
    if _keysDown[k] then return true end
  end
  return false
end

-- ============================================================================
-- love.timer
-- ============================================================================

local timer = {}

function timer.getTime()
  return sdl.SDL_GetTicks() / 1000.0
end

-- ============================================================================
-- love.system (clipboard, OS info)
-- ============================================================================

local system = {}

function system.getClipboardText()
  if not sdl then return "" end
  local ptr = sdl.SDL_GetClipboardText()
  if ptr ~= nil then
    local text = ffi.string(ptr)
    sdl.SDL_free(ptr)
    return text
  end
  return ""
end

function system.setClipboardText(text)
  if not sdl then return end
  sdl.SDL_SetClipboardText(text or "")
end

function system.getOS()
  if jit and jit.os then return jit.os end
  return "Linux"
end

-- ============================================================================
-- Public API
-- ============================================================================

function Shim.init(cfg)
  Font = cfg.font     -- lua.sdl2_font module
  sdl  = cfg.sdl      -- SDL2 FFI namespace
  _W   = cfg.width  or 800
  _H   = cfg.height or 600

  -- Install global love table
  love = {
    graphics = graphics,
    mouse    = mouse,
    keyboard = keyboard,
    timer    = timer,
    system   = system,
  }
end

function Shim.setDimensions(w, h)
  _W, _H = w, h
end

function Shim.setMousePosition(x, y)
  _mx, _my = x, y
end

function Shim.setKeyDown(key, down)
  _keysDown[key] = down or nil
end

return Shim
