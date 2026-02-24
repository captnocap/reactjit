--[[
  sdl2_canvas.lua -- FBO-backed Canvas for the SDL2 target

  Provides the love.graphics.Canvas equivalent using GL_EXT_framebuffer_object.
  Each Canvas wraps a GL FBO + RGBA color texture, with an optional depth
  renderbuffer created lazily on first setCanvas({canvas, depth=true}).

  The sdl2_love_shim wires this into love.graphics.newCanvas / setCanvas /
  getCanvas / draw so existing shared Lua modules (effects, scene3d, map,
  game, emulator, masks) work unchanged on the SDL2 target.

  Depends on: lua.sdl2_gl (GL function proxy + constants)
]]

local ffi = require("ffi")
local bit = require("bit")
local GL  = require("lua.sdl2_gl")

local Canvas = {}

-- ============================================================================
-- GL constants (supplement sdl2_gl.lua where needed)
-- ============================================================================

local GL_FRAMEBUFFER          = GL.FRAMEBUFFER_EXT          -- 0x8D40
local GL_FRAMEBUFFER_COMPLETE = GL.FRAMEBUFFER_COMPLETE_EXT -- 0x8CD5
local GL_COLOR_ATTACHMENT0    = GL.COLOR_ATTACHMENT0_EXT     -- 0x8CE0
local GL_DEPTH_ATTACHMENT     = GL.DEPTH_ATTACHMENT_EXT      -- 0x8D00
local GL_RENDERBUFFER         = GL.RENDERBUFFER_EXT          -- 0x8D41
local GL_RGBA8                = 0x8058
local GL_FRAMEBUFFER_BINDING  = 0x8CA6

-- ============================================================================
-- Pre-allocated FFI buffers (avoid per-call allocation)
-- ============================================================================

local _fboIds  = ffi.new("unsigned int[1]")
local _texIds  = ffi.new("unsigned int[1]")
local _rbIds   = ffi.new("unsigned int[1]")
local _intBuf  = ffi.new("int[4]")  -- for glGetIntegerv

-- ============================================================================
-- Module state
-- ============================================================================

local _currentCanvas = nil         -- currently bound Canvas or nil (screen)
local _windowW, _windowH = 800, 600  -- screen dimensions for viewport restore
local _savedViewport = ffi.new("int[4]")

-- ============================================================================
-- Filter / wrap name → GL enum
-- ============================================================================

local FILTER_MAP = {
  linear  = GL.LINEAR,
  nearest = GL.NEAREST,
}

local WRAP_MAP = {
  clamp     = GL.CLAMP_TO_EDGE,
  ["clamp"] = GL.CLAMP_TO_EDGE,
  ["repeat"] = GL.REPEAT,
}

-- ============================================================================
-- Canvas metatable
-- ============================================================================

local CanvasMT = {}
CanvasMT.__index = CanvasMT

function CanvasMT:getWidth()
  return self._width
end

function CanvasMT:getHeight()
  return self._height
end

function CanvasMT:getDimensions()
  return self._width, self._height
end

function CanvasMT:getFormat()
  return "rgba8"
end

function CanvasMT:setFilter(min, mag)
  min = FILTER_MAP[min] or GL.LINEAR
  mag = FILTER_MAP[mag] or min
  GL.glBindTexture(GL.TEXTURE_2D, self._tex)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, min)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, mag)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
end

function CanvasMT:setWrap(u, v)
  u = WRAP_MAP[u] or GL.CLAMP_TO_EDGE
  v = WRAP_MAP[v] or u
  GL.glBindTexture(GL.TEXTURE_2D, self._tex)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, u)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, v)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
end

function CanvasMT:release()
  if self._depthRb then
    _rbIds[0] = self._depthRb
    GL.glDeleteRenderbuffersEXT(1, _rbIds)
    self._depthRb = nil
  end
  if self._fbo then
    _fboIds[0] = self._fbo
    GL.glDeleteFramebuffersEXT(1, _fboIds)
    self._fbo = nil
  end
  if self._tex then
    _texIds[0] = self._tex
    GL.glDeleteTextures(1, _texIds)
    self._tex = nil
  end
  self._width = 0
  self._height = 0
end

-- ============================================================================
-- Canvas.new(w, h) — create FBO + RGBA color texture
-- ============================================================================

function Canvas.new(w, h)
  w = math.floor(w)
  h = math.floor(h)
  if w <= 0 or h <= 0 then
    io.write("[sdl2_canvas] ERROR: invalid dimensions " .. w .. "x" .. h .. "\n"); io.flush()
    return nil
  end

  -- Create color texture
  GL.glGenTextures(1, _texIds)
  local texId = _texIds[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL.RGBA, GL.UNSIGNED_BYTE, nil)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glBindTexture(GL.TEXTURE_2D, 0)

  -- Create FBO
  GL.glGenFramebuffersEXT(1, _fboIds)
  local fboId = _fboIds[0]
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, fboId)
  GL.glFramebufferTexture2DEXT(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL.TEXTURE_2D, texId, 0)

  -- Verify completeness
  local status = GL.glCheckFramebufferStatusEXT(GL_FRAMEBUFFER)
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, 0)

  if status ~= GL_FRAMEBUFFER_COMPLETE then
    io.write("[sdl2_canvas] ERROR: FBO incomplete (status=0x" .. string.format("%X", status) .. ")\n"); io.flush()
    _texIds[0] = texId; GL.glDeleteTextures(1, _texIds)
    _fboIds[0] = fboId; GL.glDeleteFramebuffersEXT(1, _fboIds)
    return nil
  end

  local canvas = setmetatable({
    _isCanvas = true,
    _fbo      = fboId,
    _tex      = texId,
    _depthRb  = nil,
    _width    = w,
    _height   = h,
  }, CanvasMT)

  return canvas
