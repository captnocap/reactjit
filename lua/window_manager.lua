--[[
  window_manager.lua — Multi-window registry

  Tracks all open windows and their per-window state (dimensions, scale,
  mouse position, event state). The main window is registered as ID 0. Child
  windows are created by the Window capability.

  Supports two backends:
    - "love"  — uses love.window.createSecondary() (forked Love2D)
    - "sdl2"  — uses raw SDL2 FFI (LuaJIT + SDL2 target)

  Usage:
    local WM = require("lua.window_manager")
    WM.init({ sdl = sdlLib })        -- SDL2 backend
    WM.init()                        -- Love2D backend (auto-detected)
    WM.registerMain(...)
    local win = WM.create({ title="Panel", width=400, height=300 })
    WM.destroy(win.id)
]]

local WindowManager = {}

-- ============================================================================
-- State
-- ============================================================================

local backend = nil          -- "love" or "sdl2"
local sdl     = nil          -- SDL2 FFI handle (sdl2 backend only)
local windows = {}           -- id -> window entry
local sdlIdMap = {}          -- SDL window ID (uint32) -> framework window ID
local nextId = 1             -- next framework window ID (0 is main)
local mainWin = nil          -- shortcut to windows[0]

-- SDL2 backend-specific setup (lazy loaded)
local ffi, bit, GL
local SDL_WINDOW_OPENGL    = 0x00000002
local SDL_WINDOW_SHOWN     = 0x00000004
local SDL_WINDOW_RESIZABLE = 0x00000020
local SDL_WINDOWPOS_CENTERED = 0x2FFF0000
local SDL_GL_SHARE_WITH_CURRENT_CONTEXT = 22

local function initSDL2Deps()
  if ffi then return end
  ffi = require("ffi")
  bit = require("bit")
  GL  = require("lua.sdl2_gl")
  pcall(ffi.cdef, [[
    uint32_t  SDL_GetWindowID(SDL_Window *win);
    void      SDL_SetWindowTitle(SDL_Window *win, const char *title);
    void      SDL_SetWindowSize(SDL_Window *win, int w, int h);
    void      SDL_SetWindowPosition(SDL_Window *win, int x, int y);
    int       SDL_GL_MakeCurrent(SDL_Window *win, SDL_GLContext ctx);
  ]])
end

-- ============================================================================
-- Internal helpers
-- ============================================================================

local function newDragState()
  return {
    active = false,
    targetId = nil,
    startX = 0, startY = 0,
    lastX = 0, lastY = 0,
    thresholdCrossed = false,
  }
end

local function queryScaleSDL2(window_ptr)
  local dw = ffi.new("int[1]")
  local dh = ffi.new("int[1]")
  local ww = ffi.new("int[1]")
  local wh = ffi.new("int[1]")
  sdl.SDL_GL_GetDrawableSize(window_ptr, dw, dh)
  sdl.SDL_GetWindowSize(window_ptr, ww, wh)
  local sx = (ww[0] > 0) and (dw[0] / ww[0]) or 1
  local sy = (wh[0] > 0) and (dh[0] / wh[0]) or 1
  return dw[0], dh[0], sx, sy
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Initialize the window manager.
--- @param opts table|nil  { sdl = <SDL2 FFI handle> } for SDL2, or nil/empty for Love2D
function WindowManager.init(opts)
  opts = opts or {}
  if opts.sdl then
    backend = "sdl2"
    sdl = opts.sdl
    initSDL2Deps()
  elseif love and love.window and love.window.createSecondary then
    backend = "love"
  else
    -- Fallback: no multi-window support
    backend = nil
    io.write("[window_manager] WARNING: no multi-window backend available\n")
    io.flush()
  end
end

--- Get the current backend name.
function WindowManager.getBackend()
  return backend
end

