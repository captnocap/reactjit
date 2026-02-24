--[[
  sdl2_love_shim.lua — Minimal love.* compatibility layer for SDL2

  Provides just enough of love.graphics, love.mouse, love.keyboard,
  and love.timer so that inspector.lua, devtools.lua, console.lua,
  and shared modules (effects, scene3d, map, masks, etc.) can load
  and run unchanged on the SDL2 renderer.

  Includes Canvas support backed by sdl2_canvas.lua (GL FBOs).

  Call shim.init({ ... }) once after SDL2 and GL are ready.
]]

local ffi = require("ffi")
local bit = require("bit")
local GL  = require("lua.sdl2_gl")
local CanvasMod = require("lua.sdl2_canvas")

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

--- Build a font object with Love2D-compatible methods.
local function makeFontObject(size)
  return {
    _size = size,
    getWidth = function(self, text)
      return Font.measureWidth(text, self._size)
    end,
    getHeight = function(self)
      return Font.lineHeight(self._size)
    end,
    getWrap = function(self, text, limit)
      local lines = {}
      for raw in text:gmatch("[^\n]+") do
        local words = {}
        for w in raw:gmatch("%S+") do words[#words + 1] = w end
        local line = ""
        for _, word in ipairs(words) do
          local cand = line == "" and word or (line .. " " .. word)
          if Font.measureWidth(cand, self._size) <= limit then
            line = cand
          else
            if line ~= "" then lines[#lines + 1] = line end
            line = word
          end
        end
        if line ~= "" then lines[#lines + 1] = line end
      end
      if #lines == 0 then lines[1] = "" end
      return nil, lines
    end,
  }
end

function graphics.newFont(size)
  return makeFontObject(size or 12)
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

--- polygon: draw a filled or outlined polygon from a flat list of vertices.
--- Signature: polygon(mode, x1, y1, x2, y2, x3, y3, ...)
function graphics.polygon(mode, ...)
  local verts = {...}
  GL.glDisable(GL.TEXTURE_2D)
  GL.glColor4f(_colorR, _colorG, _colorB, _colorA)
  if mode == "fill" then
    GL.glBegin(GL.TRIANGLE_FAN)
  else
    GL.glLineWidth(_lineWidth)
    GL.glBegin(GL.LINE_LOOP)
  end
  for i = 1, #verts - 1, 2 do
    GL.glVertex2f(verts[i], verts[i + 1])
  end
  GL.glEnd()
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

--- printf: aligned text within a width limit (Love2D compatible).
--- Signature: printf(text, x, y, limit, align)
function graphics.printf(text, x, y, limit, align)
  if not text or text == "" then return end
  text = tostring(text)
  align = align or "left"
  local tw = Font.measureWidth(text, _fontSize)
  local dx = x
  if align == "center" then
    dx = x + (limit - tw) / 2
  elseif align == "right" then
    dx = x + limit - tw
  end
  Font.draw(text, dx, y, _fontSize, _colorR, _colorG, _colorB, _colorA)
end

function graphics.push(mode)
  table.insert(_stateStack, {
    colorR = _colorR, colorG = _colorG, colorB = _colorB, colorA = _colorA,
    fontSize = _fontSize, lineWidth = _lineWidth,
    scissorActive = _scissorActive,
    scissorX = _scissorX, scissorY = _scissorY,
    scissorW = _scissorW, scissorH = _scissorH,
    canvas = CanvasMod.getCurrent(),
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
    -- Only restore canvas if it actually changed (avoid resetting GL matrices on every pop)
    local currentCanvas = CanvasMod.getCurrent()
    if s.canvas ~= currentCanvas then
      CanvasMod.bind(s.canvas)
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
  return makeFontObject(_fontSize)
end

function graphics.getWidth()  return _W end
function graphics.getHeight() return _H end
function graphics.getDimensions() return _W, _H end

-- ============================================================================
-- love.graphics — Canvas (FBO) support
-- ============================================================================

function graphics.newCanvas(w, h)
  return CanvasMod.new(w, h)
end

function graphics.setCanvas(target)
  CanvasMod.bind(target)
end

function graphics.getCanvas()
  return CanvasMod.getCurrent()
end

--- draw: render a Canvas (or other drawable) to the current target.
--- Only Canvas objects are supported on SDL2. Images/meshes are handled
--- by the target-specific painter directly.
function graphics.draw(drawable, x, y, r, sx, sy, ox, oy)
  if drawable and drawable._isCanvas then
    GL.glColor4f(_colorR, _colorG, _colorB, _colorA)
    CanvasMod.draw(drawable, x, y, r, sx, sy, ox, oy)
  end
  -- Other drawable types (Image, Mesh) are no-ops in the shim.
  -- The SDL2 painter handles them via Images.drawTexture() directly.
end

--- clear: clear the current render target (canvas or screen).
function graphics.clear(r, g, b, a)
  r = r or 0
  g = g or 0
  b = b or 0
  a = a or 0
  GL.glClearColor(r, g, b, a)
  GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.DEPTH_BUFFER_BIT))
end

--- setDepthMode: enable/disable depth testing.
--- setDepthMode("lequal", true) — enable with lequal, write depth
--- setDepthMode("lequal", false) — enable with lequal, don't write depth
--- setDepthMode() — disable depth testing
local DEPTH_FUNC_MAP = {
  never    = GL.NEVER,
  less     = GL.LESS,
  equal    = GL.EQUAL,
  lequal   = GL.LEQUAL,
  greater  = GL.GREATER,
  notequal = GL.NOTEQUAL,
  gequal   = GL.GEQUAL,
  always   = GL.ALWAYS,
}

function graphics.setDepthMode(mode, write)
  if not mode then
    GL.glDisable(GL.DEPTH_TEST)
    return
  end
  GL.glEnable(GL.DEPTH_TEST)
  GL.glDepthFunc(DEPTH_FUNC_MAP[mode] or GL.LEQUAL)
  GL.glDepthMask(write and GL.TRUE or GL.FALSE)
end

--- setBlendMode: configure blend function.
function graphics.setBlendMode(mode)
  if not mode or mode == "alpha" then
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
  elseif mode == "add" or mode == "additive" then
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE)
  elseif mode == "multiply" then
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(0x0306, 0x0303)  -- GL_DST_COLOR, GL_ONE_MINUS_SRC_ALPHA
  elseif mode == "replace" then
    GL.glDisable(GL.BLEND)
  else
    -- Default: alpha blend
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
  end
end

--- setShader: stub for shader program binding.
--- Full shader creation is future work; this just handles on/off toggle.
function graphics.setShader(shader)
  if shader and shader._program then
    GL.glUseProgram(shader._program)
  else
    GL.glUseProgram(0)
  end
end

-- Stencil convenience (Love2D compatible, for modules that use it)
function graphics.setStencilTest(mode, value)
  if not mode then
    GL.glDisable(GL.STENCIL_TEST)
    return
  end
  GL.glEnable(GL.STENCIL_TEST)
  local func = GL.EQUAL
  if mode == "greater" then func = GL.GREATER
  elseif mode == "gequal" then func = GL.GEQUAL
  end
  GL.glStencilFunc(func, value or 1, 0xFF)
end

-- ============================================================================
-- love.mouse
-- ============================================================================

local mouse = {}
local _mouseButtons = {}  -- button number -> boolean

function mouse.getPosition() return _mx, _my end
function mouse.getX() return _mx end
function mouse.getY() return _my end
function mouse.isDown(...)
  for i = 1, select("#", ...) do
    local btn = select(i, ...)
    if _mouseButtons[btn] then return true end
  end
  return false
end
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

-- Track delta for getDelta() — updated by Shim.setDelta() from the run loop
local _dt = 1/60

function timer.getDelta()
  return _dt
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
-- love.filesystem (stub — uses plain Lua IO since Love2D sandbox unavailable)
-- ============================================================================

local filesystem = {}

-- Save directory for SDL2: use a local .save/ directory
local _saveDir = ".save"

function filesystem.read(path)
  local f = io.open(_saveDir .. "/" .. path, "r")
  if not f then return nil end
  local content = f:read("*a")
  f:close()
  return content
end

function filesystem.write(path, data)
  local f = io.open(_saveDir .. "/" .. path, "w")
  if not f then return false end
  f:write(data)
  f:close()
  return true
end

-- FFI mkdir for safe directory creation (no shell injection)
local _ffi_mkdir = nil
pcall(function()
  ffi.cdef("int mkdir(const char *path, int mode);")
  _ffi_mkdir = ffi.C.mkdir
end)

function filesystem.createDirectory(path)
  -- Sanitize: only allow alphanumeric, slash, underscore, dash, dot
  local safe = path:gsub("[^%w/_%-%.]", "")
  local fullPath = _saveDir .. "/" .. safe
  if _ffi_mkdir then
    local accum = ""
    for part in fullPath:gmatch("[^/]+") do
      accum = accum .. "/" .. part
      _ffi_mkdir(accum, tonumber("0755", 8))
    end
  else
    os.execute('mkdir -p "' .. fullPath .. '"')
  end
  return true
end

function filesystem.getSaveDirectory()
  return _saveDir
end

function filesystem.lines(path)
  -- Try the path directly first (for asset files), then save dir
  local f = io.open(path, "r")
  if not f then
    f = io.open(_saveDir .. "/" .. path, "r")
  end
  if not f then return function() return nil end end
  return function()
    local line = f:read("*l")
    if line == nil then f:close() end
    return line
  end
end

-- ============================================================================
-- love.audio (stub — device enumeration not yet available on SDL2)
-- ============================================================================

local audio = {}

function audio.getPlaybackDevices() return {} end
function audio.getRecordingDevices() return {} end

-- ============================================================================
-- love.joystick (stub — joystick enumeration not yet available on SDL2)
-- ============================================================================

local joystick = {}

function joystick.getJoysticks() return {} end

-- ============================================================================
-- love.math (Perlin noise — matches Love2D's love.math.noise signature)
-- ============================================================================

local lovemath = {}

-- Classic Perlin noise permutation table (Ken Perlin's reference implementation)
local perm = {}
do
  local p = {
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
    35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
    55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
    18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
    250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
    172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
    228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
    107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
  }
  for i = 0, 255 do perm[i] = p[i + 1] end
  for i = 256, 511 do perm[i] = perm[i - 256] end
end

local function fade(t) return t * t * t * (t * (t * 6 - 15) + 10) end
local function lerp(t, a, b) return a + t * (b - a) end

local grad3 = {
  {1,1,0},{-1,1,0},{1,-1,0},{-1,-1,0},
  {1,0,1},{-1,0,1},{1,0,-1},{-1,0,-1},
  {0,1,1},{0,-1,1},{0,1,-1},{0,-1,-1},
}

local function grad(hash, x, y, z)
  local g = grad3[(hash % 12) + 1]
  return g[1]*x + g[2]*y + (z and g[3]*z or 0)
end

local mfloor = math.floor

--- 2D Perlin noise, returns [0, 1] (matches Love2D's love.math.noise)
local function noise2(x, y)
  local X = mfloor(x) % 256
  local Y = mfloor(y) % 256
  x = x - mfloor(x)
  y = y - mfloor(y)
  local u = fade(x)
  local v = fade(y)
  local A  = perm[X] + Y
  local B  = perm[X + 1] + Y
  local val = lerp(v,
    lerp(u, grad(perm[A],     x,   y,   0), grad(perm[B],     x-1, y,   0)),
    lerp(u, grad(perm[A + 1], x,   y-1, 0), grad(perm[B + 1], x-1, y-1, 0))
  )
  return val * 0.5 + 0.5  -- remap [-1,1] → [0,1]
end

--- 3D Perlin noise, returns [0, 1]
local function noise3(x, y, z)
  local X = mfloor(x) % 256
  local Y = mfloor(y) % 256
  local Z = mfloor(z) % 256
  x = x - mfloor(x)
  y = y - mfloor(y)
  z = z - mfloor(z)
  local u = fade(x)
  local v = fade(y)
  local w = fade(z)
  local A  = perm[X]     + Y
  local AA = perm[A]     + Z
  local AB = perm[A + 1] + Z
  local B  = perm[X + 1] + Y
  local BA = perm[B]     + Z
  local BB = perm[B + 1] + Z
  local val = lerp(w,
    lerp(v,
      lerp(u, grad(perm[AA],   x,   y,   z),   grad(perm[BA],   x-1, y,   z)),
      lerp(u, grad(perm[AB],   x,   y-1, z),   grad(perm[BB],   x-1, y-1, z))
    ),
    lerp(v,
      lerp(u, grad(perm[AA+1], x,   y,   z-1), grad(perm[BA+1], x-1, y,   z-1)),
      lerp(u, grad(perm[AB+1], x,   y-1, z-1), grad(perm[BB+1], x-1, y-1, z-1))
    )
  )
  return val * 0.5 + 0.5
end

--- love.math.noise — matches Love2D signature (1-4 args, returns 0..1)
function lovemath.noise(x, y, z, w)
  if z then
    return noise3(x, y or 0, z)
  elseif y then
    return noise2(x, y)
  else
    -- 1D: evaluate as 2D with y=0
    return noise2(x or 0, 0)
  end
end

--- love.math.random — delegates to Lua math.random
function lovemath.random(a, b)
  if a and b then return math.random(a, b)
  elseif a then return math.random(a)
  else return math.random() end
end

--- love.math.triangulate — stub (used by terrain.lua, returns empty on failure)
function lovemath.triangulate(polygon)
  -- Minimal ear-clipping would go here; for now return empty to avoid crashes
  return {}
end

-- ============================================================================
-- Public API
-- ============================================================================

function Shim.init(cfg)
  Font = cfg.font     -- lua.sdl2_font module
  sdl  = cfg.sdl      -- SDL2 FFI namespace
  _W   = cfg.width  or 800
  _H   = cfg.height or 600

  -- Init Canvas module with window dimensions
  CanvasMod.setWindowDimensions(_W, _H)

  -- Install global love table
  love = {
    graphics   = graphics,
    mouse      = mouse,
    keyboard   = keyboard,
    timer      = timer,
    system     = system,
    filesystem = filesystem,
    audio      = audio,
    joystick   = joystick,
    math       = lovemath,
  }
end

function Shim.setDimensions(w, h)
  _W, _H = w, h
  CanvasMod.setWindowDimensions(w, h)
end

function Shim.setMousePosition(x, y)
  _mx, _my = x, y
end

function Shim.setMouseButton(button, pressed)
  _mouseButtons[button] = pressed or nil
end

function Shim.setKeyDown(key, down)
  _keysDown[key] = down or nil
end

function Shim.setDelta(dt)
  _dt = dt
end

return Shim