end

-- ============================================================================
-- Depth renderbuffer (lazy, created on first {canvas, depth=true})
-- ============================================================================

local function ensureDepthBuffer(canvas)
  if canvas._depthRb then return end

  GL.glGenRenderbuffersEXT(1, _rbIds)
  local rbId = _rbIds[0]
  GL.glBindRenderbufferEXT(GL_RENDERBUFFER, rbId)
  GL.glRenderbufferStorageEXT(GL_RENDERBUFFER, GL.DEPTH_COMPONENT24, canvas._width, canvas._height)
  GL.glBindRenderbufferEXT(GL_RENDERBUFFER, 0)

  -- Attach to canvas FBO
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, canvas._fbo)
  GL.glFramebufferRenderbufferEXT(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rbId)

  local status = GL.glCheckFramebufferStatusEXT(GL_FRAMEBUFFER)
  if status ~= GL_FRAMEBUFFER_COMPLETE then
    io.write("[sdl2_canvas] WARNING: FBO incomplete after depth attach (status=0x" .. string.format("%X", status) .. ")\n"); io.flush()
    _rbIds[0] = rbId; GL.glDeleteRenderbuffersEXT(1, _rbIds)
    GL.glBindFramebufferEXT(GL_FRAMEBUFFER, 0)
    return
  end

  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, 0)
  canvas._depthRb = rbId
end

-- ============================================================================
-- Canvas.bind(target) — switch render target
-- ============================================================================

function Canvas.bind(target)
  if target == nil or target == false then
    -- Unbind: restore screen
    GL.glBindFramebufferEXT(GL_FRAMEBUFFER, 0)
    GL.glViewport(0, 0, _windowW, _windowH)
    GL.glMatrixMode(GL.PROJECTION)
    GL.glLoadIdentity()
    GL.glOrtho(0, _windowW, _windowH, 0, -1, 1)  -- top-left origin
    GL.glMatrixMode(GL.MODELVIEW)
    GL.glLoadIdentity()
    _currentCanvas = nil
    return
  end

  -- Parse table form: {canvas, depth=true}
  local canvas = target
  local useDepth = false
  if type(target) == "table" and not target._isCanvas then
    canvas = target[1]
    useDepth = target.depth == true
  end

  if not canvas or not canvas._isCanvas or not canvas._fbo then
    io.write("[sdl2_canvas] WARNING: bind() called with invalid canvas\n"); io.flush()
    return
  end

  -- Ensure depth buffer if requested
  if useDepth then
    ensureDepthBuffer(canvas)
  end

  -- Bind the FBO
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, canvas._fbo)

  -- Set viewport to canvas dimensions
  GL.glViewport(0, 0, canvas._width, canvas._height)

  -- Set ortho projection matching canvas (top-left origin, same as screen)
  GL.glMatrixMode(GL.PROJECTION)
  GL.glLoadIdentity()
  GL.glOrtho(0, canvas._width, canvas._height, 0, -1, 1)
  GL.glMatrixMode(GL.MODELVIEW)
  GL.glLoadIdentity()

  _currentCanvas = canvas
end

-- ============================================================================
-- Canvas.getCurrent() — return currently bound canvas or nil
-- ============================================================================

function Canvas.getCurrent()
  return _currentCanvas
end

-- ============================================================================
-- Canvas.setWindowDimensions(w, h) — store for viewport restore
-- ============================================================================

function Canvas.setWindowDimensions(w, h)
  _windowW = w
  _windowH = h
end

-- ============================================================================
-- Canvas.draw(canvas, x, y, r, sx, sy, ox, oy) — draw canvas texture
-- ============================================================================

function Canvas.draw(canvas, x, y, r, sx, sy, ox, oy)
  if not canvas or not canvas._isCanvas or not canvas._tex then return end

  x  = x  or 0
  y  = y  or 0
  r  = r  or 0
  sx = sx or 1
  sy = sy or sx
  ox = ox or 0
  oy = oy or 0

  local w = canvas._width * sx
  local h = canvas._height * sy

  GL.glEnable(GL.TEXTURE_2D)
  GL.glBindTexture(GL.TEXTURE_2D, canvas._tex)
  -- Note: color is expected to be set by caller via love.graphics.setColor

  if r ~= 0 then
    -- Rotation path: use matrix stack
    GL.glPushMatrix()
    GL.glTranslatef(x, y, 0)
    GL.glRotatef(r * (180 / math.pi), 0, 0, 1)  -- radians → degrees
    GL.glTranslatef(-ox * sx, -oy * sy, 0)
    GL.glBegin(GL.QUADS)
      GL.glTexCoord2f(0, 0); GL.glVertex2f(0, 0)
      GL.glTexCoord2f(1, 0); GL.glVertex2f(w, 0)
      GL.glTexCoord2f(1, 1); GL.glVertex2f(w, h)
      GL.glTexCoord2f(0, 1); GL.glVertex2f(0, h)
    GL.glEnd()
    GL.glPopMatrix()
  else
    -- Fast path: no rotation, just translate + scale
    local dx = x - ox * sx
    local dy = y - oy * sy
    GL.glBegin(GL.QUADS)
      GL.glTexCoord2f(0, 0); GL.glVertex2f(dx,     dy)
      GL.glTexCoord2f(1, 0); GL.glVertex2f(dx + w, dy)
      GL.glTexCoord2f(1, 1); GL.glVertex2f(dx + w, dy + h)
      GL.glTexCoord2f(0, 1); GL.glVertex2f(dx,     dy + h)
    GL.glEnd()
  end

  GL.glBindTexture(GL.TEXTURE_2D, 0)
  GL.glDisable(GL.TEXTURE_2D)
end

return Canvas
