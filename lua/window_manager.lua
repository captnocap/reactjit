--[[
  window_manager.lua — Multi-window registry for SDL2 target

  Tracks all open SDL2 windows and their per-window state (dimensions, scale,
  mouse position, event state). The main window is registered as ID 0. Child
  windows are created by the Window capability.

  Usage:
    local WM = require("lua.window_manager")
    WM.init(sdl)                                       -- pass SDL2 FFI handle
    WM.registerMain(window, ctx, w, h)                 -- register main window
    local win = WM.create({ title="Panel", width=400, height=300 })
    WM.destroy(win.id)
]]

local ffi = require("ffi")
local bit = require("bit")
local GL  = require("lua.sdl2_gl")

local WindowManager = {}

-- ============================================================================
-- State
-- ============================================================================

local sdl                    -- SDL2 FFI handle (set by init)
local windows = {}           -- id -> window entry
local sdlIdMap = {}          -- SDL window ID (uint32) -> framework window ID
local nextId = 1             -- next framework window ID (0 is main)
local mainWin = nil          -- shortcut to windows[0]

-- SDL constants (duplicated from sdl2_init to keep this module self-contained)
local SDL_WINDOW_OPENGL    = 0x00000002
local SDL_WINDOW_SHOWN     = 0x00000004
local SDL_WINDOW_RESIZABLE = 0x00000020
local SDL_WINDOWPOS_CENTERED = 0x2FFF0000
local SDL_GL_SHARE_WITH_CURRENT_CONTEXT = 22

-- SDL FFI for window management (may already be declared by sdl2_init)
pcall(ffi.cdef, [[
  uint32_t  SDL_GetWindowID(SDL_Window *win);
  void      SDL_SetWindowTitle(SDL_Window *win, const char *title);
  void      SDL_SetWindowSize(SDL_Window *win, int w, int h);
  void      SDL_SetWindowPosition(SDL_Window *win, int x, int y);
  int       SDL_GL_MakeCurrent(SDL_Window *win, SDL_GLContext ctx);
]])

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

local function queryScale(window_ptr)
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

--- Initialize the window manager with the SDL2 FFI handle.
--- Must be called before any other WM function.
function WindowManager.init(sdlLib)
  sdl = sdlLib
end

--- Register the main window (ID 0). Called once during sdl2_init startup.
function WindowManager.registerMain(sdlWindow, glContext, w, h)
  local sdlId = sdl.SDL_GetWindowID(sdlWindow)
  local dw, dh, sx, sy = queryScale(sdlWindow)
  local entry = {
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
    rootNodeId  = nil,           -- main window uses tree.getTree()
    hoveredNode = nil,
    pressedNode = nil,
    dragState   = newDragState(),
    needsLayout = true,
    isMain      = true,
  }
  windows[0] = entry
  sdlIdMap[sdlId] = 0
  mainWin = entry
  return entry
end

--- Create a new child window. Returns the window entry.
--- config: { title, width, height, x, y, rootNodeId }
function WindowManager.create(config)
  config = config or {}
  local title  = config.title  or "iLoveReact"
  local w      = config.width  or 640
  local h      = config.height or 480
  local x      = config.x      or SDL_WINDOWPOS_CENTERED
  local y      = config.y      or SDL_WINDOWPOS_CENTERED

  -- Enable GL context sharing with the main window
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

  local dw, dh, sx, sy = queryScale(win)
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
end

--- Destroy a child window by framework ID.
function WindowManager.destroy(id)
  local entry = windows[id]
  if not entry then return end
  if entry.isMain then
    io.write("[window_manager] refusing to destroy main window\n"); io.flush()
    return
  end

  sdlIdMap[entry.sdlId] = nil
  sdl.SDL_GL_DeleteContext(entry.glContext)
  sdl.SDL_DestroyWindow(entry.sdlWindow)
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
  local dw, dh, sx, sy = queryScale(entry.sdlWindow)
  entry.width  = dw
  entry.height = dh
  entry.scaleX = sx
  entry.scaleY = sy
  entry.needsLayout = true
end

--- Set a window's title.
function WindowManager.setTitle(entry, title)
  sdl.SDL_SetWindowTitle(entry.sdlWindow, title)
end

--- Set a window's size.
function WindowManager.setSize(entry, w, h)
  sdl.SDL_SetWindowSize(entry.sdlWindow, w, h)
  WindowManager.handleResize(entry)
end

--- Set a window's position.
function WindowManager.setPosition(entry, x, y)
  sdl.SDL_SetWindowPosition(entry.sdlWindow, x, y)
end

--- Return count of all windows.
function WindowManager.count()
  local n = 0
  for _ in pairs(windows) do n = n + 1 end
  return n
end

return WindowManager