--- Register the main window (ID 0). Called once during startup.
--- For SDL2: pass (sdlWindow, glContext, w, h).
--- For Love2D: pass no args (queries love.graphics).
function WindowManager.registerMain(sdlWindow, glContext, w, h)
  local entry

  if backend == "sdl2" then
    local sdlId = sdl.SDL_GetWindowID(sdlWindow)
    local dw, dh, sx, sy = queryScaleSDL2(sdlWindow)
    entry = {
      id          = 0,
      sdlWindow   = sdlWindow,
      glContext   = glContext,
      sdlId       = sdlId,
      width       = dw,
      height      = dh,
      scaleX      = sx,
      scaleY      = sy,
      mx          = 0,
      my          = 0,
      rootNodeId  = nil,
      hoveredNode = nil,
      pressedNode = nil,
      dragState   = newDragState(),
      needsLayout = true,
      isMain      = true,
    }
    sdlIdMap[sdlId] = 0

  elseif backend == "love" then
    local pw = love.graphics.getWidth()
    local ph = love.graphics.getHeight()
    entry = {
      id          = 0,
      loveId      = nil,  -- main window has no secondary ID
      width       = pw,
      height      = ph,
      scaleX      = love.window.getDPIScale(),
      scaleY      = love.window.getDPIScale(),
      mx          = 0,
      my          = 0,
      rootNodeId  = nil,
      hoveredNode = nil,
      pressedNode = nil,
      dragState   = newDragState(),
      needsLayout = true,
      isMain      = true,
    }
  else
    -- No backend, still register a stub main window
    entry = {
      id          = 0,
      width       = w or 800,
      height      = h or 600,
      scaleX      = 1,
      scaleY      = 1,
      mx          = 0,
      my          = 0,
      rootNodeId  = nil,
      hoveredNode = nil,
      pressedNode = nil,
      dragState   = newDragState(),
      needsLayout = true,
      isMain      = true,
    }
  end

  windows[0] = entry
  mainWin = entry
  return entry
end

--- Create a new child window. Returns the window entry.
--- config: { title, width, height, x, y, rootNodeId }
function WindowManager.create(config)
  config = config or {}
  local title  = config.title  or "ReactJIT"
  local w      = config.width  or 640
  local h      = config.height or 480
  local x      = config.x
  local y      = config.y

  if backend == "love" then
    -- Use forked Love2D's secondary window API
    -- Love2D wrapper defaults x/y to SDL_WINDOWPOS_CENTERED when omitted
    local moddedTitle = title .. " [MODDED]"
    local loveId = love.window.createSecondary(moddedTitle, w, h, x, y)

    local ww, wh, pw, ph = love.window.getSecondarySize(loveId)
    local sx = (ww > 0) and (pw / ww) or 1
    local sy = (wh > 0) and (ph / wh) or 1
    local sdlId = love.window.getSecondarySDLId(loveId)

    local id = nextId
    nextId = nextId + 1

    local entry = {
      id          = id,
      loveId      = loveId,
      sdlId       = sdlId,
      width       = pw,
      height      = ph,
      scaleX      = sx,
      scaleY      = sy,
      mx          = 0,
      my          = 0,
      rootNodeId  = config.rootNodeId or nil,
      hoveredNode = nil,
      pressedNode = nil,
      dragState   = newDragState(),
      needsLayout = true,
      isMain      = false,
    }

    windows[id] = entry
    sdlIdMap[sdlId] = id

    io.write("[window_manager] created window #" .. id .. " (" .. pw .. "x" .. ph .. ") loveId=" .. loveId .. "\n")
    io.flush()
    return entry

  elseif backend == "sdl2" then
    -- Use raw SDL2 FFI
    x = x or SDL_WINDOWPOS_CENTERED
    y = y or SDL_WINDOWPOS_CENTERED

    sdl.SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT, 1)

    local win = sdl.SDL_CreateWindow(
      title, x, y, w, h,
      bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_RESIZABLE)
    )
    if win == nil then
      io.write("[window_manager] SDL_CreateWindow failed: " .. ffi.string(sdl.SDL_GetError()) .. "\n")
      io.flush()
      return nil
    end

    local ctx = sdl.SDL_GL_CreateContext(win)
    if ctx == nil then
      sdl.SDL_DestroyWindow(win)
      io.write("[window_manager] SDL_GL_CreateContext failed: " .. ffi.string(sdl.SDL_GetError()) .. "\n")
      io.flush()
      return nil
    end

    -- Set up GL state for this context
    sdl.SDL_GL_MakeCurrent(win, ctx)
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)

    local dw, dh, sx, sy = queryScaleSDL2(win)
    GL.glViewport(0, 0, dw, dh)
    GL.glClearColor(0.05, 0.05, 0.09, 1.0)
    GL.glMatrixMode(GL.PROJECTION)
    GL.glLoadIdentity()
    GL.glOrtho(0, dw, dh, 0, -1, 1)
    GL.glMatrixMode(GL.MODELVIEW)
    GL.glLoadIdentity()

    -- Restore main context as current
    if mainWin then
      sdl.SDL_GL_MakeCurrent(mainWin.sdlWindow, mainWin.glContext)
    end

    local id = nextId
    nextId = nextId + 1
    local sdlId = sdl.SDL_GetWindowID(win)

    local entry = {
      id          = id,
      sdlWindow   = win,
      glContext   = ctx,
      sdlId       = sdlId,
      width       = dw,
      height      = dh,
      scaleX      = sx,
      scaleY      = sy,
      mx          = 0,
      my          = 0,
      rootNodeId  = config.rootNodeId or nil,
      hoveredNode = nil,
      pressedNode = nil,
      dragState   = newDragState(),
      needsLayout = true,
      isMain      = false,
    }

    windows[id] = entry
    sdlIdMap[sdlId] = id

    io.write("[window_manager] created window #" .. id .. " (" .. dw .. "x" .. dh .. ") sdlId=" .. sdlId .. "\n")
    io.flush()
    return entry

  else
    io.write("[window_manager] no backend available, cannot create window\n")
    io.flush()
    return nil
  end
end

--- Destroy a child window by framework ID.
function WindowManager.destroy(id)
  local entry = windows[id]
  if not entry then return end
  if entry.isMain then
    io.write("[window_manager] refusing to destroy main window\n"); io.flush()
    return
  end

  if backend == "love" and entry.loveId then
    love.window.destroySecondary(entry.loveId)
  elseif backend == "sdl2" and entry.sdlWindow then
    sdl.SDL_GL_DeleteContext(entry.glContext)
    sdl.SDL_DestroyWindow(entry.sdlWindow)
  end

  if entry.sdlId then
    sdlIdMap[entry.sdlId] = nil
  end
  windows[id] = nil

  io.write("[window_manager] destroyed window #" .. id .. "\n"); io.flush()
end

--- Look up a window entry by SDL window ID (from event.*.wid).
function WindowManager.getBySDLId(sdlId)
  local fwId = sdlIdMap[sdlId]
  if fwId then return windows[fwId] end
  return nil
end

--- Get a window entry by framework ID.
function WindowManager.get(id)
  return windows[id]
end

--- Get the main window (ID 0).
function WindowManager.getMain()
  return mainWin
end

--- Return an ordered list of all window entries (main first).
function WindowManager.getAll()
  local result = {}
  if mainWin then result[1] = mainWin end
  for id, entry in pairs(windows) do
    if id ~= 0 then
      result[#result + 1] = entry
    end
  end
  return result
end

--- Update a window's dimensions after resize. Recalculates scale factors.
function WindowManager.handleResize(entry)
  if backend == "sdl2" and entry.sdlWindow then
    local dw, dh, sx, sy = queryScaleSDL2(entry.sdlWindow)
    entry.width  = dw
    entry.height = dh
    entry.scaleX = sx
    entry.scaleY = sy
  elseif backend == "love" then
    if entry.isMain then
      entry.width  = love.graphics.getWidth()
      entry.height = love.graphics.getHeight()
      entry.scaleX = love.window.getDPIScale()
      entry.scaleY = love.window.getDPIScale()
    elseif entry.loveId then
      local ww, wh, pw, ph = love.window.getSecondarySize(entry.loveId)
      entry.width  = pw
      entry.height = ph
      local sx = (ww > 0) and (pw / ww) or 1
      local sy = (wh > 0) and (ph / wh) or 1
      entry.scaleX = sx
      entry.scaleY = sy
    end
  end
  entry.needsLayout = true
end

--- Set a window's title.
function WindowManager.setTitle(entry, title)
  if backend == "sdl2" and entry.sdlWindow then
    sdl.SDL_SetWindowTitle(entry.sdlWindow, title)
  elseif backend == "love" then
    if entry.isMain then
      love.window.setTitle(title)
    end
    -- Love2D secondary windows: title is set at creation, no API to change it yet
  end
end

--- Set a window's size.
function WindowManager.setSize(entry, w, h)
  -- No-op guard: prevent resize loops when the size hasn't actually changed
  w, h = math.floor(w), math.floor(h)
  if w == entry.width and h == entry.height then return end

  if backend == "sdl2" and entry.sdlWindow then
    sdl.SDL_SetWindowSize(entry.sdlWindow, w, h)
  elseif backend == "love" and entry.isMain then
    love.window.updateMode(w, h, { resizable = true })
  end
  -- Love2D secondary windows: no resize API yet
  WindowManager.handleResize(entry)
end

--- Set a window's position.
function WindowManager.setPosition(entry, x, y)
  if backend == "sdl2" and entry.sdlWindow then
    sdl.SDL_SetWindowPosition(entry.sdlWindow, x, y)
  end
  -- Love2D secondary windows: no position API yet
end

--- Activate a secondary window's GL context (Love2D backend).
function WindowManager.activate(entry)
  if backend == "love" and entry.loveId then
    love.window.activateSecondary(entry.loveId)
  elseif backend == "sdl2" and entry.sdlWindow then
    sdl.SDL_GL_MakeCurrent(entry.sdlWindow, entry.glContext)
  end
end

--- Swap buffers for a secondary window (Love2D backend).
function WindowManager.swap(entry)
  if backend == "love" and entry.loveId then
    love.window.swapSecondary(entry.loveId)
  end
  -- SDL2: swap is handled in the paint loop directly
end

--- Restore the main window's GL context (Love2D backend).
function WindowManager.activateMain()
  if backend == "love" then
    love.window.activateMain()
  elseif backend == "sdl2" and mainWin and mainWin.sdlWindow then
    sdl.SDL_GL_MakeCurrent(mainWin.sdlWindow, mainWin.glContext)
  end
end

--- Return count of all windows.
function WindowManager.count()
  local n = 0
  for _ in pairs(windows) do n = n + 1 end
  return n
end

-- ============================================================================
-- Animated resize
-- ============================================================================

local activeAnimations = 0

local function easeOutCubic(t)
  t = t - 1
  return t * t * t + 1
end

--- Animate a window to a target size over `durationMs` milliseconds.
function WindowManager.animateTo(entry, w, h, durationMs)
  w, h = math.floor(w), math.floor(h)
  if w == entry.width and h == entry.height then return end
  -- Cancel any in-flight animation on this entry
  if not entry.anim then
    activeAnimations = activeAnimations + 1
  end
  entry.anim = {
    startW   = entry.width,
    startH   = entry.height,
    targetW  = w,
    targetH  = h,
    duration = (durationMs or 300) / 1000, -- convert to seconds
    elapsed  = 0,
  }
end

--- Tick all active window animations. Call once per frame.
--- Returns true if any animation is still in progress.
function WindowManager.tick(dt)
  if activeAnimations == 0 then return false end

  local still = false
  for _, entry in pairs(windows) do
    local a = entry.anim
    if a then
      a.elapsed = a.elapsed + dt
      if a.elapsed >= a.duration then
        -- Snap to final size and clear animation
        WindowManager.setSize(entry, a.targetW, a.targetH)
        entry.anim = nil
        activeAnimations = activeAnimations - 1
      else
        local t = easeOutCubic(a.elapsed / a.duration)
        local cw = a.startW + (a.targetW - a.startW) * t
        local ch = a.startH + (a.targetH - a.startH) * t
        WindowManager.setSize(entry, cw, ch)
        still = true
      end
    end
  end
  return still
end

return WindowManager
